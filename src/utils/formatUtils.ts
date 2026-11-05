/**
 * Centralized currency and number formatting utility for eyes-onwork.
 * Resolves the issue where U+202F (narrow no-break space) or U+00A0
 * renders as "/" or broken glyphs in PDF and text generators.
 */


export function formatMontant(
  valeur: number | undefined | null,
  devise: string = 'EUR',
  decimals: number = 2
): string {
  const num =
    typeof valeur === 'number' && Number.isFinite(valeur)
      ? valeur
      : 0;

  const rawDevise = (devise || 'EUR').trim();
  const upperDevise = rawDevise.toUpperCase();

  // Reconnaissance des différentes écritures du FCFA
  const isFCFA = [
    'FCFA',
    'XOF',
    'XAF',
    'CFA',
    'F CFA',
    'FR',
    'FR.',
    'FRANC',
    'FRANCS'
  ].includes(upperDevise) || upperDevise.includes('CFA');

  // FCFA : formatage numérique indépendant du symbole monétaire
  if (isFCFA) {
    const amount = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
      useGrouping: true
    })
      .format(num)
      .replace(/[\u202F\u00A0\u2007\u2009]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    return `${amount} FCFA`;
  }

  // Autres devises : formatage monétaire standard
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: upperDevise,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })
      .format(num)
      .replace(/[\u202F\u00A0\u2007\u2009]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  } catch {
    const amount = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(num);

    return `${amount} ${rawDevise}`;
  }
}


/**
 * Universal safe currency formatting helper for UI components.
 * Guarantees that invalid or custom ISO codes (such as 'FCFA') never crash with RangeError.
 */
export function formatCurrencySafe(val: number | undefined | null, devise: string = 'EUR', decimals: number = 0): string {
  return formatMontant(val, devise, decimals);
}

/**
 * Format compact numbers (e.g. for dashboard KPI cards)
 */
export function formatMontantCompact(valeur: number | undefined | null, devise: string = 'EUR'): string {
  return formatMontant(valeur, devise, 0);
}

/**
 * Clean file name for PDF downloads without spaces, accents, or illegal characters
 * Example: DEV-2026-018_MaisonSolene.pdf
 */
export function sanitizePdfFileName(docNumber: string, clientName?: string): string {
  const cleanDoc = (docNumber || 'DOCUMENT')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]/g, '_');

  const cleanClient = (clientName || 'Client')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '');

  return `${cleanDoc}_${cleanClient || 'Client'}.pdf`;
}
