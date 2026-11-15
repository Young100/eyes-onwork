/**
 * Tests automatiques de sécurité des jetons Firebase (Zero Trust)
 * 
 * Vérifie que :
 * 1. Jeton inventé
 * 2. Jeton expiré
 * 3. Jeton d'un autre projet
 * 4. Jeton sans signature
 * 
 * Renvoient TOUS une erreur HTTP 401 sur :
 * - /api/user/profile (GET et POST)
 * - /api/admin/set-claim (POST)
 * 
 * Et que verifyFirebaseToken() rejette systématiquement sans décodage permissif.
 */

import assert from 'assert';
import http from 'http';
import { verifyFirebaseToken } from '../src/server/firebaseAdminSdk.js';
import { app } from '../server.js';

let BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';

function base64UrlEncode(obj: any): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

// 1. Jeton inventé de toutes pièces avec fausse signature
const headerValid = { alg: 'RS256', typ: 'JWT', kid: 'fake_key_id_999' };
const inventedToken = `${base64UrlEncode(headerValid)}.${base64UrlEncode({
  iss: 'https://securetoken.google.com/eyes-onwork-gestionpro',
  aud: 'eyes-onwork-gestionpro',
  auth_time: Math.floor(Date.now() / 1000) - 60,
  user_id: 'invented_user_fake_123',
  sub: 'invented_user_fake_123',
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 3600,
  email: 'invented@fake-hacker.com',
  email_verified: true,
  role: 'superadmin',
  isSuperAdmin: true
})}.completely_fake_signature_unverified_by_google_certs`;

// 2. Jeton expiré (expirant en 2020)
const expiredToken = `${base64UrlEncode(headerValid)}.${base64UrlEncode({
  iss: 'https://securetoken.google.com/eyes-onwork-gestionpro',
  aud: 'eyes-onwork-gestionpro',
  auth_time: 1577836800,
  user_id: 'expired_user_456',
  sub: 'expired_user_456',
  iat: 1577836800,
  exp: 1577840400, // 1er janvier 2020
  email: 'expired@studio.fr',
  email_verified: true
})}.signature_expired_token_abc`;

// 3. Jeton émis pour un autre projet Google Cloud / Firebase
const otherProjectToken = `${base64UrlEncode(headerValid)}.${base64UrlEncode({
  iss: 'https://securetoken.google.com/rogue-attacker-project',
  aud: 'rogue-attacker-project',
  auth_time: Math.floor(Date.now() / 1000) - 60,
  user_id: 'rogue_user_789',
  sub: 'rogue_user_789',
  iat: Math.floor(Date.now() / 1000) - 60,
  exp: Math.floor(Date.now() / 1000) + 3600,
  email: 'rogue@attacker.org',
  email_verified: true,
  role: 'superadmin',
  isSuperAdmin: true
})}.signature_other_project_xyz`;

// 4. Jeton sans signature (ou algorithme none)
const unsignedToken = `${base64UrlEncode({ alg: 'none', typ: 'JWT' })}.${base64UrlEncode({
  iss: 'https://securetoken.google.com/eyes-onwork-gestionpro',
  aud: 'eyes-onwork-gestionpro',
  user_id: 'unsigned_user_000',
  sub: 'unsigned_user_000',
  email: 'unsigned@test.com',
  role: 'superadmin',
  isSuperAdmin: true
})}.`;

const testCases = [
  { name: '1. Jeton inventé (signature invalide)', token: inventedToken },
  { name: '2. Jeton expiré (timestamp passé)', token: expiredToken },
  { name: '3. Jeton d\'un autre projet (aud / iss étranger)', token: otherProjectToken },
  { name: '4. Jeton sans signature (alg: none ou 3e segment vide)', token: unsignedToken }
];

let passCount = 0;
let totalTests = 0;

function assertPass(condition: boolean, desc: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ [PASS] ${desc}`);
    passCount++;
  } else {
    console.error(`  ✗ [FAIL] ${desc}`);
    process.exitCode = 1;
  }
}

async function runTokenSecuritySuite() {
  console.log('==================================================================');
  console.log('🔒 TESTS AUTOMATIQUES DE SÉCURITÉ ZERO-TRUST DES JETONS (HTTP 401)');
  console.log('==================================================================\n');

  // A. Tests unitaires stricts de verifyFirebaseToken()
  console.log('--- A. Rejet unitaire strict par verifyFirebaseToken (aucun décodage manuel) ---');
  for (const tc of testCases) {
    let threw = false;
    try {
      await verifyFirebaseToken(tc.token);
    } catch {
      threw = true;
    }
    assertPass(threw, `verifyFirebaseToken rejette fermement: ${tc.name}`);
  }

  // B. Tests HTTP d'intégration sur les endpoints cibles
  console.log('\n--- B. Rejet HTTP 401 sur /api/user/profile et /api/admin/set-claim ---');

  let testServerInstance: http.Server | null = null;
  try {
    await fetch(`${BASE_URL}/api/system/health`, { signal: AbortSignal.timeout(1000) });
  } catch {
    // Port 3000 pas joignable en local, démarre le serveur de test sur un port dynamique
    await new Promise<void>((resolve) => {
      testServerInstance = http.createServer(app).listen(0, '127.0.0.1', () => {
        const address = testServerInstance!.address() as any;
        BASE_URL = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  }

  for (const tc of testCases) {
    console.log(`\nTest pour: ${tc.name}`);

    // 1. GET /api/user/profile
    try {
      const resGetProfile = await fetch(`${BASE_URL}/api/user/profile`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${tc.token}` }
      });
      const dataGetProfile = await resGetProfile.json().catch(() => ({}));
      assertPass(
        resGetProfile.status === 401,
        `GET /api/user/profile renvoie 401 (reçu: ${resGetProfile.status})`
      );
      assertPass(
        dataGetProfile.error === 'INVALID_TOKEN' || dataGetProfile.error === 'UNAUTHORIZED',
        `GET /api/user/profile message d'erreur conforme (${dataGetProfile.error || 'vide'})`
      );
    } catch (err: any) {
      assertPass(false, `GET /api/user/profile exception réseau: ${err.message}`);
    }

    // 2. POST /api/user/profile
    try {
      const resPostProfile = await fetch(`${BASE_URL}/api/user/profile`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tc.token}`
        },
        body: JSON.stringify({ displayName: 'Attacker' })
      });
      assertPass(
        resPostProfile.status === 401,
        `POST /api/user/profile renvoie 401 (reçu: ${resPostProfile.status})`
      );
    } catch (err: any) {
      assertPass(false, `POST /api/user/profile exception réseau: ${err.message}`);
    }

    // 3. POST /api/admin/set-claim
    try {
      const resAdminClaim = await fetch(`${BASE_URL}/api/admin/set-claim`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${tc.token}`
        },
        body: JSON.stringify({ targetUid: 'target_123', isSuperAdmin: true })
      });
      const dataAdminClaim = await resAdminClaim.json().catch(() => ({}));
      assertPass(
        resAdminClaim.status === 401,
        `POST /api/admin/set-claim renvoie 401 (reçu: ${resAdminClaim.status})`
      );
      assertPass(
        dataAdminClaim.error === 'INVALID_TOKEN' || dataAdminClaim.error === 'UNAUTHORIZED',
        `POST /api/admin/set-claim message d'erreur conforme (${dataAdminClaim.error || 'vide'})`
      );
    } catch (err: any) {
      assertPass(false, `POST /api/admin/set-claim exception réseau: ${err.message}`);
    }
  }

  console.log(`\n==================================================================`);
  console.log(`Résultats: ${passCount}/${totalTests} tests validés avec succès.`);
  console.log(`==================================================================`);

  if (testServerInstance) {
    (testServerInstance as http.Server).close();
  }

  if (passCount !== totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTokenSecuritySuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
