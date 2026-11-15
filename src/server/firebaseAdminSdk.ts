import fs from 'fs';
import path from 'path';
import { initializeApp, cert, applicationDefault, getApps, getApp, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getStorage, Storage } from 'firebase-admin/storage';
import crypto from 'crypto';
import firebaseConfig from '../../firebase-applet-config.json';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;
let adminStorage: Storage;

function initFirebaseAdmin() {
  if (getApps().length > 0) {
    adminApp = getApp();
    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
    adminStorage = getStorage(adminApp);
    return;
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  let credentialToUse;

  if (serviceAccountKey) {
    try {
      let parsed = typeof serviceAccountKey === 'string' ? JSON.parse(serviceAccountKey) : serviceAccountKey;
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      credentialToUse = cert(parsed);
      console.log('[FirebaseAdmin] Initialized with FIREBASE_SERVICE_ACCOUNT_KEY certificate');
    } catch (err: any) {
      console.warn('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY, falling back:', err.message);
    }
  }

  // Check for local service-account.json file at root if environment variable is not set
  if (!credentialToUse) {
    try {
      const localFile = path.join(process.cwd(), 'service-account.json');
      if (fs.existsSync(localFile)) {
        const fileContent = JSON.parse(fs.readFileSync(localFile, 'utf8'));
        credentialToUse = cert(fileContent);
        console.log('[FirebaseAdmin] Initialized with local service-account.json');
      }
    } catch (err: any) {
      console.warn('[FirebaseAdmin] Failed to load local service-account.json:', err.message);
    }
  }

  if (!credentialToUse && googleAppCreds) {
    try {
      credentialToUse = applicationDefault();
      console.log('[FirebaseAdmin] Initialized with GOOGLE_APPLICATION_CREDENTIALS file');
    } catch (err: any) {
      console.warn('[FirebaseAdmin] Failed to load applicationDefault from credentials:', err.message);
    }
  }

  // Attempt applicationDefault if running in GCP/Cloud Run environment
  if (!credentialToUse) {
    try {
      credentialToUse = applicationDefault();
      console.log('[FirebaseAdmin] Initialized with GCP Application Default Credentials');
    } catch {
      // Running locally without ADC file
    }
  }

  const appOptions: any = {
    projectId: firebaseConfig.projectId,
    storageBucket: firebaseConfig.storageBucket,
  };

  if (credentialToUse) {
    appOptions.credential = credentialToUse;
  }

  adminApp = initializeApp(appOptions);
  adminAuth = getAuth(adminApp);
  adminDb = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
  adminStorage = getStorage(adminApp);
  console.log(`[FirebaseAdmin] SDK connected to project: ${firebaseConfig.projectId}, db: ${firebaseConfig.firestoreDatabaseId}, storage: ${firebaseConfig.storageBucket || 'default'}`);
}

initFirebaseAdmin();

export { adminApp, adminAuth, adminDb, adminStorage };

const SIGNED_URL_SECRET = process.env.SIGNED_URL_SECRET || 'eyesonwork-signed-url-secret-2025';

export function createSignedFileToken(storagePath: string, expiresAt: number): string {
  const payload = `${storagePath}:${expiresAt}`;
  const hmac = crypto.createHmac('sha256', SIGNED_URL_SECRET).update(payload).digest('hex');
  return `${expiresAt}.${hmac}`;
}

export function verifySignedFileToken(storagePath: string, token: string): boolean {
  if (!token || typeof token !== 'string' || !token.includes('.')) return false;
  const [expiresAtStr, hmac] = token.split('.');
  const expiresAt = Number(expiresAtStr);
  if (!expiresAt || Date.now() > expiresAt) return false;
  const expectedPayload = `${storagePath}:${expiresAt}`;
  const expectedHmac = crypto.createHmac('sha256', SIGNED_URL_SECRET).update(expectedPayload).digest('hex');
  if (hmac.length !== expectedHmac.length) return false;
  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(expectedHmac));
}

/**
 * Generates a signed URL for a file stored under users/{uid}/**
 * Strictly accessible only through server verification.
 */
export async function generateSignedDeliverableUrl(
  storagePath: string, 
  expiresInMinutes: number = 30
): Promise<{ signedUrl: string; expiresAt: string }> {
  const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;

  // Try GCS getSignedUrl if storageBucket and cloud credentials allow
  if (firebaseConfig.storageBucket) {
    try {
      const bucket = adminStorage.bucket(firebaseConfig.storageBucket);
      const file = bucket.file(storagePath);
      const [gcsSignedUrl] = await file.getSignedUrl({
        version: 'v4',
        action: 'read',
        expires: expiresAt
      });
      return {
        signedUrl: gcsSignedUrl,
        expiresAt: new Date(expiresAt).toISOString()
      };
    } catch {
      // In dev environment or without signBlob permissions, fallback to secure server-token route
    }
  }

  const token = createSignedFileToken(storagePath, expiresAt);
  const secureSignedUrl = `/api/deliverables/download-signed?path=${encodeURIComponent(storagePath)}&token=${token}`;
  return {
    signedUrl: secureSignedUrl,
    expiresAt: new Date(expiresAt).toISOString()
  };
}

/**
 * Super Admin UIDs configurable via environment variable SUPERADMIN_UIDS (comma-separated)
 */
export function getSuperAdminUids(): Set<string> {
  const envUids = (process.env.SUPERADMIN_UIDS || '')
    .split(',')
    .map(u => u.trim())
    .filter(Boolean);
  return new Set(envUids);
}

/**
 * Verifies a Firebase ID token sent in the Authorization: Bearer <token> header.
 * Returns the decoded token payload with verified uid, email, and custom claims.
 */
export async function verifyFirebaseToken(idToken: string): Promise<{
  uid: string;
  email?: string;
  emailVerified?: boolean;
  role?: string;
  isSuperAdmin?: boolean;
  rawToken: any;
}> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('ID_TOKEN_MISSING');
  }

  // Seul adminAuth.verifyIdToken(idToken, true) avec vérification de révocation est accepté.
  // Aucun décodage manuel, repli permissif ou mock n'est autorisé.
  const decoded = await adminAuth.verifyIdToken(idToken, true);
  const superAdminUids = getSuperAdminUids();
  const isSuperAdmin = decoded.role === 'superadmin' || decoded.isSuperAdmin === true || superAdminUids.has(decoded.uid);

  return {
    uid: decoded.uid,
    email: decoded.email,
    emailVerified: decoded.email_verified,
    role: isSuperAdmin ? 'superadmin' : (decoded.role || 'user'),
    isSuperAdmin,
    rawToken: decoded
  };
}

/**
 * Assigns or revokes Super Admin custom claim to a Firebase user.
 * Enforces role in the Firebase Auth token.
 */
export async function setSuperAdminClaim(uid: string, isSuperAdmin: boolean = true): Promise<void> {
  if (!uid) throw new Error('UID_REQUIRED');
  try {
    const currentClaims = (await adminAuth.getUser(uid)).customClaims || {};
    const newClaims = {
      ...currentClaims,
      role: isSuperAdmin ? 'superadmin' : 'user',
      isSuperAdmin,
      admin: isSuperAdmin
    };
    await adminAuth.setCustomUserClaims(uid, newClaims);
    console.log(`[FirebaseAdmin] Updated custom claims for user ${uid}: isSuperAdmin=${isSuperAdmin}`);
  } catch (err: any) {
    console.warn(`[FirebaseAdmin] Failed to set custom claims for ${uid}:`, err.message);
    throw err;
  }
}

/**
 * Marks user email as verified in Firebase Authentication using Admin SDK.
 */
export async function markUserEmailVerifiedInAuth(uid: string): Promise<void> {
  if (!uid) return;
  try {
    await adminAuth.updateUser(uid, { emailVerified: true });
    console.log(`[FirebaseAdmin] Marked user ${uid} email as verified in Auth`);
  } catch (err: any) {
    console.warn(`[FirebaseAdmin] Could not mark emailVerified in Auth for ${uid}:`, err.message);
  }
}

/**
 * Server-only writes for verification_codes (Client SDK has allow read, write: if false)
 */
export async function writeServerVerificationCode(email: string, data: any): Promise<void> {
  try {
    const safeKey = email.toLowerCase().replace(/[^a-z0-9_]/gi, '_');
    await adminDb.collection('verification_codes').doc(safeKey).set({
      ...data,
      email: email.toLowerCase(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err: any) {
    console.warn('[FirebaseAdmin] Failed to write verification_codes to Firestore:', err.message);
  }
}

/**
 * Server-only writes for email_logs (Client SDK has allow read, write: if false)
 */
export async function writeServerEmailLog(log: any): Promise<void> {
  try {
    const logId = log.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await adminDb.collection('email_logs').doc(logId).set({
      ...log,
      createdAt: log.createdAt || new Date().toISOString()
    });
  } catch (err: any) {
    console.warn('[FirebaseAdmin] Failed to write email_logs to Firestore:', err.message);
  }
}

/**
 * Server-only writes for subscriptions / abonnements (Client SDK has allow read, write: if false)
 */
export async function writeServerSubscription(userId: string, subscriptionData: any): Promise<void> {
  try {
    await adminDb.collection('abonnements').doc(userId).set({
      ...subscriptionData,
      userId,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err: any) {
    console.warn('[FirebaseAdmin] Failed to write abonnement to Firestore:', err.message);
  }
}

export interface FirestoreAdminTestResult {
  status: 'connected' | 'error';
  testedAt: string;
  writeSuccess: boolean;
  writeLatencyMs: number;
  readSuccess: boolean;
  readLatencyMs: number;
  cleanupSuccess: boolean;
  error?: string;
  probeDoc: string;
}

let startupFirestoreTestResult: FirestoreAdminTestResult = {
  status: 'error',
  testedAt: new Date().toISOString(),
  writeSuccess: false,
  writeLatencyMs: 0,
  readSuccess: false,
  readLatencyMs: 0,
  cleanupSuccess: false,
  probeDoc: 'system_health/admin_diagnostic_probe',
  error: 'Test non initialisé'
};

/**
 * Tests write then read on Firestore Admin at startup and updates diagnostic health probe.
 */
export async function testFirestoreAdminConnection(): Promise<FirestoreAdminTestResult> {
  const timestamp = new Date().toISOString();
  let writeSuccess = false;
  let writeLatencyMs = 0;
  let readSuccess = false;
  let readLatencyMs = 0;
  let cleanupSuccess = false;
  let errorMessage: string | undefined;

  try {
    const probeRef = adminDb.collection('system_health').doc('admin_diagnostic_probe');
    const tWriteStart = Date.now();
    await probeRef.set({
      test: 'admin_connection_probe',
      timestamp: Date.now(),
      status: 'active',
      testedAt: timestamp
    });
    writeLatencyMs = Date.now() - tWriteStart;
    writeSuccess = true;

    const tReadStart = Date.now();
    const readSnap = await probeRef.get();
    readLatencyMs = Date.now() - tReadStart;
    readSuccess = readSnap.exists;

    await probeRef.delete();
    cleanupSuccess = true;
    console.log(`[FirebaseAdmin] Startup Firestore probe SUCCESS: write=${writeLatencyMs}ms, read=${readLatencyMs}ms`);
  } catch (err: any) {
    errorMessage = err?.message || String(err);
    console.error('[FirebaseAdmin] Startup Firestore probe FAILED:', errorMessage);
  }

  startupFirestoreTestResult = {
    status: writeSuccess && readSuccess ? 'connected' : 'error',
    testedAt: timestamp,
    writeSuccess,
    writeLatencyMs,
    readSuccess,
    readLatencyMs,
    cleanupSuccess,
    probeDoc: 'system_health/admin_diagnostic_probe',
    error: errorMessage
  };

  return startupFirestoreTestResult;
}

export function getStartupFirestoreTestResult(): FirestoreAdminTestResult {
  return startupFirestoreTestResult;
}

export function isPermissionOrCredentialError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = err.code;
  return (
    code === 7 ||
    code === 'permission-denied' ||
    msg.includes('permission') ||
    msg.includes('insufficient') ||
    msg.includes('denied') ||
    msg.includes('unauthenticated') ||
    msg.includes('credential')
  );
}

/**
 * Retrieves a user document securely via Admin SDK.
 * Fails fast and throws on Firestore Admin error; no in-memory cache fallback.
 */
export async function getServerUserProfile(uid: string): Promise<any | null> {
  if (!uid) return null;
  const snap = await adminDb.collection('users').doc(uid).get();
  if (snap.exists) {
    return snap.data();
  }
  return null;
}

/**
 * Idempotent creation of user profile and workspace strictly once per uid.
 * If users/{uid} already exists, NEVER recreates profile, workspace nor onboarding.
 * Preserves the random workspaceId permanently.
 */
export async function getOrCreateServerUserProfileAndWorkspace(user: {
  uid: string;
  email?: string;
  displayName?: string;
  role?: string;
  emailVerified?: boolean;
  providers?: string[];
}): Promise<any> {
  if (!user.uid) throw new Error('Missing user uid');

  const normalizedIncomingProviders = Array.isArray(user.providers)
    ? Array.from(
        new Set(
          user.providers
            .map(p => (p === 'google.com' || p === 'google' ? 'google' : p === 'password' ? 'password' : p))
            .filter(Boolean)
        )
      )
    : [];

  const userRef = adminDb.collection('users').doc(user.uid);
  const snap = await userRef.get();

  if (snap.exists) {
    const existing = snap.data()!;
    // S'assurer que le document workspace existe aussi si nécessaire
    if (existing.workspaceId) {
      const wsRef = adminDb.collection('workspaces').doc(existing.workspaceId);
      const wsSnap = await wsRef.get();
      if (!wsSnap.exists) {
        const now = new Date().toISOString();
        const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
        await wsRef.set({
          id: existing.workspaceId,
          name: existing.studioName || (existing.displayName ? `Studio ${existing.displayName}` : 'Mon Studio'),
          ownerId: user.uid,
          ownerEmail: existing.email || user.email || '',
          planId: existing.plan || 'free',
          planStatus: 'trial',
          planBillingCycle: 'monthly',
          planStartedAt: existing.createdAt || now,
          planRenewsAt: trialEnds,
          trialEndsAt: trialEnds,
          storageLimitMb: 500,
          membersLimit: 1,
          storageUsedMb: 0,
          members: [{
            userId: user.uid,
            email: existing.email || user.email || '',
            name: existing.displayName || user.displayName || 'Titulaire',
            role: 'owner',
            joinedAt: existing.createdAt || now
          }],
          createdAt: existing.createdAt || now,
          updatedAt: now
        }, { merge: true });
      }
    }
    if (user.emailVerified && !existing.emailVerified) {
      existing.emailVerified = true;
      existing.emailVerifiedAt = new Date().toISOString();
      try {
        await userRef.update({
          emailVerified: true,
          emailVerifiedAt: existing.emailVerifiedAt,
          updatedAt: new Date().toISOString()
        });
      } catch (err: any) {
        console.warn(`[FirebaseAdmin] Failed to update emailVerified on users/${user.uid}:`, err.message);
      }
    }
    if (!Array.isArray(existing.knownProviders) && normalizedIncomingProviders.length > 0) {
      existing.knownProviders = normalizedIncomingProviders;
      try {
        await userRef.update({
          knownProviders: normalizedIncomingProviders,
          updatedAt: new Date().toISOString()
        });
      } catch {}
    }
    // Profil existant : on ne recrée JAMAIS profil, workspace ni onboarding
    return existing;
  }

  // Création unique et idempotente par uid avec workspaceId aléatoire conservé
  const randomHex = crypto.randomBytes(8).toString('hex');
  const workspaceId = `ws_${randomHex}`;
  const now = new Date().toISOString();
  const trialEnds = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();
  const studioName = user.displayName ? `Studio ${user.displayName}` : 'Mon Studio';

  const newProfile = {
    uid: user.uid,
    email: user.email || '',
    displayName: user.displayName || '',
    studioName,
    role: user.role || 'user',
    plan: 'free',
    emailVerified: Boolean(user.emailVerified),
    knownProviders: normalizedIncomingProviders.length > 0 ? normalizedIncomingProviders : ['password'],
    workspaceId,
    termsAcceptedVersion: null,
    termsAcceptedAt: null,
    privacyAcceptedVersion: null,
    privacyAcceptedAt: null,
    onboardingCompleted: false,
    onboardingCompletedAt: null,
    onboardingStep: 1,
    createdAt: now,
    updatedAt: now
  };

  const newWorkspace = {
    id: workspaceId,
    name: studioName,
    ownerId: user.uid,
    ownerEmail: user.email || '',
    planId: 'free',
    planStatus: 'trial',
    planBillingCycle: 'monthly',
    planStartedAt: now,
    planRenewsAt: trialEnds,
    trialEndsAt: trialEnds,
    storageLimitMb: 500,
    membersLimit: 1,
    storageUsedMb: 0,
    members: [{
      userId: user.uid,
      email: user.email || '',
      name: user.displayName || 'Titulaire',
      role: 'owner',
      joinedAt: now
    }],
    createdAt: now,
    updatedAt: now
  };

  const batch = adminDb.batch();
  batch.set(userRef, newProfile);
  batch.set(adminDb.collection('workspaces').doc(workspaceId), newWorkspace);
  await batch.commit();

  return newProfile;
}

/**
 * Updates or creates a user profile in Firestore via Admin SDK.
 * Fails fast and throws on Firestore Admin error; no in-memory cache fallback.
 */
export async function setServerUserProfile(uid: string, data: any, merge: boolean = true): Promise<void> {
  if (!uid) return;
  const updated = {
    ...data,
    uid,
    updatedAt: new Date().toISOString()
  };
  await adminDb.collection('users').doc(uid).set(updated, { merge });
}

/**
 * Look up project and related client portal documents by share token via Admin SDK.
 * Browser client NEVER accesses Firestore directly for token verification.
 */
const mockPortalProjects = new Map<string, any>();
const mockPortalQuotes = new Map<string, any>();
const mockPortalInvoices = new Map<string, any>();

export function registerMockPortalProject(project: any) {
  if (project?.id) {
    mockPortalProjects.set(project.id, { ...project });
  }
}

export function registerMockPortalQuote(quote: any) {
  if (quote?.id) {
    mockPortalQuotes.set(quote.id, { ...quote });
  }
}

export function registerMockPortalInvoice(invoice: any) {
  if (invoice?.id) {
    mockPortalInvoices.set(invoice.id, { ...invoice });
  }
}

export function getMockPortalProject(id: string) {
  return mockPortalProjects.get(id);
}

export function getMockPortalQuote(id: string) {
  return mockPortalQuotes.get(id);
}

export function getMockPortalInvoice(id: string) {
  return mockPortalInvoices.get(id);
}

export function clearMockPortalData() {
  mockPortalProjects.clear();
  mockPortalQuotes.clear();
  mockPortalInvoices.clear();
}

/**
 * Liste blanche stricte des champs devis pour le portail client.
 * Élimine impérativement ownerId, workspaceId et toute note interne / métadonnée privée.
 */
export function sanitizePortalQuote(q: any): any {
  if (!q) return null;
  return {
    id: q.id,
    quoteNumber: q.quoteNumber,
    version: q.version,
    projectId: q.projectId,
    clientId: q.clientId,
    title: q.title,
    createdAt: q.createdAt,
    date: q.date,
    validityDays: q.validityDays,
    dueDate: q.dueDate,
    lines: Array.isArray(q.lines) ? q.lines.map((l: any) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      unit: l.unit,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      vatRate: l.vatRate,
      totalHT: l.totalHT,
      totalTTC: l.totalTTC,
      turnaroundDays: l.turnaroundDays,
      revisionLimit: l.revisionLimit
    })) : [],
    subtotal: q.subtotal,
    discountPercent: q.discountPercent,
    discountAmount: q.discountAmount,
    netHT: q.netHT,
    vatRate: q.vatRate,
    vatAmount: q.vatAmount,
    totalTTC: q.totalTTC,
    depositPercent: q.depositPercent,
    depositAmount: q.depositAmount,
    balanceDue: q.balanceDue,
    revisionLimit: q.revisionLimit,
    turnaroundTime: q.turnaroundTime,
    termsAndConditions: q.termsAndConditions,
    status: q.status,
    isLocked: q.isLocked,
    acceptedAt: q.acceptedAt,
    acceptedByName: q.acceptedByName,
    refusedAt: q.refusedAt,
    refusalReason: q.refusalReason,
    signatoryName: q.signatoryName,
    signatureDataUrl: q.signatureDataUrl,
    signedAt: q.signedAt
  };
}

/**
 * Liste blanche stricte des champs factures pour le portail client.
 * Élimine impérativement ownerId, workspaceId et toute note interne.
 */
export function sanitizePortalInvoice(inv: any): any {
  if (!inv) return null;
  return {
    id: inv.id,
    invoiceNumber: inv.invoiceNumber,
    type: inv.type,
    quoteId: inv.quoteId,
    devisId: inv.devisId,
    projectId: inv.projectId,
    clientId: inv.clientId,
    title: inv.title,
    createdAt: inv.createdAt,
    issueDate: inv.issueDate,
    dueDate: inv.dueDate,
    lines: Array.isArray(inv.lines) ? inv.lines.map((l: any) => ({
      id: l.id,
      name: l.name,
      description: l.description,
      unit: l.unit,
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      vatRate: l.vatRate,
      totalHT: l.totalHT,
      totalTTC: l.totalTTC,
      turnaroundDays: l.turnaroundDays,
      revisionLimit: l.revisionLimit
    })) : [],
    subtotal: inv.subtotal,
    discountPercent: inv.discountPercent,
    discountAmount: inv.discountAmount,
    netHT: inv.netHT,
    vatRate: inv.vatRate,
    vatAmount: inv.vatAmount,
    totalTTC: inv.totalTTC,
    depositAmount: inv.depositAmount,
    paidAmount: inv.paidAmount,
    balanceDue: inv.balanceDue,
    status: inv.status,
    legalNotice: inv.legalNotice,
    payments: Array.isArray(inv.payments) ? inv.payments.map((p: any) => ({
      id: p.id,
      invoiceId: p.invoiceId,
      amount: p.amount,
      date: p.date,
      method: p.method,
      reference: p.reference
      // Élimination stricte de notes, internalNotes, recordedBy
    })) : [],
    paymentMethod: inv.paymentMethod,
    paidAt: inv.paidAt,
    isLocked: inv.isLocked,
    isCancelled: inv.isCancelled,
    cancelledAt: inv.cancelledAt,
    cancellationReason: inv.cancellationReason,
    rectifyingInvoiceNumber: inv.rectifyingInvoiceNumber,
    originalInvoiceNumber: inv.originalInvoiceNumber,
    isCreditNote: inv.isCreditNote
  };
}

/**
 * Détermine si le solde financier d'un projet est intégralement réglé.
 */
function isProjectBalanceSettled(project: any, rawInvoices: any[]): boolean {
  if (project.delivery?.isUnlocked === true) {
    return true;
  }
  const totalBudget = Number(project.budget) || 0;
  const totalPaid = Number(project.paidAmount) || 0;

  const hasUnpaidInvoice = (rawInvoices || []).some((inv: any) => {
    if (inv.status === 'paid' || inv.status === 'cancelled') return false;
    const balance = Number(inv.balanceDue ?? inv.totalTTC ?? 0);
    return balance > 0;
  });

  if (hasUnpaidInvoice) {
    return false;
  }

  if (totalBudget > 0) {
    return totalPaid >= totalBudget;
  }

  return true;
}

/**
 * Récupération sécurisée des données du portail client par jeton.
 * - Le jeton clientShareToken n'est JAMAIS renvoyé dans l'objet réponse.
 * - Devis et factures passent par une liste blanche stricte (pas d'ownerId, workspaceId ou note interne).
 * - Le champ delivery est exclu tant que le solde n'est pas réglé.
 * - Renvoie des messages d'erreur génériques sans fuite d'informations internes.
 */
export async function getClientPortalDataByToken(token: string): Promise<{
  success: boolean;
  project?: any;
  client?: any;
  quotes?: any[];
  invoices?: any[];
  error?: string;
  message?: string;
  revoked?: boolean;
}> {
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'TOKEN_REQUIRED', message: 'Jeton de partage requis.' };
  }

  try {
    const snapshot = await adminDb.collection('projects')
      .where('clientShareToken', '==', token)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { success: false, error: 'PORTAL_NOT_FOUND', message: 'Portail client introuvable ou lien invalide.' };
    }

    const docSnap = snapshot.docs[0];
    const project: any = { id: docSnap.id, ...docSnap.data() };

    // Vérification explicite de révocation du lien
    if (project.clientLinkActive === false || project.isRevoked === true || project.tokenRevoked === true) {
      return { success: false, error: 'LINK_REVOKED', revoked: true, message: 'Le lien d’accès au portail a été révoqué.' };
    }

    // Récupération des devis
    const quotesSnap = await adminDb.collection('quotes')
      .where('projectId', '==', project.id)
      .get();
    const rawQuotes = quotesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Récupération des factures
    const invoicesSnap = await adminDb.collection('invoices')
      .where('projectId', '==', project.id)
      .get();
    const rawInvoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Vérification du règlement complet du solde
    const isSettled = isProjectBalanceSettled(project, rawInvoices);

    // Projet assaini pour le portail client :
    // STRICTEMENT SANS clientShareToken !
    const safeProject: any = {
      id: project.id,
      title: project.title,
      type: project.type,
      currentStep: project.currentStep,
      budget: project.budget,
      paidAmount: project.paidAmount,
      currency: project.currency || 'EUR',
      description: project.description,
      desiredDeadline: project.desiredDeadline,
      mockupRounds: project.mockupRounds || [],
      files: (project.files || []).filter((f: any) => !f.isPrivate),
      clientLinkActive: project.clientLinkActive !== false,
      createdAt: project.createdAt
    };

    // Le champ delivery est exclu tant que le solde n'est pas réglé
    if (isSettled && project.delivery) {
      safeProject.delivery = project.delivery;
    }

    // Récupération du client associé (liste blanche)
    let client = null;
    if (project.clientId) {
      const clientSnap = await adminDb.collection('clients').doc(project.clientId).get();
      if (clientSnap.exists) {
        const cData = clientSnap.data();
        client = {
          id: clientSnap.id,
          name: cData?.name,
          email: cData?.email,
          company: cData?.company
        };
      }
    }

    return {
      success: true,
      project: safeProject,
      client,
      quotes: rawQuotes.map(sanitizePortalQuote),
      invoices: rawInvoices.map(sanitizePortalInvoice)
    };
  } catch (err: any) {
    if (isPermissionOrCredentialError(err)) {
      // Recherche dans le mock local pour environnements de test / hors ligne
      for (const p of mockPortalProjects.values()) {
        if (p.clientShareToken === token) {
          if (p.clientLinkActive === false || p.isRevoked === true || p.tokenRevoked === true) {
            return { success: false, error: 'LINK_REVOKED', revoked: true, message: 'Le lien d’accès au portail a été révoqué.' };
          }

          const rawQuotes = Array.from(mockPortalQuotes.values()).filter(q => q.projectId === p.id);
          const rawInvoices = Array.from(mockPortalInvoices.values()).filter(inv => inv.projectId === p.id);
          const isSettled = isProjectBalanceSettled(p, rawInvoices);

          const safeProject: any = {
            id: p.id,
            title: p.title,
            type: p.type,
            currentStep: p.currentStep,
            budget: p.budget,
            paidAmount: p.paidAmount,
            currency: p.currency || 'EUR',
            description: p.description,
            desiredDeadline: p.desiredDeadline,
            mockupRounds: p.mockupRounds || [],
            files: (p.files || []).filter((f: any) => !f.isPrivate),
            clientLinkActive: p.clientLinkActive !== false,
            createdAt: p.createdAt
          };

          if (isSettled && p.delivery) {
            safeProject.delivery = p.delivery;
          }

          return {
            success: true,
            project: safeProject,
            client: null,
            quotes: rawQuotes.map(sanitizePortalQuote),
            invoices: rawInvoices.map(sanitizePortalInvoice)
          };
        }
      }
      return { success: false, error: 'PORTAL_NOT_FOUND', message: 'Portail client introuvable ou lien invalide.' };
    }

    // Jamais de jeton ni de trace interne dans les journaux
    console.warn('[FirebaseAdmin] Error fetching portal data');
    return { success: false, error: 'PORTAL_FETCH_FAILED', message: 'Impossible de charger les informations du portail.' };
  }
}

/**
 * Génère un jeton de portail cryptographique aléatoire de 256 bits (32 octets base64url).
 * Vérifie l'unicité du jeton dans la base Firestore avant écriture.
 * Invalide immédiatement tout jeton précédent en l'écrasant.
 */
export async function generateSecurePortalTokenForProject(
  projectId: string,
  ownerUid: string
): Promise<{ success: boolean; token?: string; error?: string }> {
  if (!projectId || !ownerUid) {
    return { success: false, error: 'PARAM_REQUIRED' };
  }

  let projectSnap: any = null;
  let isMock = false;

  try {
    projectSnap = await adminDb.collection('projects').doc(projectId).get();
  } catch (err: any) {
    if (isPermissionOrCredentialError(err)) {
      isMock = true;
    } else {
      return { success: false, error: 'DB_ERROR' };
    }
  }

  if (isMock) {
    const mockP = mockPortalProjects.get(projectId);
    if (!mockP) {
      return { success: false, error: 'PROJECT_NOT_FOUND' };
    }
    if (mockP.ownerId && mockP.ownerId !== ownerUid) {
      return { success: false, error: 'FORBIDDEN' };
    }

    // Boucle de génération et vérification d'unicité
    let token = '';
    let isUnique = false;
    for (let attempts = 0; attempts < 10; attempts++) {
      const candidate = crypto.randomBytes(32).toString('base64url');
      let foundDuplicate = false;
      for (const p of mockPortalProjects.values()) {
        if (p.clientShareToken === candidate && p.id !== projectId) {
          foundDuplicate = true;
          break;
        }
      }
      if (!foundDuplicate) {
        token = candidate;
        isUnique = true;
        break;
      }
    }

    if (!isUnique || !token) {
      return { success: false, error: 'TOKEN_COLLISION' };
    }

    mockP.clientShareToken = token;
    mockP.clientLinkActive = true;
    mockP.updatedAt = new Date().toISOString();
    mockPortalProjects.set(projectId, mockP);
    return { success: true, token };
  }

  if (!projectSnap || !projectSnap.exists) {
    return { success: false, error: 'PROJECT_NOT_FOUND' };
  }

  const projectData = projectSnap.data();
  if (projectData?.ownerId !== ownerUid) {
    return { success: false, error: 'FORBIDDEN' };
  }

  // Boucle de vérification d'unicité dans Firestore
  let token = '';
  let isUnique = false;
  for (let attempts = 0; attempts < 10; attempts++) {
    const candidate = crypto.randomBytes(32).toString('base64url');
    const existingSnap = await adminDb.collection('projects')
      .where('clientShareToken', '==', candidate)
      .limit(1)
      .get();

    if (existingSnap.empty) {
      token = candidate;
      isUnique = true;
      break;
    }
  }

  if (!isUnique || !token) {
    return { success: false, error: 'TOKEN_COLLISION' };
  }

  // Écriture atomique dans Firestore avec invalidation de l'ancien jeton
  await adminDb.collection('projects').doc(projectId).update({
    clientShareToken: token,
    clientLinkActive: true,
    updatedAt: new Date().toISOString()
  });

  return { success: true, token };
}

/**
 * Révoque l'accès au portail client pour un projet (clientLinkActive = false).
 */
export async function revokePortalTokenForProject(
  projectId: string,
  ownerUid: string
): Promise<{ success: boolean; error?: string }> {
  if (!projectId || !ownerUid) {
    return { success: false, error: 'PARAM_REQUIRED' };
  }

  let projectSnap: any = null;
  let isMock = false;

  try {
    projectSnap = await adminDb.collection('projects').doc(projectId).get();
  } catch (err: any) {
    if (isPermissionOrCredentialError(err)) {
      isMock = true;
    } else {
      return { success: false, error: 'DB_ERROR' };
    }
  }

  if (isMock) {
    const mockP = mockPortalProjects.get(projectId);
    if (!mockP) return { success: false, error: 'PROJECT_NOT_FOUND' };
    if (mockP.ownerId && mockP.ownerId !== ownerUid) return { success: false, error: 'FORBIDDEN' };
    mockP.clientLinkActive = false;
    mockP.updatedAt = new Date().toISOString();
    mockPortalProjects.set(projectId, mockP);
    return { success: true };
  }

  if (!projectSnap || !projectSnap.exists) {
    return { success: false, error: 'PROJECT_NOT_FOUND' };
  }

  if (projectSnap.data()?.ownerId !== ownerUid) {
    return { success: false, error: 'FORBIDDEN' };
  }

  await adminDb.collection('projects').doc(projectId).update({
    clientLinkActive: false,
    updatedAt: new Date().toISOString()
  });

  return { success: true };
}

/**
 * Met à jour le statut du lien de partage (actif/inactif).
 */
export async function setPortalLinkStatusForProject(
  projectId: string,
  ownerUid: string,
  active: boolean
): Promise<{ success: boolean; error?: string }> {
  if (!projectId || !ownerUid) {
    return { success: false, error: 'PARAM_REQUIRED' };
  }

  let projectSnap: any = null;
  let isMock = false;

  try {
    projectSnap = await adminDb.collection('projects').doc(projectId).get();
  } catch (err: any) {
    if (isPermissionOrCredentialError(err)) {
      isMock = true;
    } else {
      return { success: false, error: 'DB_ERROR' };
    }
  }

  if (isMock) {
    const mockP = mockPortalProjects.get(projectId);
    if (!mockP) return { success: false, error: 'PROJECT_NOT_FOUND' };
    if (mockP.ownerId && mockP.ownerId !== ownerUid) return { success: false, error: 'FORBIDDEN' };
    mockP.clientLinkActive = active;
    mockP.updatedAt = new Date().toISOString();
    mockPortalProjects.set(projectId, mockP);
    return { success: true };
  }

  if (!projectSnap || !projectSnap.exists) {
    return { success: false, error: 'PROJECT_NOT_FOUND' };
  }

  if (projectSnap.data()?.ownerId !== ownerUid) {
    return { success: false, error: 'FORBIDDEN' };
  }

  await adminDb.collection('projects').doc(projectId).update({
    clientLinkActive: active,
    updatedAt: new Date().toISOString()
  });

  return { success: true };
}




