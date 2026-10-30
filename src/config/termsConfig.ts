/**
 * Configuration centralisée pour les conditions d'utilisation et la confidentialité.
 * Défini à un seul endroit pour toute l'application.
 */
export const APP_CONFIG = {
  CURRENT_TERMS_VERSION: '2026.1',
  CURRENT_PRIVACY_VERSION: '2026.1',
  APP_NAME: 'eyes-onwork',
} as const;

export const CURRENT_TERMS_VERSION = APP_CONFIG.CURRENT_TERMS_VERSION;
export const CURRENT_PRIVACY_VERSION = APP_CONFIG.CURRENT_PRIVACY_VERSION;
