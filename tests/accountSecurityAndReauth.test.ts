import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildProviderLinkedAlertEmail } from '../emailService.js';
import {
  notifyProviderLinkedIfNew,
  revokeAllSessionsAndSecureAccount,
  cleanupStaleUnverifiedAccountByEmail,
  cleanupExpiredUnverifiedAccounts,
  UNVERIFIED_ACCOUNT_MAX_AGE_MS
} from '../src/server/accountSecurity.js';

interface MockDoc {
  id: string;
  data: Record<string, any>;
}

function createInMemoryDb(initial: Record<string, Record<string, Record<string, any>>> = {}) {
  const store = new Map<string, Map<string, Record<string, any>>>();
  for (const [col, docs] of Object.entries(initial)) {
    const map = new Map<string, Record<string, any>>();
    for (const [id, data] of Object.entries(docs)) {
      map.set(id, { ...data });
    }
    store.set(col, map);
  }

  const getCol = (name: string) => {
    if (!store.has(name)) store.set(name, new Map());
    return store.get(name)!;
  };

  return {
    store,
    collection(name: string) {
      const colMap = getCol(name);
      return {
        doc(id: string) {
          return {
            async get() {
              const existing = colMap.get(id);
              return {
                exists: Boolean(existing),
                id,
                data: () => (existing ? { ...existing } : undefined)
              };
            },
            async set(data: any, opts?: { merge?: boolean }) {
              const prev = opts?.merge ? colMap.get(id) || {} : {};
              colMap.set(id, { ...prev, ...data });
            },
            async update(data: any) {
              const prev = colMap.get(id);
              if (!prev) throw new Error(`Doc ${name}/${id} not found`);
              colMap.set(id, { ...prev, ...data });
            },
            async delete() {
              colMap.delete(id);
            }
          };
        },
        where(field: string, _op: string, value: any) {
          return {
            async get() {
              const matched: Array<{ id: string; data: () => Record<string, any>; ref: { delete: () => Promise<void> } }> = [];
              for (const [docId, docData] of colMap.entries()) {
                if (docData[field] === value) {
                  matched.push({
                    id: docId,
                    data: () => ({ ...docData }),
                    ref: {
                      async delete() {
                        colMap.delete(docId);
                      }
                    }
                  });
                }
              }
              return { docs: matched, empty: matched.length === 0 };
            }
          };
        }
      };
    }
  };
}

function createMockAuth(usersList: any[]) {
  const users = new Map<string, any>();
  const revokedUids: string[] = [];
  const deletedUids: string[] = [];

  for (const u of usersList) {
    users.set(u.uid, { ...u });
  }

  return {
    users,
    revokedUids,
    deletedUids,
    async getUser(uid: string) {
      const u = users.get(uid);
      if (!u) {
        const err: any = new Error('User not found');
        err.code = 'auth/user-not-found';
        throw err;
      }
      return { ...u };
    },
    async getUserByEmail(email: string) {
      const clean = email.trim().toLowerCase();
      for (const u of users.values()) {
        if ((u.email || '').toLowerCase() === clean) return { ...u };
      }
      const err: any = new Error('User not found');
      err.code = 'auth/user-not-found';
      throw err;
    },
    async listUsers() {
      return { users: Array.from(users.values()).map(u => ({ ...u })) };
    },
    async revokeRefreshTokens(uid: string) {
      revokedUids.push(uid);
    },
    async deleteUser(uid: string) {
      if (!users.has(uid)) {
        const err: any = new Error('User not found');
        err.code = 'auth/user-not-found';
        throw err;
      }
      users.delete(uid);
      deletedUids.push(uid);
    }
  };
}

async function runTests() {
  const fixedNow = Date.UTC(2026, 4, 10, 12, 0, 0);

  // =========================================================================
  // 1. Gabarit email d'avertissement liaison Google / Mot de passe
  // =========================================================================
  {
    const googleLinkedMail = buildProviderLinkedAlertEmail({
      recipientEmail: 'studio@exemple.fr',
      studioName: 'Atelier <Test>',
      providerName: 'Google',
      secureAccountUrl: 'https://eyes-onwork.run.app/?securityAction=secureAccount&token=tok_123'
    });

    assert.ok(
      googleLinkedMail.text.includes("Google a été relié à votre compte. Ce n'était pas vous ?"),
      'Le mail doit contenir le message d’avertissement exact Google relié'
    );
    assert.ok(googleLinkedMail.text.includes('Sécuriser mon compte'), 'CTA Sécuriser mon compte présent en texte');
    assert.ok(googleLinkedMail.html.includes('Sécuriser mon compte'), 'CTA Sécuriser mon compte présent en HTML');
    assert.ok(!googleLinkedMail.html.includes('Atelier <Test>'), 'XSS échappé dans le nom du studio');
    assert.ok(
      googleLinkedMail.html.includes('securityAction=secureAccount&amp;token=tok_123') ||
        googleLinkedMail.html.includes('securityAction=secureAccount&token=tok_123'),
      'Lien sécurisé inclus'
    );

    const passwordLinkedMail = buildProviderLinkedAlertEmail({
      recipientEmail: 'studio@exemple.fr',
      studioName: 'Atelier Test',
      providerName: 'Mot de passe',
      secureAccountUrl: 'https://eyes-onwork.run.app/?securityAction=secureAccount&token=tok_456'
    });
    assert.ok(passwordLinkedMail.text.includes('Mot de passe'), 'Avertissement clair lors de l’ajout d’un mot de passe sur un compte Google');
  }

  // =========================================================================
  // 2. Notification automatique lors de l'ajout d'un fournisseur + révocation globale
  // =========================================================================
  {
    const db = createInMemoryDb({
      users: {
        u1: {
          uid: 'u1',
          email: 'createur@studio.fr',
          studioName: 'Studio Éclat',
          knownProviders: ['password'],
          workspaceId: 'ws_1'
        }
      }
    });
    const auth = createMockAuth([
      {
        uid: 'u1',
        email: 'createur@studio.fr',
        emailVerified: true,
        providerData: [{ providerId: 'password' }, { providerId: 'google.com' }],
        metadata: { creationTime: new Date(fixedNow - 48 * 3600 * 1000).toISOString() }
      }
    ]);

    const sentEmails: any[] = [];
    const deps = {
      db: db as any,
      auth: auth as any,
      nowMs: () => fixedNow,
      sendEmail: async (payload: any) => {
        sentEmails.push(payload);
        return { success: true, mode: 'simulation' as const };
      }
    };

    const res1 = await notifyProviderLinkedIfNew(
      {
        uid: 'u1',
        email: 'createur@studio.fr',
        origin: 'https://eyes-onwork.run.app',
        currentProviders: ['password', 'google.com']
      },
      deps
    );

    assert.equal(res1.notified, true);
    assert.equal(res1.addedProvider, 'google');
    assert.equal(sentEmails.length, 1);
    assert.ok(sentEmails[0].text.includes("Google a été relié à votre compte. Ce n'était pas vous ?"));
    assert.ok(sentEmails[0].text.includes('Sécuriser mon compte'));
    assert.ok(res1.secureAccountUrl && res1.secureAccountUrl.includes('securityAction=secureAccount'));

    // Idempotence : un second appel pour le même fournisseur déjà connu ne renvoie pas en double
    const resDuplicate = await notifyProviderLinkedIfNew(
      {
        uid: 'u1',
        email: 'createur@studio.fr',
        origin: 'https://app.eyes-onwork.fr',
        currentProviders: ['password', 'google.com']
      },
      deps
    );
    assert.equal(resDuplicate.notified, false);
    assert.equal(sentEmails.length, 1);

    // Extraction du jeton et clic sur "Sécuriser mon compte"
    const urlObj = new URL(res1.secureAccountUrl!);
    const rawToken = urlObj.searchParams.get('token')!;
    assert.ok(rawToken.length > 20);

    const revokeRes = await revokeAllSessionsAndSecureAccount({ token: rawToken }, deps);
    assert.equal(revokeRes.success, true);
    assert.equal(revokeRes.sessionsRevoked, true);
    assert.equal(revokeRes.email, 'createur@studio.fr');
    assert.equal(revokeRes.hasPasswordProvider, true);
    assert.deepEqual(auth.revokedUids, ['u1'], 'adminAuth.revokeRefreshTokens doit être appelé côté serveur');

    // Jeton à usage unique : une seconde tentative échoue
    const replayRes = await revokeAllSessionsAndSecureAccount({ token: rawToken }, deps);
    assert.equal(replayRes.success, false);
    assert.equal(replayRes.error, 'TOKEN_ALREADY_USED');
  }

  // =========================================================================
  // 3. Nettoyage automatique des comptes email non vérifiés > 24h
  // =========================================================================
  {
    const staleCreatedIso = new Date(fixedNow - (UNVERIFIED_ACCOUNT_MAX_AGE_MS + 3600 * 1000)).toISOString(); // 25h
    const freshCreatedIso = new Date(fixedNow - 2 * 3600 * 1000).toISOString(); // 2h

    const db = createInMemoryDb({
      users: {
        uid_stale: { uid: 'uid_stale', email: 'stale@test.fr', emailVerified: false, createdAt: staleCreatedIso },
        uid_fresh: { uid: 'uid_fresh', email: 'fresh@test.fr', emailVerified: false, createdAt: freshCreatedIso },
        uid_verified: { uid: 'uid_verified', email: 'verified@test.fr', emailVerified: true, createdAt: staleCreatedIso },
        uid_google: { uid: 'uid_google', email: 'google@test.fr', emailVerified: false, createdAt: staleCreatedIso }
      },
      workspaces: {
        ws_stale: { id: 'ws_stale', ownerId: 'uid_stale' },
        ws_fresh: { id: 'ws_fresh', ownerId: 'uid_fresh' }
      },
      clients: {
        cl_stale: { id: 'cl_stale', ownerId: 'uid_stale' }
      }
    });

    const auth = createMockAuth([
      {
        uid: 'uid_stale',
        email: 'stale@test.fr',
        emailVerified: false,
        providerData: [{ providerId: 'password' }],
        metadata: { creationTime: staleCreatedIso }
      },
      {
        uid: 'uid_fresh',
        email: 'fresh@test.fr',
        emailVerified: false,
        providerData: [{ providerId: 'password' }],
        metadata: { creationTime: freshCreatedIso }
      },
      {
        uid: 'uid_verified',
        email: 'verified@test.fr',
        emailVerified: true,
        providerData: [{ providerId: 'password' }],
        metadata: { creationTime: staleCreatedIso }
      },
      {
        uid: 'uid_google',
        email: 'google@test.fr',
        emailVerified: false,
        providerData: [{ providerId: 'google.com' }],
        metadata: { creationTime: staleCreatedIso }
      }
    ]);

    const deps = { db: db as any, auth: auth as any, nowMs: () => fixedNow };

    // Balayage planifié : seul uid_stale (>24h et non vérifié email/password) est purgé
    const sweepRes = await cleanupExpiredUnverifiedAccounts(UNVERIFIED_ACCOUNT_MAX_AGE_MS, deps);
    assert.equal(sweepRes.deletedCount, 1);
    assert.deepEqual(sweepRes.deletedUids, ['uid_stale']);
    assert.deepEqual(auth.deletedUids, ['uid_stale']);
    assert.equal(db.store.get('users')!.has('uid_stale'), false);
    assert.equal(db.store.get('workspaces')!.has('ws_stale'), false);
    assert.equal(db.store.get('clients')!.has('cl_stale'), false);
    assert.equal(db.store.get('users')!.has('uid_fresh'), true, 'Compte <24h conservé');
    assert.equal(db.store.get('users')!.has('uid_verified'), true, 'Compte vérifié conservé');
    assert.equal(db.store.get('users')!.has('uid_google'), true, 'Compte Google conservé');

    // Nettoyage à la demande avant inscription / Google sign-in :
    // - Ne nettoie pas un compte <24h ou vérifié (réponse neutre cleaned: false)
    const freshCheck = await cleanupStaleUnverifiedAccountByEmail('fresh@test.fr', UNVERIFIED_ACCOUNT_MAX_AGE_MS, deps);
    assert.equal(freshCheck.cleaned, false);

    // - Un autre compte non vérifié >24h non encore balayé est immédiatement purgé pour ne jamais bloquer inscription ou Google
    auth.users.set('uid_blocker', {
      uid: 'uid_blocker',
      email: 'blocker@test.fr',
      emailVerified: false,
      providerData: [{ providerId: 'password' }],
      metadata: { creationTime: staleCreatedIso }
    });
    await db.collection('users').doc('uid_blocker').set({ uid: 'uid_blocker', email: 'blocker@test.fr', emailVerified: false });

    const blockerCheck = await cleanupStaleUnverifiedAccountByEmail('blocker@test.fr', UNVERIFIED_ACCOUNT_MAX_AGE_MS, deps);
    assert.equal(blockerCheck.cleaned, true);
    assert.equal(auth.users.has('uid_blocker'), false, 'Le compte expiré >24h a été supprimé pour débloquer Google/Inscription');
  }

  // =========================================================================
  // 4. Audit statique des 4 actions sensibles + absence d'alert() et de bouchon
  // =========================================================================
  {
    const appCtxSrc = fs.readFileSync(path.join(process.cwd(), 'src/context/AppContext.tsx'), 'utf8');
    const secViewSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/settings/SecuritySettingsView.tsx'), 'utf8');
    const subViewSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/subscription/SubscriptionView.tsx'), 'utf8');
    const reauthModalSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/common/ReauthModal.tsx'), 'utf8');
    const serverSrc = fs.readFileSync(path.join(process.cwd(), 'server.ts'), 'utf8');

    assert.ok(appCtxSrc.includes('reauthenticateWithCredential'), 'reauthenticateWithCredential utilisé dans AppContext');
    assert.ok(appCtxSrc.includes('reauthenticateWithPopup'), 'reauthenticateWithPopup utilisé pour Google');
    assert.ok(appCtxSrc.includes('EmailAuthProvider.credential'), 'EmailAuthProvider.credential utilisé');
    assert.ok(appCtxSrc.includes('updatePassword'), 'updatePassword utilisé');
    assert.ok(appCtxSrc.includes('verifyBeforeUpdateEmail'), 'verifyBeforeUpdateEmail utilisé');

    assert.ok(!secViewSrc.includes('alert('), 'Aucun appel window.alert dans SecuritySettingsView');
    assert.ok(secViewSrc.includes('<ReauthModal'), 'SecuritySettingsView protège les actions par ReauthModal');
    assert.ok(subViewSrc.includes('<ReauthModal'), 'SubscriptionView protège export données par ReauthModal');
    assert.ok(reauthModalSrc.includes('reauthenticateWithGoogle'), 'ReauthModal supporte la fenêtre Google');
    assert.ok(serverSrc.includes('/api/account/delete') && serverSrc.includes('auth_time'), 'Route /api/account/delete vérifie la fraîcheur auth_time');
    assert.ok(serverSrc.includes('/api/auth/secure-account'), 'Route /api/auth/secure-account câblée');
    assert.ok(serverSrc.includes('startUnverifiedAccountCleanupScheduler()'), 'Nettoyage 24h planifié au démarrage');
  }

  console.log('✅ All account security, provider-linking alert, reauthentication, and 24h stale cleanup tests passed.');
}

runTests().catch(err => {
  console.error('❌ Test failure:', err);
  process.exit(1);
});
