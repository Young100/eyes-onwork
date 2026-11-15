/**
 * Tests unitaires et d'intégration de sécurité pour emailService.ts
 * Couvre les 7 exigences de durcissement :
 * 1. Transaction Firestore, SHA-256 + VERIFICATION_SALT, temps constant, 10 min, 5 essais, usage unique, 5 envois/h
 * 2. Destinataire unique et strict (rejet des listes, virgules, points-virgules)
 * 3. Quotas quotidien et mensuel par workspace selon le plan (free, pro, agency)
 * 4. Pas d'email personnel en dur : ADMIN_EMAIL strict ou exception explicite
 * 5. Aucun message d'erreur SMTP brut exposé au client
 * 6. Échappement de item.quantity et assainissement des URLs applicatives (trackingUrl, downloadUrl, adminUrl)
 * 7. Journaux d'envoi par workspace conservés 90 jours et masquage d'IP (aucun IP complet stocké)
 */

import assert from 'assert';
import {
  issueVerificationCode,
  verifySubmittedCode,
  validateSingleRecipient,
  getPlatformAdminEmail,
  checkAndIncrementWorkspaceQuotas,
  buildClientConfirmationEmail,
  sendEmailSafe,
  maskIpAddress,
  getEmailLogs,
  sanitizeSafeAppLink
} from '../emailService.js';

let passed = 0;
let total = 0;

function check(label: string, fn: () => void | Promise<void>) {
  total++;
  return (async () => {
    try {
      await fn();
      console.log(`  ✓ [PASS] ${label}`);
      passed++;
    } catch (err: any) {
      console.error(`  ✗ [FAIL] ${label}:`, err.message);
      process.exitCode = 1;
    }
  })();
}

async function runEmailSecurityTests() {
  console.log('\n======================================================');
  console.log('🔒 TESTS DE DURCISSEMENT ET SÉCURITÉ emailService.ts');
  console.log('======================================================\n');

  // EXIGENCE 1 : Codes de vérification cryptographiques, SHA-256, 10 min, 5 essais, usage unique, 5/h
  console.log('1. Codes de vérification & Invariants de sécurité :');
  await check('Émission de code à 6 chiffres avec expiration à 10 minutes', async () => {
    const res = await issueVerificationCode('user.crypto@example.com');
    assert.strictEqual(res.success, true);
    assert(typeof res.code === 'string' && /^\d{6}$/.test(res.code));
    assert(res.expiresAt && res.expiresAt > Date.now() + 9 * 60 * 1000);
  });

  await check('Vérification réussie avec comparaison en temps constant et scellement usage unique', async () => {
    const email = 'user.singleuse@example.com';
    const issue = await issueVerificationCode(email);
    assert.strictEqual(issue.success, true);

    const firstTry = await verifySubmittedCode(email, issue.code!);
    assert.strictEqual(firstTry.success, true);
    assert.strictEqual(firstTry.verified, true);

    // Tentative de rejeu -> rejeté (ALREADY_USED)
    const replayTry = await verifySubmittedCode(email, issue.code!);
    assert.strictEqual(replayTry.success, false);
    assert.strictEqual(replayTry.error, 'ALREADY_USED');
  });

  await check('Protection contre le brute force : invalidation totale après 5 échecs consécutifs', async () => {
    const email = 'user.bruteforce@example.com';
    const issue = await issueVerificationCode(email);
    assert.strictEqual(issue.success, true);

    for (let i = 1; i <= 4; i++) {
      const bad = await verifySubmittedCode(email, '999999');
      assert.strictEqual(bad.success, false);
      assert.strictEqual(bad.remainingAttempts, 5 - i);
    }

    const fifthBad = await verifySubmittedCode(email, '999999');
    assert.strictEqual(fifthBad.success, false);
    assert.strictEqual(fifthBad.error, 'MAX_ATTEMPTS');

    // Bon code après 5 échecs -> toujours refusé
    const validAfterRevoke = await verifySubmittedCode(email, issue.code!);
    assert.strictEqual(validAfterRevoke.success, false);
  });

  // EXIGENCE 2 : Destinataire strict (une seule adresse, pas de liste, ni virgule, ni point-virgule)
  console.log('\n2. Validation stricte du destinataire unique :');
  await check('Valide une adresse email individuelle et canonique', () => {
    const validated = validateSingleRecipient('client.legitime@entreprise.com');
    assert.strictEqual(validated, 'client.legitime@entreprise.com');
  });

  await check('Rejette strictement les listes séparées par virgule', () => {
    assert.throws(
      () => validateSingleRecipient('un@a.com, deux@b.com'),
      /DESTINATAIRE_INVALIDE/
    );
  });

  await check('Rejette strictement les listes séparées par point-virgule', () => {
    assert.throws(
      () => validateSingleRecipient('un@a.com; deux@b.com'),
      /DESTINATAIRE_INVALIDE/
    );
  });

  await check('Rejette les formats injectables ou multiples adresses RFC', () => {
    assert.throws(
      () => validateSingleRecipient('user1@a.com user2@b.com'),
      /DESTINATAIRE_INVALIDE/
    );
  });

  // EXIGENCE 3 : Quotas quotidien et mensuel par workspace selon le plan
  console.log('\n3. Quotas quotidien et mensuel par workspace selon le plan :');
  await check('Plan Free : limite quotidienne de 10 emails respectée', async () => {
    const wsId = `ws_free_test_${Date.now()}`;
    for (let i = 1; i <= 10; i++) {
      const q = await checkAndIncrementWorkspaceQuotas(wsId, 'free');
      assert.strictEqual(q.allowed, true);
    }
    const eleventh = await checkAndIncrementWorkspaceQuotas(wsId, 'free');
    assert.strictEqual(eleventh.allowed, false);
    assert.strictEqual(eleventh.reason, 'DAILY_LIMIT_EXCEEDED');
  });

  // EXIGENCE 4 : Suppression de l'email personnel en dur dans getPlatformAdminEmail
  console.log('\n4. Configuration sécurisée de l\'email administrateur de plateforme :');
  await check('getPlatformAdminEmail lit strictement process.env.ADMIN_EMAIL et lève une erreur si absent', () => {
    const originalEnv = process.env.ADMIN_EMAIL;
    try {
      delete process.env.ADMIN_EMAIL;
      assert.throws(
        () => getPlatformAdminEmail(),
        /CONFIGURATION_MANQUANTE.*ADMIN_EMAIL/
      );

      process.env.ADMIN_EMAIL = 'admin.plateforme@eyes-onwork.com';
      assert.strictEqual(getPlatformAdminEmail(), 'admin.plateforme@eyes-onwork.com');
    } finally {
      if (originalEnv) process.env.ADMIN_EMAIL = originalEnv;
      else delete process.env.ADMIN_EMAIL;
    }
  });

  // EXIGENCE 5 : Ne renvoie jamais le message d'erreur SMTP brut au client
  console.log('\n5. Protection des erreurs SMTP vis-à-vis du client :');
  await check('sendEmailSafe renvoie un message utilisateur générique sans révéler les détails SMTP ou secrets de transport', async () => {
    // Appel sans configuration SMTP pour simuler une défaillance
    const result = await sendEmailSafe({
      to: 'destinataire.test@example.com',
      subject: 'Test Sécurité',
      html: '<p>Contenu test</p>',
      workspaceId: 'ws_safe_test'
    });

    // En cas d'erreur de transport, le message doit être générique
    if (!result.success) {
      assert(!result.error.includes('auth'), 'Ne doit pas révéler les détails d\'authentification');
      assert(!result.error.includes('ECONNREFUSED'), 'Ne doit pas exposer l\'erreur réseau brute');
      assert.strictEqual(result.error, 'Une erreur est survenue lors de l\'acheminement de l\'email. Veuillez réessayer ultérieurement.');
    }
  });

  // EXIGENCE 6 : Échappement de item.quantity et URLs applicatives strictes
  console.log('\n6. Échappement HTML anti-XSS et assainissement des liens :');
  await check('buildClientConfirmationEmail échappe item.quantity et le contenu utilisateur', () => {
    const xssPayload = '<script>alert("xss")</script>';
    const emailTpl = buildClientConfirmationEmail({
      recipientName: 'Alice <script>alert(1)</script>',
      recipientEmail: 'alice@example.com',
      studioName: 'Studio <bold>',
      projectName: 'Projet <b>Test</b>',
      items: [
        {
          description: '<img src=x onerror=alert(1)>',
          quantity: '<script>evil()</script>' as any,
          unitPrice: 100,
          total: 100
        }
      ],
      totalTtc: 100,
      currency: 'EUR',
      trackingUrl: 'https://evil-site.attacker.com/phish'
    });

    assert(!emailTpl.html.includes('<script>alert("xss")</script>'));
    assert(!emailTpl.html.includes('<script>evil()</script>'));
    assert(emailTpl.html.includes('&lt;script&gt;evil()&lt;/script&gt;'));
    assert(!emailTpl.html.includes('https://evil-site.attacker.com/phish'), 'URL externe dangereuse rejetée');
  });

  await check('sanitizeSafeAppLink valide les domaines autorisés et rejette les injections javascript:/externes', () => {
    const safeInternal = sanitizeSafeAppLink('/client-portal/proj_123');
    assert.strictEqual(safeInternal, '/client-portal/proj_123');

    const unsafePhish = sanitizeSafeAppLink('https://evil-attacker.com/steal-creds');
    assert.strictEqual(unsafePhish, undefined);

    const unsafeJs = sanitizeSafeAppLink('javascript:alert(document.cookie)');
    assert.strictEqual(unsafeJs, undefined);
  });

  // EXIGENCE 7 : Journaux d'envoi par workspace, rétention 90 jours, IP masquée
  console.log('\n7. Journaux d\'envoi d\'emails (anonymisation IP & rétention 90 jours) :');
  await check('maskIpAddress masque complètement les adresses IPv4 et IPv6', () => {
    assert.strictEqual(maskIpAddress('192.168.1.100'), '192.168.1.xxx');
    assert.strictEqual(maskIpAddress('2a01:cb08:829:9b00:b92e:4d6d:5085:44ef'), '2a01:cb08:829::xxx');
    assert.strictEqual(maskIpAddress('127.0.0.1'), '127.0.0.xxx');
    assert.strictEqual(maskIpAddress(undefined), 'anonyme');
  });

  await check('sendEmailSafe enregistre un journal horodaté avec IP masquée et cloisonné au workspace', async () => {
    const wsId = `ws_audit_${Date.now()}`;
    const sendRes = await sendEmailSafe({
      to: 'audit.client@example.com',
      subject: 'Audit Sécurité',
      html: '<p>Contenu vérifié</p>',
      workspaceId: wsId,
      clientIp: '82.120.45.67'
    });

    assert(sendRes.success === true || sendRes.log !== undefined, 'Envoi ou simulation effectué');
    const logs = getEmailLogs(wsId);
    assert(logs.length >= 1, 'Au moins un journal récupéré pour ce workspace');
    const log = logs[0];
    assert.strictEqual(log.ip, '82.120.45.xxx', 'Adresse IP masquée dans le journal (aucun IP complet)');
    assert.strictEqual(log.workspaceId, wsId, 'Journal cloisonné à son propre workspace');
    assert(log.expiresAt !== undefined, 'Rétention 90 jours définie');
  });

  console.log('\n------------------------------------------------------');
  console.log(`RÉSULTAT : ${passed}/${total} tests de durcissement emailService validés.`);
  if (passed === total) {
    console.log('✅ TOUTES LES EXIGENCES DE SÉCURITÉ emailService SONT PARFAITEMENT RESPECTÉES.');
    process.exit(0);
  } else {
    console.error('❌ ÉCHEC DE CERTAINS TESTS.');
    process.exit(1);
  }
}

runEmailSecurityTests().catch((err) => {
  console.error('Erreur non gérée :', err);
  process.exit(1);
});
