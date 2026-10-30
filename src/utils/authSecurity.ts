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

// Suivi anti-brute force des tentatives de connexion en mémoire locale
const LOGIN_ATTEMPTS_KEY = 'eyesonwork_login_attempts';
const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

export interface LoginAttemptState {
  attempts: number;
  lockedUntil?: number;
}

export function checkLoginRateLimit(identifier: string): { isLocked: boolean; waitMinutes?: number } {
  try {
    const raw = localStorage.getItem(`${LOGIN_ATTEMPTS_KEY}_${identifier}`);
    if (!raw) return { isLocked: false };
    const state: LoginAttemptState = JSON.parse(raw);
    const now = Date.now();
    if (state.lockedUntil && state.lockedUntil > now) {
      const waitMinutes = Math.ceil((state.lockedUntil - now) / (60 * 1000));
      return { isLocked: true, waitMinutes };
    }
    return { isLocked: false };
  } catch {
    return { isLocked: false };
  }
}

export function recordFailedLoginAttempt(identifier: string): { isNowLocked: boolean; waitMinutes?: number } {
  try {
    const key = `${LOGIN_ATTEMPTS_KEY}_${identifier}`;
    const raw = localStorage.getItem(key);
    const state: LoginAttemptState = raw ? JSON.parse(raw) : { attempts: 0 };
    state.attempts += 1;

    if (state.attempts >= MAX_ATTEMPTS) {
      state.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
      localStorage.setItem(key, JSON.stringify(state));
      return { isNowLocked: true, waitMinutes: 15 };
    }

    localStorage.setItem(key, JSON.stringify(state));
    return { isNowLocked: false };
  } catch {
    return { isNowLocked: false };
  }
}

export function resetLoginAttempts(identifier: string): void {
  try {
    localStorage.removeItem(`${LOGIN_ATTEMPTS_KEY}_${identifier}`);
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
