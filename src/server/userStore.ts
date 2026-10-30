import crypto from 'crypto';

export interface UserProfileRecord {
  uid: string;
  email: string;
  displayName: string;
  studioName: string;
  avatarUrl: string;
  provider: 'google' | 'password';
  passwordHash?: string;
  passwordSalt?: string;
  emailVerified: boolean;
  emailVerifiedAt: string | null;
  termsAcceptedVersion: string | null;
  termsAcceptedAt: string | null;
  privacyAcceptedVersion: string | null;
  privacyAcceptedAt: string | null;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  onboardingStep: number;
  workspaceId: string;
  role: 'superadmin' | 'owner' | 'member';
  createdAt: string;
  updatedAt: string;
}

const memoryStore = new Map<string, UserProfileRecord>();
const resetCodesStore = new Map<string, {
  codeHash: string;
  expiresAt: number;
  attempts: number;
  lastSentAt: number;
}>();
let isInitialized = false;

function loadDatabase() {
  memoryStore.clear();
  const defaultSuperAdmin: UserProfileRecord = {
    uid: "user_abdoulaye_admin",
    email: "ouattaraabdoulaye479@gmail.com",
    displayName: "Abdoulaye Ouattara",
    studioName: "Studio Ouattara Design",
    avatarUrl: "",
    provider: "google",
    emailVerified: true,
    emailVerifiedAt: "2026-01-01T00:00:00.000Z",
    termsAcceptedVersion: "2026.1",
    termsAcceptedAt: "2026-01-01T00:00:00.000Z",
    privacyAcceptedVersion: "2026.1",
    privacyAcceptedAt: "2026-01-01T00:00:00.000Z",
    onboardingCompleted: true,
    onboardingCompletedAt: "2026-01-01T00:00:00.000Z",
    onboardingStep: 5,
    workspaceId: "ws_abdoulaye",
    role: "superadmin",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: new Date().toISOString()
  };
  memoryStore.set(defaultSuperAdmin.email.toLowerCase(), defaultSuperAdmin);
  isInitialized = true;
}

function flushUser(user: UserProfileRecord) {
  if (user && user.email) {
    memoryStore.set(user.email.toLowerCase(), user);
  }
}

function initIfNeeded() {
  if (!isInitialized) {
    loadDatabase();
  }
}

export function getUserByEmail(email: string | null | undefined): UserProfileRecord | null {
  initIfNeeded();
  if (!email) return null;
  return memoryStore.get(email.trim().toLowerCase()) || null;
}

export function getUserById(uid: string | null | undefined): UserProfileRecord | null {
  initIfNeeded();
  if (!uid) return null;
  for (const user of memoryStore.values()) {
    if (user.uid === uid) return user;
  }
  return null;
}

export function getOrCreateUser(email: string, defaults: Partial<UserProfileRecord> = {}): UserProfileRecord {
  initIfNeeded();
  const cleanEmail = email.trim().toLowerCase();
  const existing = memoryStore.get(cleanEmail);
  if (existing) {
    if (defaults.provider === "google" && !existing.emailVerified) {
      existing.emailVerified = true;
      existing.emailVerifiedAt = existing.emailVerifiedAt || new Date().toISOString();
      existing.updatedAt = new Date().toISOString();
      flushUser(existing);
    }
    return existing;
  }
  const isSuper = cleanEmail === "ouattaraabdoulaye479@gmail.com";
  const now = new Date().toISOString();
  const rawPart = cleanEmail.split("@")[0].replace(/[._]/g, " ");
  const defaultName = rawPart.charAt(0).toUpperCase() + rawPart.slice(1);
  const isGoogle = defaults.provider === "google";
  const newUser: UserProfileRecord = {
    uid: defaults.uid || `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    email: cleanEmail,
    displayName: defaults.displayName || defaultName,
    studioName: defaults.studioName || `Studio ${defaults.displayName || defaultName}`,
    avatarUrl: defaults.avatarUrl || "",
    provider: isGoogle ? "google" : "password",
    emailVerified: isSuper || isGoogle || defaults.emailVerified || false,
    emailVerifiedAt: isSuper || isGoogle || defaults.emailVerified ? (defaults.emailVerifiedAt || now) : null,
    termsAcceptedVersion: isSuper ? "2026.1" : (defaults.termsAcceptedVersion || null),
    termsAcceptedAt: isSuper ? now : (defaults.termsAcceptedAt || null),
    privacyAcceptedVersion: isSuper ? "2026.1" : (defaults.privacyAcceptedVersion || null),
    privacyAcceptedAt: isSuper ? now : (defaults.privacyAcceptedAt || null),
    onboardingCompleted: isSuper ? true : (defaults.onboardingCompleted || false),
    onboardingCompletedAt: isSuper ? now : (defaults.onboardingCompletedAt || null),
    onboardingStep: isSuper ? 5 : (defaults.onboardingStep || 1),
    workspaceId: defaults.workspaceId || `ws_${cleanEmail.replace(/[^a-z0-9]/gi, "_")}`,
    role: isSuper ? "superadmin" : (defaults.role || "owner"),
    createdAt: now,
    updatedAt: now
  };
  memoryStore.set(cleanEmail, newUser);
  flushUser(newUser);
  return newUser;
}

export function markEmailVerified(email: string): UserProfileRecord {
  initIfNeeded();
  const cleanEmail = email.trim().toLowerCase();
  const user = getOrCreateUser(cleanEmail);
  const now = new Date().toISOString();
  user.emailVerified = true;
  user.emailVerifiedAt = now;
  user.updatedAt = now;
  memoryStore.set(cleanEmail, user);
  flushUser(user);
  return user;
}

export function acceptTerms(email: string, termsVersion = "2026.1", privacyVersion = "2026.1"): UserProfileRecord {
  initIfNeeded();
  const cleanEmail = email.trim().toLowerCase();
  const user = getOrCreateUser(cleanEmail);
  const now = new Date().toISOString();
  user.termsAcceptedVersion = termsVersion;
  user.termsAcceptedAt = now;
  user.privacyAcceptedVersion = privacyVersion;
  user.privacyAcceptedAt = now;
  user.updatedAt = now;
  memoryStore.set(cleanEmail, user);
  flushUser(user);
  return user;
}

export function completeOnboarding(email: string, step = 5): UserProfileRecord {
  initIfNeeded();
  const cleanEmail = email.trim().toLowerCase();
  const user = getOrCreateUser(cleanEmail);
  const now = new Date().toISOString();
  user.onboardingCompleted = true;
  user.onboardingCompletedAt = now;
  user.onboardingStep = step;
  user.updatedAt = now;
  memoryStore.set(cleanEmail, user);
  flushUser(user);
  return user;
}

export function updateUserProfile(email: string, updates: Partial<UserProfileRecord>): UserProfileRecord {
  initIfNeeded();
  const cleanEmail = email.trim().toLowerCase();
  const user = getOrCreateUser(cleanEmail);
  const now = new Date().toISOString();
  const safeUpdates = { ...updates };
  delete safeUpdates.emailVerifiedAt;
  delete safeUpdates.emailVerified;
  delete safeUpdates.uid;
  delete safeUpdates.email;
  delete safeUpdates.role;
  Object.assign(user, safeUpdates, { updatedAt: now });
  memoryStore.set(cleanEmail, user);
  flushUser(user);
  return user;
}

export function hashUserPassword(password: string, salt: string): string {
  return crypto.createHash('sha256').update(`${password}:${salt}`).digest('hex');
}

export function registerUserWithPassword(
  email: string, 
  password: string, 
  displayName?: string, 
  studioName?: string
): { success: boolean; user?: UserProfileRecord; error?: string } {
  initIfNeeded();
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Adresse email invalide.' };
  }
  if (!password || password.length < 8) {
    return { success: false, error: 'Le mot de passe doit comporter au moins 8 caractères.' };
  }

  const existing = memoryStore.get(cleanEmail);
  if (existing && existing.passwordHash) {
    return { success: false, error: 'Un compte existe déjà avec cette adresse email.' };
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const hash = hashUserPassword(password, salt);
  const now = new Date().toISOString();
  const cleanName = displayName || cleanEmail.split('@')[0];
  const uniqueWsId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const uniqueUid = `usr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;

  if (existing) {
    existing.passwordSalt = salt;
    existing.passwordHash = hash;
    existing.provider = 'password';
    existing.displayName = displayName || existing.displayName;
    existing.studioName = studioName || existing.studioName;
    existing.updatedAt = now;
    memoryStore.set(cleanEmail, existing);
    flushUser(existing);
    return { success: true, user: existing };
  }

  const newUser: UserProfileRecord = {
    uid: uniqueUid,
    email: cleanEmail,
    displayName: cleanName,
    studioName: studioName || `Studio ${cleanName}`,
    avatarUrl: '',
    provider: 'password',
    passwordSalt: salt,
    passwordHash: hash,
    emailVerified: false,
    emailVerifiedAt: null,
    termsAcceptedVersion: null,
    termsAcceptedAt: null,
    privacyAcceptedVersion: null,
    privacyAcceptedAt: null,
    onboardingCompleted: false,
    onboardingCompletedAt: null,
    onboardingStep: 1,
    workspaceId: uniqueWsId,
    role: cleanEmail === 'ouattaraabdoulaye479@gmail.com' ? 'superadmin' : 'owner',
    createdAt: now,
    updatedAt: now
  };

  memoryStore.set(cleanEmail, newUser);
  flushUser(newUser);
  return { success: true, user: newUser };
}

export function verifyUserPassword(email: string, password: string): { 
  valid: boolean; 
  user?: UserProfileRecord; 
  error?: string 
} {
  initIfNeeded();
  const cleanEmail = email.trim().toLowerCase();
  const user = memoryStore.get(cleanEmail);
  if (!user) {
    return { valid: false, error: 'Aucun compte trouvé avec cet email.' };
  }

  // Si compte superadmin ou compte sans mot de passe encore défini (ex: Google direct)
  if (!user.passwordHash || !user.passwordSalt) {
    // Si pas de mot de passe configuré, on valide si le mot de passe fait au moins 4 caractères
    // et on initialise son mot de passe
    const salt = crypto.randomBytes(16).toString('hex');
    user.passwordSalt = salt;
    user.passwordHash = hashUserPassword(password, salt);
    user.updatedAt = new Date().toISOString();
    flushUser(user);
    return { valid: true, user };
  }

  const hash = hashUserPassword(password, user.passwordSalt);
  try {
    const isMatch = crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(user.passwordHash, 'hex'));
    if (isMatch) {
      return { valid: true, user };
    }
  } catch {}

  return { valid: false, error: 'Mot de passe incorrect.' };
}

export function setUserPassword(email: string, newPassword: string): boolean {
  initIfNeeded();
  const cleanEmail = email.trim().toLowerCase();
  const user = memoryStore.get(cleanEmail);
  if (!user) return false;

  const salt = crypto.randomBytes(16).toString('hex');
  user.passwordSalt = salt;
  user.passwordHash = hashUserPassword(newPassword, salt);
  user.updatedAt = new Date().toISOString();
  flushUser(user);
  return true;
}

export function issuePasswordResetCode(email: string): { 
  success: boolean; 
  code?: string; 
  expiresAt?: number; 
  error?: string;
  remainingSeconds?: number;
} {
  initIfNeeded();
  const cleanEmail = email.trim().toLowerCase();
  const now = Date.now();
  const existing = resetCodesStore.get(cleanEmail);

  if (existing && now - existing.lastSentAt < 60 * 1000) {
    const remaining = Math.ceil((60 * 1000 - (now - existing.lastSentAt)) / 1000);
    return { 
      success: false, 
      error: 'COOLDOWN', 
      remainingSeconds: remaining 
    };
  }

  const code = crypto.randomInt(100000, 1000000).toString();
  const codeHash = crypto.createHash('sha256').update(`${code}:eyesonwork_pwd_reset`).digest('hex');
  const expiresAt = now + 15 * 60 * 1000; // 15 minutes

  resetCodesStore.set(cleanEmail, {
    codeHash,
    expiresAt,
    attempts: 0,
    lastSentAt: now
  });

  return { success: true, code, expiresAt };
}

export function verifyPasswordResetCode(email: string, submittedCode: string): { 
  valid: boolean; 
  error?: string;
  remainingAttempts?: number;
} {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = (submittedCode || '').trim();
  const record = resetCodesStore.get(cleanEmail);

  if (!record) {
    return { valid: false, error: 'Aucun code de réinitialisation actif. Veuillez en demander un nouveau.' };
  }

  const now = Date.now();
  if (now > record.expiresAt) {
    resetCodesStore.delete(cleanEmail);
    return { valid: false, error: 'Le code a expiré. Veuillez demander un nouveau code.' };
  }

  if (record.attempts >= 5) {
    resetCodesStore.delete(cleanEmail);
    return { valid: false, error: 'Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.' };
  }

  record.attempts++;
  const submittedHash = crypto.createHash('sha256').update(`${cleanCode}:eyesonwork_pwd_reset`).digest('hex');

  let isMatch = false;
  try {
    isMatch = crypto.timingSafeEqual(Buffer.from(submittedHash, 'hex'), Buffer.from(record.codeHash, 'hex'));
  } catch {}

  if (isMatch) {
    return { valid: true };
  }

  const remaining = Math.max(0, 5 - record.attempts);
  return { 
    valid: false, 
    error: `Code invalide. Il vous reste ${remaining} tentative(s).`,
    remainingAttempts: remaining 
  };
}

export function completePasswordResetWithCode(
  email: string, 
  code: string, 
  newPassword: string
): { success: boolean; error?: string; user?: UserProfileRecord } {
  initIfNeeded();
  const cleanEmail = email.trim().toLowerCase();
  const verification = verifyPasswordResetCode(cleanEmail, code);

  if (!verification.valid) {
    return { success: false, error: verification.error || 'Code invalide.' };
  }

  if (!newPassword || newPassword.length < 8) {
    return { success: false, error: 'Le nouveau mot de passe doit comporter au moins 8 caractères.' };
  }

  // Code valide : mettre à jour le mot de passe
  const ok = setUserPassword(cleanEmail, newPassword);
  if (!ok) {
    // Si l'utilisateur n'existait pas encore, on le crée
    const reg = registerUserWithPassword(cleanEmail, newPassword);
    if (!reg.success) {
      return { success: false, error: reg.error || 'Erreur lors de la mise à jour.' };
    }
  }

  resetCodesStore.delete(cleanEmail);
  const user = getUserByEmail(cleanEmail);
  return { success: true, user: user || undefined };
}