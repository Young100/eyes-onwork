import crypto from 'crypto';
import { adminAuth, adminDb } from './firebaseAdminSdk.js';
import { buildProviderLinkedAlertEmail, sendEmailSafe } from '../../emailService.js';

export const UNVERIFIED_ACCOUNT_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 heures
export const SECURITY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 heures

const USER_OWNED_COLLECTIONS = [
  'clients',
  'projects',
  'quotes',
  'invoices',
  'appointments',
  'time_entries',
  'expenses',
  'payments',
  'catalog_services',
  'catalog_packs',
  'project_templates',
  'workspaces',
  'reminders',
  'leads'
] as const;

export type LinkedProviderKind = 'google' | 'password';

export function normalizeProviderIds(rawProviders: unknown): string[] {
  if (!Array.isArray(rawProviders)) return [];
  const normalized = new Set<string>();
  for (const item of rawProviders) {
    const raw = typeof item === 'string' ? item : (item as any)?.providerId;
    if (!raw || typeof raw !== 'string') continue;
    if (raw === 'google.com' || raw === 'google') normalized.add('google');
    else if (raw === 'password') normalized.add('password');
    else normalized.add(raw);
  }
  return Array.from(normalized);
}

export function hashSecurityToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function buildSecureAccountUrl(origin: string | undefined, rawToken: string): string {
  const cleanOrigin = (origin || '').trim().replace(/\/+$/, '');
  const query = `?securityAction=secureAccount&token=${encodeURIComponent(rawToken)}`;
  return cleanOrigin ? `${cleanOrigin}/${query}` : `/${query}`;
}

export interface AccountSecurityDeps {
  auth?: {
    getUser: (uid: string) => Promise<any>;
    getUserByEmail: (email: string) => Promise<any>;
    listUsers: (maxResults?: number, pageToken?: string) => Promise<{ users: any[]; pageToken?: string }>;
    revokeRefreshTokens: (uid: string) => Promise<void>;
    deleteUser: (uid: string) => Promise<void>;
  };
  db?: {
    collection: (name: string) => any;
  };
  sendEmail?: typeof sendEmailSafe;
  nowMs?: () => number;
}

function getDeps(deps?: AccountSecurityDeps) {
  return {
    auth: deps?.auth || adminAuth,
    db: deps?.db || adminDb,
    sendEmail: deps?.sendEmail || sendEmailSafe,
    nowMs: deps?.nowMs || (() => Date.now())
  };
}

/**
 * Crée un jeton cryptographique à usage unique (TTL 24h) pour l'action "Sécuriser mon compte".
 */
export async function createSecurityActionToken(
  uid: string,
  email: string,
  purpose: 'secure_account' = 'secure_account',
  deps?: AccountSecurityDeps
): Promise<{ rawToken: string; tokenHash: string; expiresAt: number }> {
  const { db, nowMs } = getDeps(deps);
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashSecurityToken(rawToken);
  const now = nowMs();
  const expiresAt = now + SECURITY_TOKEN_TTL_MS;

  await db.collection('security_action_tokens').doc(tokenHash).set({
    uid,
    email: (email || '').trim().toLowerCase(),
    purpose,
    used: false,
    expiresAt,
    createdAt: new Date(now).toISOString()
  });

  return { rawToken, tokenHash, expiresAt };
}

/**
 * Détecte l'ajout d'un nouveau fournisseur de connexion (ex: Google relié à un compte email, ou l'inverse)
 * et envoie l'email d'avertissement avec lien "Sécuriser mon compte" de révocation globale.
 */
export async function notifyProviderLinkedIfNew(
  params: {
    uid: string;
    email?: string;
    displayName?: string;
    addedProvider?: LinkedProviderKind;
    currentProviders?: string[];
    origin?: string;
    clientIp?: string;
    forceNotify?: boolean;
  },
  deps?: AccountSecurityDeps
): Promise<{
  notified: boolean;
  addedProvider?: LinkedProviderKind;
  knownProviders: string[];
  secureAccountUrl?: string;
}> {
  const { auth, db, sendEmail, nowMs } = getDeps(deps);
  const uid = params.uid;
  if (!uid) return { notified: false, knownProviders: [] };

  const userRef = db.collection('users').doc(uid);
  const userSnap = await userRef.get();
  const userData = userSnap.exists ? userSnap.data() || {} : {};

  let authProviders = normalizeProviderIds(params.currentProviders);
  let targetEmail = (params.email || userData.email || '').trim().toLowerCase();
  let studioName = userData.studioName || userData.company || userData.displayName || params.displayName || 'Mon Studio';

  if (authProviders.length === 0 || !targetEmail) {
    try {
      const authUser = await auth.getUser(uid);
      if (authProviders.length === 0) {
        authProviders = normalizeProviderIds(authUser?.providerData);
      }
      if (!targetEmail && authUser?.email) {
        targetEmail = String(authUser.email).trim().toLowerCase();
      }
      if (authUser?.displayName && studioName === 'Mon Studio') {
        studioName = authUser.displayName;
      }
    } catch {
      // ignore if user lookup unavailable
    }
  }

  const previousKnown = normalizeProviderIds(userData.knownProviders);
  const mergedProviders = Array.from(new Set([...previousKnown, ...authProviders, ...(params.addedProvider ? [params.addedProvider] : [])]));

  let newlyAdded: LinkedProviderKind | undefined;

  if (params.forceNotify && params.addedProvider) {
    newlyAdded = params.addedProvider;
  } else if (params.addedProvider && !previousKnown.includes(params.addedProvider) && previousKnown.length > 0) {
    newlyAdded = params.addedProvider;
  } else if (previousKnown.length > 0) {
    if (authProviders.includes('google') && !previousKnown.includes('google')) {
      newlyAdded = 'google';
    } else if (authProviders.includes('password') && !previousKnown.includes('password')) {
      newlyAdded = 'password';
    }
  }

  // Persister les fournisseurs connus pour ne pas renvoyer en double
  await userRef.set(
    {
      knownProviders: mergedProviders,
      updatedAt: new Date(nowMs()).toISOString()
    },
    { merge: true }
  );

  if (!newlyAdded || !targetEmail) {
    return { notified: false, knownProviders: mergedProviders };
  }

  // Anti-doublon immédiat sur ce même fournisseur
  const sentMap = (userData.providerLinkedAlertSentFor && typeof userData.providerLinkedAlertSentFor === 'object')
    ? userData.providerLinkedAlertSentFor
    : {};
  if (!params.forceNotify && sentMap[newlyAdded]) {
    return { notified: false, knownProviders: mergedProviders };
  }

  const { rawToken } = await createSecurityActionToken(uid, targetEmail, 'secure_account', deps);
  const secureAccountUrl = buildSecureAccountUrl(params.origin, rawToken);

  const emailContent = buildProviderLinkedAlertEmail({
    recipientEmail: targetEmail,
    studioName,
    providerName: newlyAdded === 'google' ? 'Google' : 'Mot de passe',
    secureAccountUrl
  });

  await sendEmail({
    to: targetEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    templateKey: 'security_provider_linked',
    recipientName: studioName,
    studioName,
    workspaceId: userData.workspaceId || 'security_alert',
    ip: params.clientIp
  });

  await userRef.set(
    {
      providerLinkedAlertSentFor: {
        ...sentMap,
        [newlyAdded]: new Date(nowMs()).toISOString()
      },
      updatedAt: new Date(nowMs()).toISOString()
    },
    { merge: true }
  );

  return {
    notified: true,
    addedProvider: newlyAdded,
    knownProviders: mergedProviders,
    secureAccountUrl
  };
}

/**
 * Révoque tous les jetons de rafraîchissement Firebase Auth côté serveur (revokeRefreshTokens)
 * pour déconnecter immédiatement tous les appareils, puis propose de changer le mot de passe.
 */
export async function revokeAllSessionsAndSecureAccount(
  params: { token?: string; uid?: string },
  deps?: AccountSecurityDeps
): Promise<{
  success: boolean;
  error?: string;
  message?: string;
  uid?: string;
  email?: string;
  hasPasswordProvider?: boolean;
  sessionsRevoked?: boolean;
}> {
  const { auth, db, nowMs } = getDeps(deps);
  let targetUid = params.uid || '';
  let targetEmail = '';

  if (params.token) {
    const tokenHash = hashSecurityToken(params.token.trim());
    const tokenRef = db.collection('security_action_tokens').doc(tokenHash);
    const snap = await tokenRef.get();

    if (!snap.exists) {
      return {
        success: false,
        error: 'INVALID_TOKEN',
        message: 'Lien de sécurité invalide ou introuvable.'
      };
    }

    const tokenData = snap.data() || {};
    if (tokenData.used === true) {
      return {
        success: false,
        error: 'TOKEN_ALREADY_USED',
        message: 'Ce lien de sécurité a déjà été utilisé. Toutes les sessions ont déjà été révoquées.'
      };
    }

    if (nowMs() > Number(tokenData.expiresAt || 0)) {
      return {
        success: false,
        error: 'TOKEN_EXPIRED',
        message: 'Ce lien de sécurité a expiré. Connectez-vous pour révoquer vos appareils depuis Paramètres > Sécurité.'
      };
    }

    targetUid = tokenData.uid || '';
    targetEmail = (tokenData.email || '').trim().toLowerCase();

    await tokenRef.update({
      used: true,
      usedAt: new Date(nowMs()).toISOString()
    });
  }

  if (!targetUid) {
    return {
      success: false,
      error: 'UID_REQUIRED',
      message: 'Compte introuvable.'
    };
  }

  // Révocation globale côté serveur : invalide immédiatement tous les refresh tokens et sessions actives
  await auth.revokeRefreshTokens(targetUid);

  let hasPasswordProvider = true;
  try {
    const authUser = await auth.getUser(targetUid);
    if (!targetEmail && authUser?.email) {
      targetEmail = String(authUser.email).trim().toLowerCase();
    }
    const providers = normalizeProviderIds(authUser?.providerData);
    hasPasswordProvider = providers.includes('password');
  } catch {
    // keep defaults
  }

  try {
    const nowIso = new Date(nowMs()).toISOString();
    await db.collection('users').doc(targetUid).set(
      {
        tokensRevokedAt: nowIso,
        updatedAt: nowIso
      },
      { merge: true }
    );
  } catch {
    // non blocking if user doc was already removed
  }

  return {
    success: true,
    uid: targetUid,
    email: targetEmail,
    hasPasswordProvider,
    sessionsRevoked: true,
    message: 'Tous vos appareils ont été déconnectés. Vous pouvez maintenant définir un nouveau mot de passe.'
  };
}

/**
 * Supprime intégralement les données Firestore et le compte Firebase Auth d'un utilisateur.
 */
export async function purgeUserAccountData(
  uid: string,
  deps?: AccountSecurityDeps
): Promise<{ deletedDocs: number; authDeleted: boolean }> {
  const { auth, db } = getDeps(deps);
  if (!uid) return { deletedDocs: 0, authDeleted: false };

  let deletedDocs = 0;

  for (const colName of USER_OWNED_COLLECTIONS) {
    try {
      const snap = await db.collection(colName).where('ownerId', '==', uid).get();
      if (snap && Array.isArray(snap.docs)) {
        for (const docSnap of snap.docs) {
          if (docSnap?.ref && typeof docSnap.ref.delete === 'function') {
            await docSnap.ref.delete();
          } else {
            await db.collection(colName).doc(docSnap.id).delete();
          }
          deletedDocs += 1;
        }
      }
    } catch (err: any) {
      console.warn(`[AccountPurge] Notice deleting collection ${colName} for ${uid}:`, err?.message || err);
    }
  }

  // Documents indexés par uid
  for (const singleton of [
    { col: 'verification_codes', id: uid },
    { col: 'abonnements', id: uid },
    { col: 'users', id: uid }
  ]) {
    try {
      const ref = db.collection(singleton.col).doc(singleton.id);
      const docSnap = await ref.get();
      if (docSnap?.exists) {
        await ref.delete();
        deletedDocs += 1;
      }
    } catch (err: any) {
      console.warn(`[AccountPurge] Notice deleting ${singleton.col}/${singleton.id}:`, err?.message || err);
    }
  }

  // Suppression finale du compte Firebase Auth
  let authDeleted = false;
  try {
    await auth.deleteUser(uid);
    authDeleted = true;
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') {
      authDeleted = true;
    } else {
      throw err;
    }
  }

  return { deletedDocs, authDeleted };
}

function isUnverifiedPasswordOnlyAccount(userRecord: any, firestoreUserData?: any): boolean {
  if (!userRecord) return false;
  if (userRecord.emailVerified === true) return false;
  if (firestoreUserData?.emailVerified === true) return false;

  const providers = normalizeProviderIds(userRecord.providerData);
  // Si Google ou un autre fournisseur OAuth est présent, on ne considère pas comme un compte email non vérifié abandonné
  if (providers.includes('google')) return false;

  return providers.length === 0 || providers.includes('password');
}

function getCreationTimestampMs(userRecord: any, firestoreUserData?: any): number | null {
  const authCreation = userRecord?.metadata?.creationTime ? Date.parse(userRecord.metadata.creationTime) : NaN;
  if (!Number.isNaN(authCreation) && authCreation > 0) return authCreation;
  const fsCreation = firestoreUserData?.createdAt ? Date.parse(firestoreUserData.createdAt) : NaN;
  if (!Number.isNaN(fsCreation) && fsCreation > 0) return fsCreation;
  return null;
}

/**
 * Supprime un compte email jamais vérifié depuis plus de 24h pour une adresse donnée
 * afin qu'il ne bloque jamais une nouvelle inscription ni une connexion Google.
 * Retourne toujours un résultat neutre (cleaned: false) si le compte est récent, vérifié ou inexistant.
 */
export async function cleanupStaleUnverifiedAccountByEmail(
  email: string,
  maxAgeMs: number = UNVERIFIED_ACCOUNT_MAX_AGE_MS,
  deps?: AccountSecurityDeps
): Promise<{ cleaned: boolean; deletedUid?: string }> {
  const { auth, db, nowMs } = getDeps(deps);
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { cleaned: false };
  }

  let userRecord: any = null;
  try {
    userRecord = await auth.getUserByEmail(cleanEmail);
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found') {
      return { cleaned: false };
    }
    throw err;
  }

  if (!userRecord || !userRecord.uid) {
    return { cleaned: false };
  }

  let firestoreData: any = null;
  try {
    const snap = await db.collection('users').doc(userRecord.uid).get();
    if (snap?.exists) {
      firestoreData = snap.data();
    }
  } catch {
    // non-fatal
  }

  if (!isUnverifiedPasswordOnlyAccount(userRecord, firestoreData)) {
    return { cleaned: false };
  }

  const createdMs = getCreationTimestampMs(userRecord, firestoreData);
  if (createdMs === null) {
    return { cleaned: false };
  }

  const ageMs = nowMs() - createdMs;
  if (ageMs < maxAgeMs) {
    return { cleaned: false };
  }

  await purgeUserAccountData(userRecord.uid, deps);
  console.log(`[UnverifiedCleanup] Deleted stale unverified email account (>24h): ${userRecord.uid}`);
  return { cleaned: true, deletedUid: userRecord.uid };
}

/**
 * Balayage planifié : supprime automatiquement tous les comptes email/mot de passe
 * restés non vérifiés depuis plus de 24 heures (Firebase Auth + Firestore).
 */
export async function cleanupExpiredUnverifiedAccounts(
  maxAgeMs: number = UNVERIFIED_ACCOUNT_MAX_AGE_MS,
  deps?: AccountSecurityDeps
): Promise<{ scannedUsers: number; deletedCount: number; deletedUids: string[] }> {
  const { auth, db, nowMs } = getDeps(deps);
  const cutoffMs = nowMs() - maxAgeMs;
  let scannedUsers = 0;
  const deletedUidSet = new Set<string>();

  // 1. Balayage paginé Firebase Auth
  let nextPageToken: string | undefined = undefined;
  do {
    const result = await auth.listUsers(1000, nextPageToken);
    const users = Array.isArray(result?.users) ? result.users : [];
    scannedUsers += users.length;

    for (const u of users) {
      if (!u || !u.uid) continue;
      let firestoreData: any = null;
      try {
        const snap = await db.collection('users').doc(u.uid).get();
        if (snap?.exists) firestoreData = snap.data();
      } catch {}

      if (!isUnverifiedPasswordOnlyAccount(u, firestoreData)) continue;

      const createdMs = getCreationTimestampMs(u, firestoreData);
      if (createdMs !== null && createdMs <= cutoffMs) {
        await purgeUserAccountData(u.uid, deps);
        deletedUidSet.add(u.uid);
      }
    }

    nextPageToken = result?.pageToken;
  } while (nextPageToken);

  // 2. Balayage complémentaire de profils Firestore non vérifiés orphelins (> 24h)
  try {
    const cutoffIso = new Date(cutoffMs).toISOString();
    const unverifiedSnap = await db.collection('users').where('emailVerified', '==', false).get();
    if (unverifiedSnap && Array.isArray(unverifiedSnap.docs)) {
      for (const docSnap of unverifiedSnap.docs) {
        const data = docSnap.data() || {};
        const uid = docSnap.id || data.uid;
        if (!uid || deletedUidSet.has(uid)) continue;
        const known = normalizeProviderIds(data.knownProviders);
        if (known.includes('google')) continue;
        const createdAtStr = data.createdAt;
        if (createdAtStr && createdAtStr <= cutoffIso) {
          // Vérifier si Auth le marque quand même vérifié avant de purger
          let authUser: any = null;
          try {
            authUser = await auth.getUser(uid);
          } catch (err: any) {
            if (err?.code !== 'auth/user-not-found') authUser = null;
          }
          if (authUser && !isUnverifiedPasswordOnlyAccount(authUser, data)) {
            continue;
          }
          await purgeUserAccountData(uid, deps);
          deletedUidSet.add(uid);
        }
      }
    }
  } catch (err: any) {
    console.warn('[UnverifiedCleanup] Firestore orphan sweep notice:', err?.message || err);
  }

  return {
    scannedUsers,
    deletedCount: deletedUidSet.size,
    deletedUids: Array.from(deletedUidSet)
  };
}

let schedulerIntervalId: ReturnType<typeof setInterval> | null = null;
let initialTimerId: ReturnType<typeof setTimeout> | null = null;

/**
 * Démarre le nettoyage automatique planifié côté serveur (toutes les heures)
 * des comptes email non vérifiés depuis plus de 24 heures.
 */
export function startUnverifiedAccountCleanupScheduler(): void {
  if (schedulerIntervalId) return;

  const runSweep = async () => {
    try {
      const stats = await cleanupExpiredUnverifiedAccounts(UNVERIFIED_ACCOUNT_MAX_AGE_MS);
      if (stats.deletedCount > 0) {
        console.log(`[UnverifiedCleanup] Auto-purged ${stats.deletedCount} expired unverified account(s).`);
      }
    } catch (err: any) {
      console.warn('[UnverifiedCleanup] Scheduled sweep notice:', err?.message || err);
    }
  };

  initialTimerId = setTimeout(runSweep, 15 * 1000);
  if (typeof initialTimerId.unref === 'function') {
    initialTimerId.unref();
  }

  schedulerIntervalId = setInterval(runSweep, 60 * 60 * 1000);
  if (typeof schedulerIntervalId.unref === 'function') {
    schedulerIntervalId.unref();
  }
}
