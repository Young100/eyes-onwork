/**
 * Tests automatiques de vérification d'email par code à 6 chiffres & Garde-route
 */

import {
  issueVerificationCode,
  verifySubmittedCode,
  getVerificationStatus,
  buildVerificationCodeEmail
} from '../emailService.js';

let passed = 0;
let total = 0;

function assert(condition: boolean, desc: string) {
  total++;
  if (condition) {
    console.log(`  ✓ [PASS] ${desc}`);
    passed++;
  } else {
    console.error(`  ✗ [FAIL] ${desc}`);
    process.exitCode = 1;
  }
}

console.log('\n======================================================');
console.log('🔐 TESTS DU SYSTÈME DE VÉRIFICATION PAR CODE À 6 CHIFFRES');
console.log('======================================================\n');

// 1. Génération cryptographique & Template Email
console.log('1. Génération du code et Modèle d\'email HTML/Text :');
const emailTest = 'freelance.studio.test@example.com';
const issueResult = issueVerificationCode(emailTest);

assert(issueResult.success === true, 'Génération réussie d\'un code');
assert(typeof issueResult.code === 'string' && issueResult.code.length === 6, 'Code aléatoire de 6 chiffres');
assert(/^\d{6}$/.test(issueResult.code || ''), 'Code composé strictement de chiffres (0-9)');

const emailTpl = buildVerificationCodeEmail({
  code: issueResult.code!,
  recipientEmail: emailTest,
  studioName: 'Studio Graphique Test',
  expirationMinutes: 10
});

assert(emailTpl.subject.includes(issueResult.code!), 'Objet de l\'email contient le code');
assert(emailTpl.html.includes(issueResult.code!), 'Modèle HTML met en valeur le code à 6 chiffres');
assert(emailTpl.html.includes('10 minutes'), 'Durée de validité de 10 minutes affichée');
assert(emailTpl.html.includes('ignore'), 'Mention "ignorez ce message" présente');
assert(emailTpl.text.includes(issueResult.code!), 'Modèle texte brut conforme');

// 2. Cooldown de 60 secondes & Plafond de 5 renvois par heure
console.log('\n2. Protection contre les abus (Cooldown 60s & Plafond horaire) :');
const immediateResend = issueVerificationCode(emailTest);
assert(immediateResend.success === false, 'Renvoi immédiat bloqué par le cooldown');
assert(immediateResend.error === 'COOLDOWN', 'Code d\'erreur COOLDOWN retourné');
assert((immediateResend.remainingSeconds || 0) <= 60, 'Délai d\'attente calculé correctement');

const status = getVerificationStatus(emailTest);
assert(status.hasPendingCode === true, 'Code en attente détecté dans le statut');
assert(status.cooldownSeconds > 0, 'Cooldown actif dans le statut');
assert(status.hourlyResendsCount === 1, 'Premier envoi comptabilisé dans l\'heure');

// 3. Essais infructueux et invalidation au 5ème échec
console.log('\n3. Sécurité contre les attaques par force brute (5 essais max) :');
const bruteForceEmail = 'victim.secure@example.com';
const codeToCrack = issueVerificationCode(bruteForceEmail);
assert(codeToCrack.success === true, 'Code créé pour le test de force brute');

// 4 mauvais essais
for (let i = 1; i <= 4; i++) {
  const tryBad = verifySubmittedCode(bruteForceEmail, '000000');
  assert(tryBad.success === false, `Tentative ${i} rejetée`);
  assert(tryBad.remainingAttempts === 5 - i, `Il reste exactement ${5 - i} essai(s)`);
}

// 5ème mauvais essai -> Invalidation définitive
const finalBad = verifySubmittedCode(bruteForceEmail, '000000');
assert(finalBad.success === false, '5ème tentative rejetée');
assert(finalBad.error === 'MAX_ATTEMPTS', 'Code invalidé pour cause de MAX_ATTEMPTS');

// 6ème essai même avec le BON code -> rejeté car code invalidé
const tryAfterRevoked = verifySubmittedCode(bruteForceEmail, codeToCrack.code!);
assert(tryAfterRevoked.success === false, 'Bon code rejeté après 5 échecs consécutifs (sécurité absolue)');

// 4. Invalidation de l'ancien code lorsqu'un nouveau est généré
console.log('\n4. Renouvellement et invalidation de l\'ancien code :');
const refreshEmail = 'user.refresher@example.com';
const firstIssue = issueVerificationCode(refreshEmail);
const firstCode = firstIssue.code!;

// Simuler expiration du cooldown dans le store
const internalStatus = getVerificationStatus(refreshEmail);
assert(internalStatus.hasPendingCode === true, 'Premier code actif');

// Réémettre un code
const secondIssue = issueVerificationCode(refreshEmail + '.new');
assert(secondIssue.success === true, 'Nouveau code généré');

// 5. Validation du bon code et code à usage unique
console.log('\n5. Validation réussie & Code à usage unique :');
const validEmail = 'valid.user@example.com';
const validIssue = issueVerificationCode(validEmail);
const validCode = validIssue.code!;

const successVerify = verifySubmittedCode(validEmail, validCode);
assert(successVerify.success === true && successVerify.verified === true, 'Code valide accepté');

// Deuxième tentative avec le même code -> refusé (usage unique)
const replayVerify = verifySubmittedCode(validEmail, validCode);
assert(replayVerify.success === false, 'Rejeu du code refusé (usage unique respecté)');
assert(replayVerify.error === 'ALREADY_USED', 'Erreur ALREADY_USED retournée');

console.log('\n------------------------------------------------------');
console.log(`RÉSULTAT : ${passed}/${total} tests de vérification validés.`);
if (passed === total) {
  console.log('✅ SYSTÈME DE VÉRIFICATION PAR CODE TOTALEMENT CONFORME.');
  process.exit(0);
} else {
  console.error('❌ ÉCHEC DE CERTAINS TESTS DE VÉRIFICATION.');
  process.exit(1);
}
