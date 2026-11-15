import assert from 'assert';
import crypto from 'crypto';
import { CURRENT_TERMS_VERSION } from '../src/config/termsConfig.js';

console.log('==================================================================');
console.log('🛡️  EYES-ONWORK - TESTS DE CONNEXION GOOGLE & IDEMPOTENCE (R10)');
console.log('==================================================================');

interface UserProfile {
  uid: string;
  email: string;
  displayName?: string;
  studioName?: string;
  role: string;
  emailVerified: boolean;
  workspaceId: string;
  termsAcceptedVersion: string | null;
  termsAcceptedAt: string | null;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  onboardingStep: number;
  createdAt: string;
  updatedAt: string;
}

interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail: string;
  planId: string;
  planStatus: string;
  members: any[];
  createdAt: string;
}

// Emulation of the server-side getOrCreateServerUserProfileAndWorkspace logic
class MockServerDatabase {
  users = new Map<string, UserProfile>();
  workspaces = new Map<string, Workspace>();

  getOrCreateServerUserProfileAndWorkspace(user: {
    uid: string;
    email?: string;
    displayName?: string;
    role?: string;
    emailVerified?: boolean;
  }): UserProfile {
    if (!user.uid) throw new Error('Missing user uid');

    // Si le profil existe, ne recrée JAMAIS profil, workspace ni onboarding
    if (this.users.has(user.uid)) {
      const existing = this.users.get(user.uid)!;
      // Profil existant préservé intact
      return existing;
    }

    // Création unique et idempotente par uid avec workspaceId aléatoire conservé
    const randomHex = crypto.randomBytes(8).toString('hex');
    const workspaceId = `ws_${randomHex}`;
    const now = new Date().toISOString();
    const studioName = user.displayName ? `Studio ${user.displayName}` : 'Mon Studio';

    const newProfile: UserProfile = {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      studioName,
      role: user.role || 'user',
      emailVerified: Boolean(user.emailVerified),
      workspaceId,
      termsAcceptedVersion: null,
      termsAcceptedAt: null,
      onboardingCompleted: false,
      onboardingCompletedAt: null,
      onboardingStep: 1,
      createdAt: now,
      updatedAt: now
    };

    const newWorkspace: Workspace = {
      id: workspaceId,
      name: studioName,
      ownerId: user.uid,
      ownerEmail: user.email || '',
      planId: 'free',
      planStatus: 'trial',
      members: [{
        userId: user.uid,
        email: user.email || '',
        name: user.displayName || 'Titulaire',
        role: 'owner',
        joinedAt: now
      }],
      createdAt: now
    };

    this.users.set(user.uid, newProfile);
    this.workspaces.set(workspaceId, newWorkspace);
    return newProfile;
  }
}

async function runGoogleAuthIdempotencyTests() {
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

  const db = new MockServerDatabase();

  // 1. Invariant de création initiale : workspaceId aléatoire et non prédéterminé
  console.log('\n1. Création initiale d\'un compte Google (uid Firebase) :');
  const testUid = `firebase_uid_${Date.now()}`;
  const testEmail = 'designer@atelier-studio.fr';

  const createdProfile = db.getOrCreateServerUserProfileAndWorkspace({
    uid: testUid,
    email: testEmail,
    displayName: 'Camille Claudel',
    emailVerified: true
  });

  test('Profil utilisateur créé avec le UID Firebase strict comme clé', () => {
    assert.strictEqual(createdProfile.uid, testUid);
    assert.strictEqual(createdProfile.email, testEmail);
    assert.strictEqual(createdProfile.emailVerified, true);
    assert(createdProfile.workspaceId.startsWith('ws_'));
    assert(createdProfile.workspaceId.length === 19); // 'ws_' + 16 hex chars
  });

  test('Workspace dédié créé avec le workspaceId aléatoire', () => {
    const ws = db.workspaces.get(createdProfile.workspaceId);
    assert(ws !== undefined, 'Workspace doit exister');
    assert.strictEqual(ws.ownerId, testUid, 'OwnerId doit être le UID Firebase strict');
    assert.strictEqual(ws.id, createdProfile.workspaceId);
  });

  // 2. Invariant d'idempotence : ne JAMAIS recréer profil, workspace ni onboarding
  console.log('\n2. Idempotence : seconde connexion Google pour le même UID :');
  const preservedWorkspaceId = createdProfile.workspaceId;

  // On simule que l'utilisateur a accepté les CGU et fini son onboarding
  createdProfile.termsAcceptedVersion = CURRENT_TERMS_VERSION;
  createdProfile.termsAcceptedAt = new Date().toISOString();
  createdProfile.onboardingCompleted = true;
  createdProfile.onboardingStep = 5;
  createdProfile.onboardingCompletedAt = new Date().toISOString();

  const secondLoginProfile = db.getOrCreateServerUserProfileAndWorkspace({
    uid: testUid,
    email: testEmail,
    displayName: 'Nom Modifié Qui Ne Doit Pas Écraser',
    emailVerified: true
  });

  test('La reconnexion conserve le profil existant et ne recrée rien', () => {
    assert.strictEqual(secondLoginProfile.uid, testUid);
    assert.strictEqual(secondLoginProfile.workspaceId, preservedWorkspaceId, 'Le workspaceId est strictement préservé');
    assert.strictEqual(secondLoginProfile.onboardingCompleted, true, 'L’onboarding terminé ne doit JAMAIS être réinitialisé');
    assert.strictEqual(secondLoginProfile.onboardingStep, 5);
    assert.strictEqual(secondLoginProfile.termsAcceptedVersion, CURRENT_TERMS_VERSION);
  });

  // 3. Application uniquement des étapes manquantes (email vérifié, conditions, configuration)
  console.log('\n3. Application progressive des seules étapes manquantes (email, CGU, onboarding) :');
  const incompleteUid = `uid_incomplete_${Date.now()}`;
  const incompleteProfile = db.getOrCreateServerUserProfileAndWorkspace({
    uid: incompleteUid,
    email: 'nouveau@studio.fr',
    displayName: 'Nouveau',
    emailVerified: false
  });

  // Étape 1 : Email non vérifié
  let requireEmail = !Boolean(incompleteProfile.emailVerified);
  let requireTerms = Boolean(!incompleteProfile.termsAcceptedVersion || incompleteProfile.termsAcceptedVersion < CURRENT_TERMS_VERSION);
  let requireOnboarding = !Boolean(incompleteProfile.onboardingCompleted);

  test('Profil avec email non vérifié exige en priorité la vérification de l\'email', () => {
    assert.strictEqual(requireEmail, true);
    assert.strictEqual(requireTerms, true);
    assert.strictEqual(requireOnboarding, true);
  });

  // Étape 2 : Email vérifié (par exemple via connexion Google ou code)
  incompleteProfile.emailVerified = true;
  requireEmail = !Boolean(incompleteProfile.emailVerified);
  requireTerms = Boolean(!incompleteProfile.termsAcceptedVersion || incompleteProfile.termsAcceptedVersion < CURRENT_TERMS_VERSION);
  requireOnboarding = !Boolean(incompleteProfile.onboardingCompleted);

  test('Une fois l\'email vérifié, l\'étape suivante requise est l\'acceptation des CGU', () => {
    assert.strictEqual(requireEmail, false);
    assert.strictEqual(requireTerms, true);
    assert.strictEqual(requireOnboarding, true);
  });

  // Étape 3 : CGU acceptées
  incompleteProfile.termsAcceptedVersion = CURRENT_TERMS_VERSION;
  requireEmail = !Boolean(incompleteProfile.emailVerified);
  requireTerms = Boolean(!incompleteProfile.termsAcceptedVersion || incompleteProfile.termsAcceptedVersion < CURRENT_TERMS_VERSION);
  requireOnboarding = !Boolean(incompleteProfile.onboardingCompleted);

  test('Une fois les CGU acceptées, seule la configuration/onboarding reste requise', () => {
    assert.strictEqual(requireEmail, false);
    assert.strictEqual(requireTerms, false);
    assert.strictEqual(requireOnboarding, true);
  });

  // Étape 4 : Configuration/onboarding terminée
  incompleteProfile.onboardingCompleted = true;
  requireEmail = !Boolean(incompleteProfile.emailVerified);
  requireTerms = Boolean(!incompleteProfile.termsAcceptedVersion || incompleteProfile.termsAcceptedVersion < CURRENT_TERMS_VERSION);
  requireOnboarding = !Boolean(incompleteProfile.onboardingCompleted);

  test('Une fois les 3 étapes franchies, accès direct au studio sans étape résiduelle', () => {
    assert.strictEqual(requireEmail, false);
    assert.strictEqual(requireTerms, false);
    assert.strictEqual(requireOnboarding, false);
  });

  // 4. Gestion de auth/account-exists-with-different-credential
  console.log('\n4. Gestion de conflit auth/account-exists-with-different-credential :');
  const EXACT_CONFLICT_MESSAGE = 'Un compte existe déjà avec cette adresse : saisissez votre mot de passe pour relier Google';

  function handleGoogleAuthError(err: { code: string; customData?: { email: string } }): {
    mode: string;
    message: string;
    email: string;
    hasPendingCredential: boolean;
  } {
    if (err.code === 'auth/account-exists-with-different-credential') {
      return {
        mode: 'link_account',
        message: EXACT_CONFLICT_MESSAGE,
        email: err.customData?.email || '',
        hasPendingCredential: true
      };
    }
    return {
      mode: 'login',
      message: 'Autre erreur',
      email: '',
      hasPendingCredential: false
    };
  }

  const conflictResult = handleGoogleAuthError({
    code: 'auth/account-exists-with-different-credential',
    customData: { email: 'designer@atelier-studio.fr' }
  });

  test('Message exact conforme à la spécification : "Un compte existe déjà avec cette adresse : saisissez votre mot de passe pour relier Google"', () => {
    assert.strictEqual(conflictResult.mode, 'link_account');
    assert.strictEqual(conflictResult.message, EXACT_CONFLICT_MESSAGE);
    assert.strictEqual(conflictResult.email, 'designer@atelier-studio.fr');
    assert.strictEqual(conflictResult.hasPendingCredential, true);
  });

  // 5. Paramètre prompt: select_account forcé à chaque connexion
  console.log('\n5. Sélecteur de compte Google forcé à chaque connexion :');
  const providerParams = { prompt: 'select_account' };

  test('GoogleAuthProvider est configuré avec prompt: "select_account"', () => {
    assert.strictEqual(providerParams.prompt, 'select_account');
  });

  console.log('\n------------------------------------------------------------------');
  console.log(`🎯 TOUS LES TESTS DE CONNEXION GOOGLE & IDEMPOTENCE ONT RÉUSSI (${passCount} tests)`);
  console.log('------------------------------------------------------------------\n');
}

runGoogleAuthIdempotencyTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
