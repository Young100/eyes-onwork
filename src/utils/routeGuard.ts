export type AppScreenStage =
  | 'timeout'
  | 'loading'
  | 'login'
  | 'verify_email'
  | 'accept_terms'
  | 'onboarding'
  | 'dashboard';

export interface FirestoreUserGateProfile {
  uid: string;
  email: string;
  emailVerified: boolean;
  termsAcceptedVersion: string | null;
  termsAcceptedAt?: string | null;
  privacyAcceptedVersion?: string | null;
  privacyAcceptedAt?: string | null;
  onboardingCompleted: boolean;
  onboardingCompletedAt?: string | null;
  onboardingStep?: number;
  workspaceId?: string;
  role?: string;
}

export interface RouteGuardInput {
  isAuthReady: boolean;
  isProfileLoaded: boolean;
  isLoading: boolean;
  loadingTimedOut?: boolean;
  isAuthenticated: boolean;
  isDemo?: boolean;
  firestoreProfile: FirestoreUserGateProfile | null;
  currentTermsVersion: string;
}

/**
 * Champs strictement autorisés sur users/{uid} côté client par firestore.rules.
 * Aucun champ de sécurité ou d'étape (role, plan, emailVerified, termsAcceptedVersion, onboardingCompleted)
 * ne doit être inclus ici.
 */
export const FIRESTORE_USER_ALLOWED_UPDATE_KEYS = new Set<string>([
  'name',
  'displayName',
  'studioName',
  'phone',
  'address',
  'siret',
  'tvaNumber',
  'website',
  'avatarUrl',
  'photoURL',
  'photo',
  'iban',
  'bic',
  'currency',
  'defaultVatRate',
  'vatRate',
  'defaultDepositPercent',
  'defaultTurnaroundWeeks',
  'defaultRevisionLimit',
  'termsTemplate',
  'legalNoticeTemplate',
  'legalNotice',
  'defaultConditionsQuote',
  'depositCalculation',
  'quotePrefix',
  'invoicePrefix',
  'maxFileSizeMb',
  'messageTemplates',
  'brandColor',
  'autoUnlockDeliveryOnFullPayment',
  'defaultProjectTemplateId',
  'logoUrl',
  'specialty',
  'accentColor',
  'countryCode',
  'timezone',
  'updatedAt',
  'language',
  'lang',
  'preferences',
  'theme',
  'showHelpBubbles',
  'legalNoticesByCountry',
  'bio'
]);

/**
 * Normalise le profil de contrôle lu depuis Firestore users/{uid}.
 */
export function extractFirestoreGateProfile(
  uid: string,
  email: string,
  data: Record<string, any> | null | undefined,
  firebaseEmailVerified: boolean = false
): FirestoreUserGateProfile {
  return {
    uid,
    email: (data?.email || email || '').trim().toLowerCase(),
    emailVerified: Boolean(data?.emailVerified || firebaseEmailVerified),
    termsAcceptedVersion: typeof data?.termsAcceptedVersion === 'string' && data.termsAcceptedVersion.trim()
      ? data.termsAcceptedVersion.trim()
      : null,
    termsAcceptedAt: data?.termsAcceptedAt || null,
    privacyAcceptedVersion: typeof data?.privacyAcceptedVersion === 'string' ? data.privacyAcceptedVersion : null,
    privacyAcceptedAt: data?.privacyAcceptedAt || null,
    onboardingCompleted: Boolean(data?.onboardingCompleted),
    onboardingCompletedAt: data?.onboardingCompletedAt || null,
    onboardingStep: typeof data?.onboardingStep === 'number' ? data.onboardingStep : 1,
    workspaceId: typeof data?.workspaceId === 'string' ? data.workspaceId : '',
    role: typeof data?.role === 'string' ? data.role : 'user'
  };
}

/**
 * Garde-route unique déterminant l'écran affiché selon l'ordre strict :
 * 1. Chargement tant que Auth et le profil Firestore users/{uid} ne sont pas lus (aucune décision prématurée)
 * 2. Non connecté -> connexion
 * 3. Email non vérifié -> vérification par code
 * 4. Conditions non acceptées ou version ancienne -> acceptation des conditions
 * 5. Configuration non terminée -> assistant de configuration
 * 6. Sinon -> tableau de bord
 */
export function resolveAppScreen(input: RouteGuardInput): AppScreenStage {
  const {
    isAuthReady,
    isProfileLoaded,
    isLoading,
    loadingTimedOut = false,
    isAuthenticated,
    isDemo = false,
    firestoreProfile,
    currentTermsVersion
  } = input;

  if (!isAuthReady || isLoading || (isAuthenticated && !isDemo && !isProfileLoaded)) {
    return loadingTimedOut ? 'timeout' : 'loading';
  }

  if (!isAuthenticated) {
    return 'login';
  }

  if (isDemo) {
    return 'dashboard';
  }

  if (!firestoreProfile) {
    return loadingTimedOut ? 'timeout' : 'loading';
  }

  if (!firestoreProfile.emailVerified) {
    return 'verify_email';
  }

  const acceptedVersion = firestoreProfile.termsAcceptedVersion;
  if (!acceptedVersion || acceptedVersion < currentTermsVersion) {
    return 'accept_terms';
  }

  if (!firestoreProfile.onboardingCompleted) {
    return 'onboarding';
  }

  return 'dashboard';
}
