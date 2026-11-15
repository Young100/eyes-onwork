import assert from 'assert';
import fs from 'fs';
import path from 'path';
import {
  ESCALATING_DELAY_SECONDS,
  getEscalatingDelayForAttempt,
  formatDelayDuration,
  checkLoginRateLimit,
  recordFailedLoginAttempt,
  resetLoginAttempts
} from '../src/utils/authSecurity.js';

// Polyfill minimal localStorage for Node test environment
const memoryStorage = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (key: string) => memoryStorage.get(key) ?? null,
  setItem: (key: string, value: string) => { memoryStorage.set(key, String(value)); },
  removeItem: (key: string) => { memoryStorage.delete(key); },
  clear: () => { memoryStorage.clear(); }
};

console.log('==================================================================');
console.log('🛡️  EYES-ONWORK - TESTS PARCOURS EMAIL, ERREURS NEUTRES & BACKOFF');
console.log('==================================================================');

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

// 1. Délai croissant après plusieurs échecs
console.log('\n1. Délai croissant progressif après échecs de connexion :');
test('Barème croissant strictement monotone', () => {
  assert.deepStrictEqual(ESCALATING_DELAY_SECONDS, [0, 3, 10, 30, 60, 180, 300, 900]);
  for (let i = 1; i < ESCALATING_DELAY_SECONDS.length; i++) {
    assert(ESCALATING_DELAY_SECONDS[i] > ESCALATING_DELAY_SECONDS[i - 1]);
  }
  assert.strictEqual(getEscalatingDelayForAttempt(1), 0);
  assert.strictEqual(getEscalatingDelayForAttempt(2), 3);
  assert.strictEqual(getEscalatingDelayForAttempt(3), 10);
  assert.strictEqual(getEscalatingDelayForAttempt(4), 30);
  assert.strictEqual(getEscalatingDelayForAttempt(5), 60);
  assert.strictEqual(getEscalatingDelayForAttempt(6), 180);
  assert.strictEqual(getEscalatingDelayForAttempt(7), 300);
  assert.strictEqual(getEscalatingDelayForAttempt(8), 900);
  assert.strictEqual(getEscalatingDelayForAttempt(12), 900);
});

test('Enregistrement successif des échecs déclenche le délai croissant et bloque checkLoginRateLimit', () => {
  memoryStorage.clear();
  const id = 'test@atelier.fr';

  const r1 = recordFailedLoginAttempt(id);
  assert.strictEqual(r1.isNowLocked, false);
  assert.strictEqual(r1.delaySeconds, 0);

  const r2 = recordFailedLoginAttempt(id);
  assert.strictEqual(r2.isNowLocked, true);
  assert.strictEqual(r2.delaySeconds, 3);
  assert.strictEqual(checkLoginRateLimit(id).isLocked, true);

  const r3 = recordFailedLoginAttempt(id);
  assert.strictEqual(r3.delaySeconds, 10);

  const r4 = recordFailedLoginAttempt(id);
  assert.strictEqual(r4.delaySeconds, 30);

  // Limite globale empêche le contournement en changeant simplement d'email dans le même navigateur
  const otherEmailCheck = checkLoginRateLimit('autre-adresse@atelier.fr');
  assert.strictEqual(otherEmailCheck.isLocked, true);
  assert(otherEmailCheck.remainingSeconds >= 25);

  // Réinitialisation après succès
  resetLoginAttempts(id);
  assert.strictEqual(checkLoginRateLimit(id).isLocked, false);
  assert.strictEqual(checkLoginRateLimit(id).remainingSeconds, 0);
});

test('Cumul avec la limite Firebase (auth/too-many-requests -> min 60s)', () => {
  memoryStorage.clear();
  const res = recordFailedLoginAttempt('rate@atelier.fr', 60);
  assert.strictEqual(res.isNowLocked, true);
  assert(res.remainingSeconds >= 60);
  assert.strictEqual(formatDelayDuration(60), '1 minute');
  assert.strictEqual(formatDelayDuration(75), '1 min 15s');
  assert.strictEqual(formatDelayDuration(10), '10 secondes');
});

// 2. Vérifications structurelles UI & messages exacts requis
console.log('\n2. Conformité des messages, onglets, boutons et page de nouveau mot de passe :');
const authModalSrc = fs.readFileSync(path.resolve('src/components/auth/AuthFlowModal.tsx'), 'utf-8');
const resetViewSrc = fs.readFileSync(path.resolve('src/components/auth/ResetPasswordView.tsx'), 'utf-8');
const appSrc = fs.readFileSync(path.resolve('src/App.tsx'), 'utf-8');
const appCtxSrc = fs.readFileSync(path.resolve('src/context/AppContext.tsx'), 'utf-8');

test('Deux onglets "Se connecter" et "Créer un compte" présents avec bouton Google sur les deux', () => {
  assert(authModalSrc.includes('role="tablist"'), 'Onglets accessibles');
  assert(authModalSrc.includes('Se connecter'), 'Onglet Se connecter présent');
  assert(authModalSrc.includes('Créer un compte'), 'Onglet Créer un compte présent');
  const googleMatches = authModalSrc.match(/Continuer avec Google/g) || [];
  assert(googleMatches.length >= 2, 'Bouton Google présent sur les deux onglets (+ cas email déjà utilisé)');
});

test('Création auth/email-already-in-use : affiche "Cette adresse est déjà utilisée" et 3 boutons', () => {
  assert(appCtxSrc.includes("error: 'Cette adresse est déjà utilisée'"));
  assert(authModalSrc.includes('Cette adresse est déjà utilisée'));
  assert(authModalSrc.includes('emailAlreadyInUse'));
  // Vérifie présence des 3 boutons dans le bloc emailAlreadyInUse
  const blockStart = authModalSrc.indexOf('{emailAlreadyInUse && (');
  const blockEnd = authModalSrc.indexOf('<form onSubmit={handleRegisterSubmit}', blockStart);
  const block = authModalSrc.slice(blockStart, blockEnd);
  assert(block.includes('Se connecter'), 'Bouton Se connecter dans alerte email déjà utilisé');
  assert(block.includes('Continuer avec Google'), 'Bouton Continuer avec Google dans alerte email déjà utilisé');
  assert(block.includes('Mot de passe oublié'), 'Bouton Mot de passe oublié dans alerte email déjà utilisé');
});

test('Connexion : message unique "Identifiants invalides" et aucune fuite "email inconnu" / "mot de passe incorrect"', () => {
  assert(authModalSrc.includes("setErrorMessage('Identifiants invalides')"));
  const errorCalls = authModalSrc.match(/setErrorMessage\([^)]+\)/g) || [];
  for (const call of errorCalls) {
    assert(!call.toLowerCase().includes('email inconnu'), 'Ne jamais afficher email inconnu');
    assert(!call.toLowerCase().includes('mot de passe incorrect'), 'Ne jamais afficher mot de passe incorrect');
  }
  assert(authModalSrc.includes('Vous avez peut-être créé votre compte avec Google'), 'Aide permanente présente');
});

test('Mot de passe oublié : confirmation neutre "Si un compte existe, un email a été envoyé" et page app colors', () => {
  assert(authModalSrc.includes('sendPasswordResetEmail'));
  assert(authModalSrc.includes('Si un compte existe, un email a été envoyé'));
  assert(!authModalSrc.includes("Aucun compte n'a été trouvé"), 'Zéro énumération sur reset password');
  assert(resetViewSrc.includes('verifyPasswordResetCode'));
  assert(resetViewSrc.includes('confirmPasswordReset'));
  assert(resetViewSrc.includes('#f7c548'), 'Page nouveau mot de passe aux couleurs de l’app (#f7c548)');
  assert(appSrc.includes("params.get('mode') === 'resetPassword'") && appSrc.includes('ResetPasswordView'), 'Routage ?mode=resetPassword&oobCode=... câblé');
});

console.log('\n------------------------------------------------------------------');
console.log(`🎯 TOUS LES TESTS PARCOURS EMAIL & SÉCURITÉ ONT RÉUSSI (${passCount} tests)`);
console.log('------------------------------------------------------------------\n');
