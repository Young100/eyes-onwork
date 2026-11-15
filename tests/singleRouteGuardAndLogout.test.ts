import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  resolveAppScreen,
  extractFirestoreGateProfile,
  FIRESTORE_USER_ALLOWED_UPDATE_KEYS
} from '../src/utils/routeGuard';

const CURRENT_TERMS = '2026.1';

async function runTests() {
  console.log('=== Test Suite : Garde-route unique, source Firestore users/{uid} & déconnexion complète ===');

  // 1. Aucune décision prématurée avant la lecture d'Auth et de users/{uid}
  assert.equal(
    resolveAppScreen({
      isAuthReady: false,
      isProfileLoaded: false,
      isLoading: true,
      isAuthenticated: false,
      firestoreProfile: null,
      currentTermsVersion: CURRENT_TERMS
    }),
    'loading',
    'Doit afficher loading tant que Auth n est pas prêt'
  );

  assert.equal(
    resolveAppScreen({
      isAuthReady: true,
      isProfileLoaded: false,
      isLoading: false,
      isAuthenticated: true,
      firestoreProfile: {
        uid: 'u1',
        email: 'test@example.com',
        emailVerified: true,
        termsAcceptedVersion: CURRENT_TERMS,
        onboardingCompleted: true
      },
      currentTermsVersion: CURRENT_TERMS
    }),
    'loading',
    'Doit afficher loading tant que la lecture Firestore users/{uid} n est pas terminée'
  );

  assert.equal(
    resolveAppScreen({
      isAuthReady: false,
      isProfileLoaded: false,
      isLoading: true,
      loadingTimedOut: true,
      isAuthenticated: false,
      firestoreProfile: null,
      currentTermsVersion: CURRENT_TERMS
    }),
    'timeout',
    'Doit afficher timeout si le chargement dépasse le délai'
  );

  // 2. Non connecté -> connexion
  assert.equal(
    resolveAppScreen({
      isAuthReady: true,
      isProfileLoaded: true,
      isLoading: false,
      isAuthenticated: false,
      firestoreProfile: null,
      currentTermsVersion: CURRENT_TERMS
    }),
    'login',
    'Non connecté doit pointer vers login'
  );

  // 3. Connecté mais email non vérifié -> code à 6 chiffres
  assert.equal(
    resolveAppScreen({
      isAuthReady: true,
      isProfileLoaded: true,
      isLoading: false,
      isAuthenticated: true,
      firestoreProfile: {
        uid: 'u1',
        email: 'user@example.com',
        emailVerified: false,
        termsAcceptedVersion: CURRENT_TERMS,
        onboardingCompleted: true
      },
      currentTermsVersion: CURRENT_TERMS
    }),
    'verify_email',
    'Email non vérifié dans users/{uid} doit pointer vers verify_email même si autres étapes présentes'
  );

  // 4. Email vérifié mais conditions non acceptées ou version ancienne -> acceptation
  assert.equal(
    resolveAppScreen({
      isAuthReady: true,
      isProfileLoaded: true,
      isLoading: false,
      isAuthenticated: true,
      firestoreProfile: {
        uid: 'u1',
        email: 'user@example.com',
        emailVerified: true,
        termsAcceptedVersion: null,
        onboardingCompleted: true
      },
      currentTermsVersion: CURRENT_TERMS
    }),
    'accept_terms',
    'Conditions null dans users/{uid} doivent pointer vers accept_terms'
  );

  assert.equal(
    resolveAppScreen({
      isAuthReady: true,
      isProfileLoaded: true,
      isLoading: false,
      isAuthenticated: true,
      firestoreProfile: {
        uid: 'u1',
        email: 'user@example.com',
        emailVerified: true,
        termsAcceptedVersion: '2025.1',
        onboardingCompleted: true
      },
      currentTermsVersion: CURRENT_TERMS
    }),
    'accept_terms',
    'Version ancienne des conditions dans users/{uid} doit pointer vers accept_terms'
  );

  // 5. Email vérifié + conditions à jour + configuration non terminée -> assistant
  assert.equal(
    resolveAppScreen({
      isAuthReady: true,
      isProfileLoaded: true,
      isLoading: false,
      isAuthenticated: true,
      firestoreProfile: {
        uid: 'u1',
        email: 'user@example.com',
        emailVerified: true,
        termsAcceptedVersion: CURRENT_TERMS,
        onboardingCompleted: false
      },
      currentTermsVersion: CURRENT_TERMS
    }),
    'onboarding',
    'Onboarding non terminé dans users/{uid} doit pointer vers onboarding'
  );

  // 6. Toutes les étapes complètes dans users/{uid} -> tableau de bord (jamais redemandées)
  assert.equal(
    resolveAppScreen({
      isAuthReady: true,
      isProfileLoaded: true,
      isLoading: false,
      isAuthenticated: true,
      firestoreProfile: {
        uid: 'u1',
        email: 'user@example.com',
        emailVerified: true,
        termsAcceptedVersion: CURRENT_TERMS,
        onboardingCompleted: true
      },
      currentTermsVersion: CURRENT_TERMS
    }),
    'dashboard',
    'Profil complet dans users/{uid} doit mener directement au tableau de bord'
  );

  // 7. Extraction stricte depuis Firestore users/{uid}
  const extracted = extractFirestoreGateProfile(
    'uid_abc',
    'Alice@Example.com',
    {
      emailVerified: true,
      termsAcceptedVersion: '2026.1',
      onboardingCompleted: true,
      onboardingStep: 5,
      workspaceId: 'ws_rand_999'
    },
    false
  );
  assert.equal(extracted.email, 'alice@example.com');
  assert.equal(extracted.emailVerified, true);
  assert.equal(extracted.termsAcceptedVersion, '2026.1');
  assert.equal(extracted.onboardingCompleted, true);
  assert.equal(extracted.workspaceId, 'ws_rand_999');

  // Vérifie que la liste blanche client users/{uid} n'autorise jamais la falsification des étapes
  assert.equal(FIRESTORE_USER_ALLOWED_UPDATE_KEYS.has('emailVerified'), false);
  assert.equal(FIRESTORE_USER_ALLOWED_UPDATE_KEYS.has('termsAcceptedVersion'), false);
  assert.equal(FIRESTORE_USER_ALLOWED_UPDATE_KEYS.has('onboardingCompleted'), false);
  assert.equal(FIRESTORE_USER_ALLOWED_UPDATE_KEYS.has('role'), false);
  assert.equal(FIRESTORE_USER_ALLOWED_UPDATE_KEYS.has('plan'), false);

  // 8. Vérifications structurelles AppContext & App.tsx
  const appContextSrc = fs.readFileSync(path.join(process.cwd(), 'src/context/AppContext.tsx'), 'utf-8');
  const appTsxSrc = fs.readFileSync(path.join(process.cwd(), 'src/App.tsx'), 'utf-8');

  // Auth et profil ne doivent plus être initialisés depuis localStorage
  assert.ok(
    !appContextSrc.includes("const [auth, setAuth] = useState<UserAuth>(() => {\n    const saved = localStorage.getItem(STORAGE_KEYS.AUTH)"),
    'AppContext ne doit pas initialiser auth depuis localStorage'
  );
  assert.ok(
    !appContextSrc.includes("localStorage.getItem(STORAGE_KEYS.PROFILE)"),
    'AppContext ne doit pas lire STORAGE_KEYS.PROFILE depuis localStorage'
  );
  assert.ok(
    appContextSrc.includes('firestoreOnSnapshot') && appContextSrc.includes('stopAllListeners'),
    'AppContext doit écouter users/{uid} via onSnapshot et disposer de stopAllListeners'
  );
  assert.ok(
    appContextSrc.includes('await signOut(firebaseAuth)') &&
      appContextSrc.includes('stopAllListeners()') &&
      appContextSrc.includes('setFirestoreUserDoc(null)') &&
      appContextSrc.includes('setClients([])') &&
      appContextSrc.includes('setProjects([])') &&
      appContextSrc.includes('setQuotes([])') &&
      appContextSrc.includes('setInvoices([])'),
    'logout doit exécuter signOut, arrêter tous les écouteurs et vider tout l état en mémoire'
  );

  // App.tsx utilise un seul garde-route resolveAppScreen et aucun bypass Google/provider
  assert.ok(
    appTsxSrc.includes('resolveAppScreen(') && !appTsxSrc.includes("auth.provider === 'google'"),
    'App.tsx doit utiliser uniquement resolveAppScreen sans bypass local par provider'
  );

  console.log('Tous les tests du garde-route unique et de la déconnexion ont réussi !');
}

runTests().catch(err => {
  console.error('Échec des tests:', err);
  process.exit(1);
});
