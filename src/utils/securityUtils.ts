/**
 * Utilitaires de sécurité pour eyes-onwork :
 * - Protection contre les injections XSS
 * - Nettoyage et assainissement des noms de fichiers
 * - Validation stricte des téléversements (types et tailles)
 * - Génération de jetons cryptographiques sécurisés pour les liens clients
 */

/**
 * Échappe les caractères HTML dangereux pour prévenir les failles XSS (Cross-Site Scripting)
 */
export function escapeHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Supprime les balises HTML et scripts d'une chaîne
 */
export function stripHtml(str: string | null | undefined): string {
  if (!str) return '';
  return String(str).replace(/<[^>]*>?/gm, '');
}

/**
 * Liste noire stricte des extensions exécutables ou dangereuses
 */
export const FORBIDDEN_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'php', 'phtml', 'php3', 'php4', 'php5',
  'py', 'pyc', 'pyw', 'js', 'mjs', 'cjs', 'ts', 'vbs', 'vbe', 'wsf',
  'jar', 'bin', 'msi', 'com', 'scr', 'cpl', 'dll', 'reg', 'hta', 'html', 'htm'
]);

/**
 * Liste blanche des extensions graphiques et documentaires autorisées
 */
export const ALLOWED_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'webp', 'svg', 'gif', 'avif',
  'pdf', 'ai', 'psd', 'eps', 'indd', 'sketch', 'fig',
  'zip', 'rar', '7z', 'tar', 'gz',
  'otf', 'ttf', 'woff', 'woff2',
  'mp4', 'mov', 'txt', 'csv'
]);

/**
 * Nettoie un nom de fichier pour éviter les attaques par traversée de répertoires (Directory Traversal)
 * et supprime les caractères non sécurisés.
 */
export function sanitizeUploadedFileName(rawName: string): string {
  if (!rawName) return `fichier_${Date.now()}`;

  // Supprime le chemin complet s'il est fourni (ex: C:\path\ ou ../../)
  const baseName = rawName.split(/[/\\]/).pop() || 'fichier';

  // Sépare le nom et l'extension
  const lastDot = baseName.lastIndexOf('.');
  const ext = lastDot > 0 ? baseName.slice(lastDot + 1).toLowerCase() : '';
  const nameWithoutExt = lastDot > 0 ? baseName.slice(0, lastDot) : baseName;

  // Nettoie le nom de base : remplace accents et caractères spéciaux
  const cleanBase = nameWithoutExt
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 80);

  // Vérifie si l'extension est interdite
  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return `${cleanBase || 'fichier'}.blocked`;
  }

  const cleanExt = ext.replace(/[^a-z0-9]/g, '');
  return cleanExt ? `${cleanBase || 'fichier'}.${cleanExt}` : (cleanBase || 'fichier');
}

/**
 * Valide un fichier avant téléversement (taille, extension, type)
 */
export function validateUploadedFile(
  file: { name: string; size: number; type?: string },
  maxSizeMb: number = 50
): { valid: boolean; error?: string } {
  if (!file) {
    return { valid: false, error: 'Fichier invalide ou inexistant.' };
  }

  const maxBytes = maxSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `Le fichier dépasse la taille maximale autorisée de ${maxSizeMb} Mo (taille détectée : ${(file.size / (1024 * 1024)).toFixed(1)} Mo).`
    };
  }

  const lastDot = file.name.lastIndexOf('.');
  const ext = lastDot > 0 ? file.name.slice(lastDot + 1).toLowerCase() : '';

  if (FORBIDDEN_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Format de fichier non autorisé (.${ext}). Les fichiers exécutables ou scripts sont strictement interdits.`
    };
  }

  // Vérification de la liste blanche si extension présente
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    return {
      valid: false,
      error: `Format non reconnu (.${ext}). Formats acceptés : images, PDF, archives (ZIP), maquettes (PSD/AI) et polices.`
    };
  }

  return { valid: true };
}

/**
 * Génère un jeton cryptographiquement aléatoire et long pour les liens de partage client
 * Évite toute donnée sensible ou prévisible dans l'URL.
 */
export function generateSecureToken(length: number = 48): string {
  // Utilise l'API Web Crypto si disponible, compatible navigateur et Node.js
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(Math.ceil(length / 2));
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
      .slice(0, length);
  }

  // Fallback sécurisé
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
