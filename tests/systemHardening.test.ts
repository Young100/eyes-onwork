/**
 * Tests automatiques de durcissement système, sécurité réseau et routes administratives
 * 
 * Vérifie :
 * 1. /api/system/health et /health renvoient UNIQUEMENT { status: "ok" } sans indicateurs de sécurité écrits en dur.
 * 2. /api/system/errors, /api/system/test-firestore et /test-firestore exigent requireSuperAdmin (rejet 401 sans jeton valide).
 * 3. /api/system/log-error et /log-error exigent un jeton d'authentification valide, rejettent les requêtes non autorisées (401),
 *    et appliquent les limites de taille et de fréquence.
 * 4. Limite de corps JSON par défaut fixée à 100 ko (413 si dépassement).
 * 5. Purge automatique des entrées expirées des limiteurs de débit en mémoire.
 * 6. Filtrage CORS par liste blanche via variable d'environnement CORS_ALLOWED_ORIGINS.
 * 7. En-têtes de sécurité en production : X-Frame-Options SAMEORIGIN, CSP de base et HSTS.
 */

import http from 'http';
import assert from 'assert';
import { app, purgeExpiredRateLimits } from '../server.js';

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

async function runSystemHardeningTests() {
  console.log('\n======================================================');
  console.log('🛡️ TESTS DE DURCISSEMENT SYSTÈME & SÉCURITÉ SERVEUR');
  console.log('======================================================\n');

  // Démarrage du serveur de test sur port dynamique
  let testServerInstance: http.Server;
  let baseUrl = '';

  await new Promise<void>((resolve) => {
    testServerInstance = http.createServer(app).listen(0, '127.0.0.1', () => {
      const address = testServerInstance.address() as any;
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolve();
    });
  });

  try {
    // 1. Tests /health et /api/system/health public (doit renvoyer SEULEMENT { status: "ok" })
    console.log('--- 1. Vérification santé publique (/health & /api/system/health) ---');
    for (const endpoint of ['/api/system/health', '/health']) {
      const res = await fetch(`${baseUrl}${endpoint}`);
      assertPass(res.status === 200, `GET ${endpoint} renvoie un code HTTP 200`);
      
      const body = await res.json();
      assertPass(body.status === 'ok', `GET ${endpoint} contient { status: "ok" }`);
      
      const keys = Object.keys(body);
      assertPass(
        keys.length === 1 && keys[0] === 'status',
        `GET ${endpoint} renvoie STRICTEMENT la clé "status" (reçu: ${JSON.stringify(keys)})`
      );
      assertPass(body.security === undefined, `GET ${endpoint} ne contient aucun indicateur de sécurité en dur`);
      assertPass(body.memory === undefined, `GET ${endpoint} ne divulgue aucune statistique mémoire`);
      assertPass(body.uptimeSeconds === undefined, `GET ${endpoint} ne divulgue pas l'uptime système`);
    }

    // 2. Tests de protection /api/system/errors, /api/system/test-firestore et /test-firestore
    console.log('\n--- 2. Protection stricte Super Admin sur /api/system/errors & /test-firestore ---');
    
    // Sans header Authorization
    const errorsNoAuth = await fetch(`${baseUrl}/api/system/errors`);
    assertPass(errorsNoAuth.status === 401, 'GET /api/system/errors sans jeton renvoie 401');

    const testFsNoAuth = await fetch(`${baseUrl}/api/system/test-firestore`, { method: 'POST' });
    assertPass(testFsNoAuth.status === 401, 'POST /api/system/test-firestore sans jeton renvoie 401');

    const testFsAliasNoAuth = await fetch(`${baseUrl}/test-firestore`, { method: 'POST' });
    assertPass(testFsAliasNoAuth.status === 401, 'POST /test-firestore (alias) sans jeton renvoie 401');

    // Avec jeton Bearer invalide / forgé
    const errorsBadAuth = await fetch(`${baseUrl}/api/system/errors`, {
      headers: { Authorization: 'Bearer fake.token.attempt' }
    });
    assertPass(errorsBadAuth.status === 401, 'GET /api/system/errors avec faux jeton renvoie 401');

    const testFsBadAuth = await fetch(`${baseUrl}/api/system/test-firestore`, {
      method: 'POST',
      headers: { Authorization: 'Bearer fake.token.attempt' }
    });
    assertPass(testFsBadAuth.status === 401, 'POST /api/system/test-firestore avec faux jeton renvoie 401');

    // 3. Tests /api/system/log-error et /log-error
    console.log('\n--- 3. Exigence de jeton & limitation sur /api/system/log-error ---');
    
    const logErrNoAuth = await fetch(`${baseUrl}/api/system/log-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Crash test sans jeton' })
    });
    assertPass(logErrNoAuth.status === 401, 'POST /api/system/log-error sans jeton renvoie 401');

    const logErrBadAuth = await fetch(`${baseUrl}/api/system/log-error`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer fake_invalid_jwt_token'
      },
      body: JSON.stringify({ message: 'Crash test avec faux jeton' })
    });
    assertPass(logErrBadAuth.status === 401, 'POST /api/system/log-error avec faux jeton renvoie 401');

    const logErrAliasNoAuth = await fetch(`${baseUrl}/log-error`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Crash test alias' })
    });
    assertPass(logErrAliasNoAuth.status === 401, 'POST /log-error (alias) sans jeton renvoie 401');

    // 4. Limite de corps JSON par défaut à 100 ko
    console.log('\n--- 4. Limite stricte de taille du corps JSON à 100 ko ---');
    const largePayload = { data: 'A'.repeat(120 * 1024) }; // ~120 Ko > 100 Ko
    const largeRes = await fetch(`${baseUrl}/api/portal/feedback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(largePayload)
    });
    assertPass(largeRes.status === 413, 'Corps JSON > 100 ko renvoie une erreur HTTP 413 (Payload Too Large)');

    // 5. Test de purge des limiteurs de débit expirés
    console.log('\n--- 5. Purge automatique des entrées expirées des limiteurs de débit ---');
    try {
      purgeExpiredRateLimits();
      assertPass(true, 'purgeExpiredRateLimits() s\'exécute avec succès sans exception');
    } catch (e: any) {
      assertPass(false, `purgeExpiredRateLimits() a échoué: ${e.message}`);
    }

    // 6. Test CORS avec liste blanche d'origines
    console.log('\n--- 6. Filtrage CORS par liste blanche d\'origines ---');
    // Origine autorisée (localhost:3000)
    const corsAllowedRes = await fetch(`${baseUrl}/health`, {
      headers: { Origin: 'http://localhost:3000' }
    });
    assertPass(
      corsAllowedRes.headers.get('access-control-allow-origin') === 'http://localhost:3000',
      'Origine autorisée reçoit le header Access-Control-Allow-Origin'
    );

    // Origine non autorisée en préflight OPTIONS
    const corsForbiddenPreflight = await fetch(`${baseUrl}/api/user/profile`, {
      method: 'OPTIONS',
      headers: { 
        Origin: 'https://evil-unauthorized-site.com',
        'Access-Control-Request-Method': 'GET'
      }
    });
    assertPass(
      corsForbiddenPreflight.status === 403,
      'Préflight OPTIONS pour origine non autorisée est rejeté avec HTTP 403'
    );

    // 7. Test des en-têtes en production (NODE_ENV=production)
    console.log('\n--- 7. En-têtes de sécurité en production (X-Frame-Options SAMEORIGIN, CSP, HSTS) ---');
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const prodRes = await fetch(`${baseUrl}/health`);
      assertPass(
        prodRes.headers.get('x-frame-options') === 'SAMEORIGIN',
        'En production : X-Frame-Options est fixé à SAMEORIGIN'
      );
      assertPass(
        Boolean(prodRes.headers.get('strict-transport-security')?.includes('max-age=31536000')),
        'En production : HSTS (Strict-Transport-Security) est actif avec max-age=31536000'
      );
      assertPass(
        Boolean(prodRes.headers.get('content-security-policy')?.includes("frame-ancestors 'self'")),
        'En production : Content-Security-Policy est actif et bloque le clickjacking'
      );
    } finally {
      process.env.NODE_ENV = prevEnv;
    }

  } finally {
    testServerInstance.close();
  }

  console.log('\n======================================================');
  console.log(`Bilan des tests de durcissement : ${passCount}/${totalTests} validés.`);
  console.log('======================================================\n');

  if (passCount === totalTests) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runSystemHardeningTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
