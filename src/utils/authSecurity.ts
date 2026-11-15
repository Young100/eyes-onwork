import { SecuritySession, AccountAuditEvent } from '../types';

export const TERMS_CURRENT_VERSION = '2026.1';
export const PRIVACY_CURRENT_VERSION = '2026.1';
export const TERMS_LAST_UPDATED = '01 Octobre 2026';

// Liste des mots de passe trop courants interdits
const FORBIDDEN_COMMON_PASSWORDS = new Set([
  '1234567890',
  'password123',
  'password1234',
  'azertyuiop',
  'qwertyuiop',
  'motdepasse1',
  'admin123456',
  'soleil12345',
  'graphiste12',
  'eyesonwork1',
  'bonjour1234',
  '12345678901',
  'iloveyou123'
]);

export interface PasswordStrengthResult {
  score: number; // 0 to 4
  label: 'Très faible' | 'Faible' | 'Moyen' | 'Fort' | 'Excellent';
  color: string;
  isValid: boolean;
  errors: string[];
}

export function evaluatePasswordStrength(password: string): PasswordStrengthResult {
  const errors: string[] = [];
  const trimmed = password.trim();

  if (trimmed.length < 10) {
    errors.push('Au moins 10 caractères requis');
  }

  if (FORBIDDEN_COMMON_PASSWORDS.has(trimmed.toLowerCase())) {
    errors.push('Ce mot de passe est trop courant et facile à deviner');
  }

  const hasLower = /[a-z]/.test(trimmed);
  const hasUpper = /[A-Z]/.test(trimmed);
  const hasDigit = /[0-9]/.test(trimmed);
  const hasSpecial = /[^A-Za-z0-9]/.test(trimmed);

  if (!hasLower) errors.push('Une lettre minuscule requise');
  if (!hasUpper) errors.push('Une lettre majuscule requise');
  if (!hasDigit) errors.push('Un chiffre requis');

  let score = 0;
  if (trimmed.length >= 10) score += 1;
  if (trimmed.length >= 14) score += 1;
  if (hasLower && hasUpper) score += 1;
  if (hasDigit) score += 1;
  if (hasSpecial) score += 1;

  // Cap score to 4
  const normalizedScore = Math.min(4, Math.max(0, score - 1));

  let label: PasswordStrengthResult['label'] = 'Faible';
  let color = '#D9695F'; // red

  switch (normalizedScore) {
    case 0:
      label = 'Très faible';
      color = '#D9695F';
      break;
    case 1:
      label = 'Faible';
      color = '#E59866';
      break;
    case 2:
      label = 'Moyen';
      color = '#F4D03F';
      break;
    case 3:
      label = 'Fort';
      color = '#52BE80';
      break;
    case 4:
      label = 'Excellent';
      color = '#f7c548'; // gold champagne
      break;
  }

  const isValid = trimmed.length >= 10 && !FORBIDDEN_COMMON_PASSWORDS.has(trimmed.toLowerCase()) && (hasLower || hasUpper) && hasDigit;

  return {
    score: normalizedScore,
    label,
    color,
    isValid,
    errors
  };
}

// Suivi anti-brute force avec délai croissant après échecs (en plus de la limite Firebase)
const LOGIN_ATTEMPTS_KEY = 'eyesonwork_login_attempts';
const GLOBAL_ATTEMPTS_IDENTIFIER = '__global__';
// Barème du délai croissant en secondes : 1er échec = 0s, 2e = 3s, 3e = 10s, 4e = 30s, 5e = 60s, 6e = 180s, 7e = 300s, 8e+ = 900s
export const ESCALATING_DELAY_SECONDS = [0, 3, 10, 30, 60, 180, 300, 900];

export interface LoginAttemptState {
  attempts: number;
  lockedUntil?: number;
}

export function getEscalatingDelayForAttempt(attemptCount: number): number {
  if (attemptCount <= 0) return 0;
  const idx = Math.min(attemptCount - 1, ESCALATING_DELAY_SECONDS.length - 1);
  return ESCALATING_DELAY_SECONDS[idx];
}

export function formatDelayDuration(totalSeconds: number): string {
  const secs = Math.max(0, Math.ceil(totalSeconds));
  if (secs < 60) {
    return `${secs} seconde${secs > 1 ? 's' : ''}`;
  }
  const minutes = Math.floor(secs / 60);
  const remSeconds = secs % 60;
  if (remSeconds === 0) {
    return `${minutes} minute${minutes > 1 ? 's' : ''}`;
  }
  return `${minutes} min ${remSeconds}s`;
}

function readAttemptState(key: string): LoginAttemptState {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { attempts: 0 };
    const parsed = JSON.parse(raw);
    return {
      attempts: typeof parsed?.attempts === 'number' ? parsed.attempts : 0,
      lockedUntil: typeof parsed?.lockedUntil === 'number' ? parsed.lockedUntil : undefined
    };
  } catch {
    return { attempts: 0 };
  }
}

export function checkLoginRateLimit(identifier: string): {
  isLocked: boolean;
  remainingSeconds: number;
  waitMinutes?: number;
  attempts: number;
} {
  try {
    const cleanId = (identifier || '').trim().toLowerCase() || GLOBAL_ATTEMPTS_IDENTIFIER;
    const perUserState = readAttemptState(`${LOGIN_ATTEMPTS_KEY}_${cleanId}`);
    const globalState = readAttemptState(`${LOGIN_ATTEMPTS_KEY}_${GLOBAL_ATTEMPTS_IDENTIFIER}`);
    const now = Date.now();

    const perUserRem = perUserState.lockedUntil && perUserState.lockedUntil > now
      ? Math.ceil((perUserState.lockedUntil - now) / 1000)
      : 0;
    const globalRem = globalState.lockedUntil && globalState.lockedUntil > now
      ? Math.ceil((globalState.lockedUntil - now) / 1000)
      : 0;

    const remainingSeconds = Math.max(perUserRem, globalRem);
    const attempts = Math.max(perUserState.attempts, globalState.attempts);

    if (remainingSeconds > 0) {
      return {
        isLocked: true,
        remainingSeconds,
        waitMinutes: Math.ceil(remainingSeconds / 60),
        attempts
      };
    }
    return { isLocked: false, remainingSeconds: 0, attempts };
  } catch {
    return { isLocked: false, remainingSeconds: 0, attempts: 0 };
  }
}

export function recordFailedLoginAttempt(
  identifier: string,
  minDelaySeconds: number = 0
): {
  isNowLocked: boolean;
  delaySeconds: number;
  remainingSeconds: number;
  waitMinutes?: number;
  attempts: number;
} {
  try {
    const cleanId = (identifier || '').trim().toLowerCase() || GLOBAL_ATTEMPTS_IDENTIFIER;
    const userKey = `${LOGIN_ATTEMPTS_KEY}_${cleanId}`;
    const globalKey = `${LOGIN_ATTEMPTS_KEY}_${GLOBAL_ATTEMPTS_IDENTIFIER}`;

    const userState = readAttemptState(userKey);
    const globalState = readAttemptState(globalKey);

    userState.attempts += 1;
    globalState.attempts += 1;

    const userDelay = getEscalatingDelayForAttempt(userState.attempts);
    const globalDelay = getEscalatingDelayForAttempt(globalState.attempts);
    const delaySeconds = Math.max(userDelay, globalDelay, minDelaySeconds);

    const now = Date.now();
    if (delaySeconds > 0) {
      const lockedUntil = now + delaySeconds * 1000;
      userState.lockedUntil = Math.max(userState.lockedUntil || 0, lockedUntil);
      globalState.lockedUntil = Math.max(globalState.lockedUntil || 0, lockedUntil);
    }

    localStorage.setItem(userKey, JSON.stringify(userState));
    localStorage.setItem(globalKey, JSON.stringify(globalState));

    return {
      isNowLocked: delaySeconds > 0,
      delaySeconds,
      remainingSeconds: delaySeconds,
      waitMinutes: delaySeconds > 0 ? Math.ceil(delaySeconds / 60) : undefined,
      attempts: Math.max(userState.attempts, globalState.attempts)
    };
  } catch {
    return { isNowLocked: false, delaySeconds: 0, remainingSeconds: 0, attempts: 1 };
  }
}

export function resetLoginAttempts(identifier: string): void {
  try {
    const cleanId = (identifier || '').trim().toLowerCase();
    if (cleanId) {
      localStorage.removeItem(`${LOGIN_ATTEMPTS_KEY}_${cleanId}`);
    }
    localStorage.removeItem(`${LOGIN_ATTEMPTS_KEY}_${GLOBAL_ATTEMPTS_IDENTIFIER}`);
  } catch {
    // ignore
  }
}

// Sessions actives
export function getInitialSecuritySessions(userId: string): SecuritySession[] {
  return [
    {
      id: 'sess_curr',
      userId,
      device: 'MacBook Pro / macOS Sonoma',
      browser: 'Google Chrome 132',
      ip: '90.112.45.18',
      location: 'Paris, France',
      lastActiveAt: 'À l’instant',
      isCurrent: true
    },
    {
      id: 'sess_mobile',
      userId,
      device: 'iPhone 15 Pro / iOS 18',
      browser: 'Mobile Safari',
      ip: '82.64.120.91',
      location: 'Paris, France',
      lastActiveAt: 'Il y a 3 heures',
      isCurrent: false
    }
  ];
}
