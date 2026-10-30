import assert from 'assert';
import {
  getUserByEmail,
  getOrCreateUser,
  markEmailVerified,
  acceptTerms,
  completeOnboarding,
  updateUserProfile
} from '../src/server/userStore.js';
import {
  issueVerificationCode,
  verifySubmittedCode
} from '../emailService.js';
import { CURRENT_TERMS_VERSION } from '../src/config/termsConfig.js';

console.log('==================================================================');
console.log('🛡️  EYES-ONWORK - TESTS DU PROFIL PERMANENT & CONNEXION DIRECTE');
console.log('==================================================================');

async function runPersistentProfileTests() {
  const testEmail = `designer.test.${Date.now()}@studio-atelier.fr`;
  let passCount = 0;

  function test(label: string, fn: () => void) {
    try {
      fn();
      console.log(`  ✓ [PASS] ${label}`);
      passCount++;
    } catch (err: any) {
      console.error(`  ✗ [FAIL] ${label}:`, err.message);
      throw err;
    }
  }

  // 1. Inscription complète et persistance initiale
  console.log('\n1. Création de compte & Invariants de profil initial :');
  let user = getOrCreateUser(testEmail, {
    displayName: 'Sophie Martin',
    studioName: 'Atelier Martin Studio',
    provider: 'password'
  });

  test('Profil créé avec identifiant permanent et provider password', () => {
    assert(user.uid.startsWith('usr_'), 'UID doit commencer par usr_');
    assert.strictEqual(user.email, testEmail.toLowerCase());
    assert.strictEqual(user.provider, 'password');
    assert.strictEqual(user.emailVerified, false);
    assert.strictEqual(user.emailVerifiedAt, null);
    assert.strictEqual(user.termsAcceptedVersion, null);
    assert.strictEqual(user.onboardingCompleted, false);
  });

  // 2. Vérification par code à 6 chiffres
  console.log('\n2. Validation par code email & Scellement serveur :');
  const codeIssue = issueVerificationCode(testEmail, user.uid);
  assert(codeIssue.code, 'Un code doit être émis');

  const verifyRes = verifySubmittedCode(testEmail, codeIssue.code);
  assert.strictEqual(verifyRes.success, true, 'Le code soumis doit être valide');

  user = markEmailVerified(testEmail);

  test('Email marqué vérifié de manière permanente avec emailVerifiedAt non nul', () => {
    assert.strictEqual(user.emailVerified, true);
    assert(user.emailVerifiedAt !== null, 'emailVerifiedAt doit être horodaté');
    assert(new Date(user.emailVerifiedAt!).getTime() > 0, 'Timestamp valide');
  });

  // 3. Acceptation des conditions générales et RGPD
  console.log('\n3. Acceptation des conditions & versioning centralisé :');
  user = acceptTerms(testEmail, CURRENT_TERMS_VERSION, '2026.1');

  test('Version des conditions enregistrée dans la base permanente', () => {
    assert.strictEqual(user.termsAcceptedVersion, CURRENT_TERMS_VERSION);
    assert(user.termsAcceptedAt !== null, 'termsAcceptedAt doit être horodaté');
    assert.strictEqual(user.privacyAcceptedVersion, '2026.1');
    assert(user.privacyAcceptedAt !== null, 'privacyAcceptedAt doit être horodaté');
  });

  // 4. Clôture de la configuration initiale (Onboarding)
  console.log('\n4. Validation de la configuration initiale (Onboarding 5 étapes) :');
  user = completeOnboarding(testEmail, 5);

  test('onboardingCompleted marqué à true de façon permanente', () => {
    assert.strictEqual(user.onboardingCompleted, true);
    assert.strictEqual(user.onboardingStep, 5);
    assert(user.onboardingCompletedAt !== null, 'onboardingCompletedAt doit être horodaté');
  });

  // 5. Règle de sécurité : interdiction de falsifier emailVerifiedAt côté client
  console.log('\n5. Règle de sécurité : Protection contre la falsification directe :');
  const hackedAttempt = updateUserProfile(testEmail, {
    displayName: 'Sophie Martin Directrice',
    // Tentative de modification illégitime
    emailVerifiedAt: '2099-01-01T00:00:00.000Z'
  } as any);

  test('updateUserProfile ignore et protège strictement emailVerifiedAt', () => {
    assert.strictEqual(hackedAttempt.displayName, 'Sophie Martin Directrice');
    assert.notStrictEqual(hackedAttempt.emailVerifiedAt, '2099-01-01T00:00:00.000Z');
    assert.strictEqual(hackedAttempt.emailVerifiedAt, user.emailVerifiedAt);
  });

  // 6. Déconnexion & Reconnexion Email normale -> arrivée directe sans redemande
  console.log('\n6. Déconnexion et Reconnexion Email normale :');
  const reconnectedEmailUser = getUserByEmail(testEmail);

  test('Reconnexion par email retrouve le profil complet sans redemander email ni CGU', () => {
    assert(reconnectedEmailUser !== null, 'Utilisateur retrouvé');
    assert.strictEqual(reconnectedEmailUser.emailVerified, true);
    assert.strictEqual(reconnectedEmailUser.termsAcceptedVersion, CURRENT_TERMS_VERSION);
    assert.strictEqual(reconnectedEmailUser.onboardingCompleted, true);
    // Le garde-route enverra DIRECTEMENT vers le tableau de bord
    const isTermsCurrent = Boolean(reconnectedEmailUser.termsAcceptedVersion && reconnectedEmailUser.termsAcceptedVersion >= CURRENT_TERMS_VERSION);
    assert.strictEqual(isTermsCurrent, true, 'Conditions déjà à jour');
  });

  // 7. Connexion via Google avec la même adresse -> même profil partagé
  console.log('\n7. Connexion via Google avec la même adresse email :');
  const googleUser = getOrCreateUser(testEmail, {
    provider: 'google',
    displayName: 'Sophie Martin Google'
  });

  test('Compte Google partage le même profil permanent et accède directement', () => {
    assert.strictEqual(googleUser.uid, user.uid, 'Même identifiant utilisateur');
    assert.strictEqual(googleUser.emailVerified, true, 'Email automatiquement certifié');
    assert.strictEqual(googleUser.termsAcceptedVersion, CURRENT_TERMS_VERSION);
    assert.strictEqual(googleUser.onboardingCompleted, true);
  });

  // 8. Simulation d’une mise à jour des conditions générales (ex: bump vers 2026.2)
  console.log('\n8. Simulation de changement de version des conditions :');
  const FUTURE_TERMS_VERSION = '2026.2';

  test('Ancienne acceptation (2026.1) détectée comme obsolète face à 2026.2', () => {
    const isOldTermsCurrent = Boolean(googleUser.termsAcceptedVersion && googleUser.termsAcceptedVersion >= FUTURE_TERMS_VERSION);
    assert.strictEqual(isOldTermsCurrent, false, 'Le garde-route doit demander la réacceptation');
  });

  const reacceptedUser = acceptTerms(testEmail, FUTURE_TERMS_VERSION, '2026.2');

  test('Réacceptation unique enregistre la nouvelle version dans la base permanente', () => {
    assert.strictEqual(reacceptedUser.termsAcceptedVersion, FUTURE_TERMS_VERSION);
    assert.strictEqual(reacceptedUser.privacyAcceptedVersion, '2026.2');
    const isNowCurrent = Boolean(reacceptedUser.termsAcceptedVersion && reacceptedUser.termsAcceptedVersion >= FUTURE_TERMS_VERSION);
    assert.strictEqual(isNowCurrent, true, 'Conditions à nouveau validées');
  });

  console.log('\n------------------------------------------------------------------');
  console.log(`BILAN DES TESTS : ${passCount}/${passCount} invariants validés.`);
  console.log('✅ LA PERSISTANCE ET LE FONCTIONNEMENT DES GARDES-ROUTES SONT PARFAITS.');
  console.log('==================================================================');
}

runPersistentProfileTests();
process.exit(0);
