import { formatMontant } from './formatUtils';
import { CatalogService, CatalogPack, ProjectTemplate, CatalogUnit } from '../types';

/**
 * Moteur financier & tarification centralisé eyes-onwork.
 * Stockage des montants sous forme d'entiers dans la plus petite unité :
 * - FCFA / XOF / XAF / JPY : entier direct sans décimale (1 FCFA = 1 unité)
 * - EUR / USD / CAD / GBP / CHF : centimes entiers (1 € = 100 centimes)
 */

export interface CatalogCategoryDef {
  id: string;
  label: string;
}

export const STANDARD_CATALOG_CATEGORIES: CatalogCategoryDef[] = [
  { id: 'logo', label: 'Logo' },
  { id: 'identite_visuelle', label: 'Identité visuelle' },
  { id: 'affiche', label: 'Affiche' },
  { id: 'flyer', label: 'Flyer' },
  { id: 'carte_visite', label: 'Carte de visite' },
  { id: 'packaging', label: 'Packaging' },
  { id: 'reseaux_sociaux', label: 'Réseaux sociaux' },
  { id: 'impression', label: 'Impression' },
  { id: 'formation', label: 'Formation' },
  { id: 'autre', label: 'Autre' }
];

export function getCategoryLabel(catId: string, customCategories: string[] = []): string {
  const std = STANDARD_CATALOG_CATEGORIES.find(c => c.id === catId);
  if (std) return std.label;
  const custom = customCategories.find(c => c === catId);
  if (custom) return custom;
  return catId || 'Autre';
}

export function isZeroDecimalCurrency(currency: string = 'EUR'): boolean {
  const upper = (currency || 'EUR').trim().toUpperCase();
  return upper === 'FCFA' || upper === 'XOF' || upper === 'XAF' || upper === 'JPY' ||
         upper === 'FR' || upper === 'FR.' || upper === 'FRANC' || upper === 'FRANCS' ||
         upper === 'F CFA' || upper.includes('FCFA') || upper.includes('CFA');
}

export function getCurrencyMultiplier(currency: string = 'EUR'): number {
  return isZeroDecimalCurrency(currency) ? 1 : 100;
}

/**
 * Convertit un montant décimal de saisie utilisateur en plus petite unité entière.
 * Ex: 1200.50 € -> 120050 centimes
 * Ex: 50000 FCFA -> 50000 FCFA
 */
export function toSmallestUnit(amount: number | string, currency: string = 'EUR'): number {
  const numeric = typeof amount === 'number' ? amount : parseFloat(String(amount).replace(/,/g, '.'));
  if (isNaN(numeric) || numeric < 0) return 0;
  const mult = getCurrencyMultiplier(currency);
  return Math.round(numeric * mult);
}

/**
 * Convertit la plus petite unité entière en montant décimal pour calculs et inputs.
 * Ex: 120050 centimes -> 1200.50 €
 * Ex: 50000 FCFA -> 50000 FCFA
 */
export function fromSmallestUnit(cents: number | undefined | null, currency: string = 'EUR'): number {
  const numeric = typeof cents === 'number' && !isNaN(cents) ? cents : 0;
  const mult = getCurrencyMultiplier(currency);
  return numeric / mult;
}

/**
 * Formate un montant stocké en plus petite unité pour affichage propre via formatMontant.
 */
export function formatSmallestUnit(cents: number | undefined | null, currency: string = 'EUR'): string {
  const displayAmount = fromSmallestUnit(cents, currency);
  return formatMontant(displayAmount, currency);
}

/**
 * Formatage sécurisé d'un montant décimal ou entier sans caractères invisibles corrompus
 */
export function formatCurrencySafe(amount: number | undefined | null, currency: string = 'EUR'): string {
  const isZeroDec = isZeroDecimalCurrency(currency);
  const val = typeof amount === 'number' && !isNaN(amount) ? (isZeroDec ? Math.round(amount) : amount) : 0;
  return formatMontant(val, currency);
}

/**
 * Calcule le total HT en centimes d'une liste d'articles avec quantités.
 */
export function calculateItemsTotalCents(items: Array<{ quantity: number; unitPriceCents: number }>): number {
  if (!items || !items.length) return 0;
  return items.reduce((sum, it) => {
    const qty = Math.max(0, it.quantity || 0);
    const unitPrice = Math.max(0, it.unitPriceCents || 0);
    return sum + (qty * unitPrice);
  }, 0);
}

/**
 * Calcule le montant de TVA en plus petite unité.
 */
export function calculateTaxCents(htCents: number, taxRatePercent: number | null | undefined): number {
  if (!taxRatePercent || taxRatePercent <= 0) return 0;
  const safeHt = Math.max(0, htCents || 0);
  return Math.round(safeHt * (taxRatePercent / 100));
}

/**
 * Calcule le TTC à partir du HT et du taux de taxe.
 */
export function calculateTtcCents(htCents: number, taxRatePercent: number | null | undefined): number {
  const safeHt = Math.max(0, htCents || 0);
  const tax = calculateTaxCents(safeHt, taxRatePercent);
  return safeHt + tax;
}

export interface DocumentLinePricingInput {
  unitPrice: number;
  quantity: number;
  vatRate?: number;
}

export interface DocumentTotalsOptions {
  discountPercent?: number;
  defaultVatRate?: number;
  depositPercent?: number;
  depositCalculation?: 'ttc' | 'ht';
  currency?: string;
}

export interface DocumentTotalsResult {
  subtotalHT: number;
  discountPercent: number;
  discountAmount: number;
  netHT: number;
  vatRate: number;
  vatAmount: number;
  totalTTC: number;
  depositPercent: number;
  depositAmount: number;
}

/**
 * Module de calcul financier centralisé & testé pour l'ensemble des documents :
 * Projets, Devis, Factures, PDF et Statistiques.
 * Gère les devises sans décimales (FCFA, XOF, XAF, JPY) et avec décimales (EUR, USD, CHF, CAD).
 * Applique la TVA par ligne, les remises proportionnelles et l'acompte TTC ou HT.
 */
export function calculateDocumentTotals(
  lines: DocumentLinePricingInput[] = [],
  options: DocumentTotalsOptions = {}
): DocumentTotalsResult {
  const currency = options.currency || 'EUR';
  const zeroDecimal = isZeroDecimalCurrency(currency);
  const defaultVat = options.defaultVatRate !== undefined && !isNaN(options.defaultVatRate) ? Math.max(0, options.defaultVatRate) : 20;
  const discountPct = options.discountPercent !== undefined && !isNaN(options.discountPercent) ? Math.min(100, Math.max(0, options.discountPercent)) : 0;
  const depositPct = options.depositPercent !== undefined && !isNaN(options.depositPercent) ? Math.min(100, Math.max(0, options.depositPercent)) : 50;
  const depositMode = options.depositCalculation || 'ttc';

  const round = (val: number): number => {
    if (zeroDecimal) {
      return Math.round(val);
    }
    return Math.round((val + Number.EPSILON) * 100) / 100;
  };

  if (!lines || lines.length === 0) {
    return {
      subtotalHT: 0,
      discountPercent: discountPct,
      discountAmount: 0,
      netHT: 0,
      vatRate: defaultVat,
      vatAmount: 0,
      totalTTC: 0,
      depositPercent: depositPct,
      depositAmount: 0
    };
  }

  // 1. Sous-total brut HT
  let rawSubtotalHT = 0;
  lines.forEach(line => {
    const qty = Math.max(0, line.quantity || 0);
    const price = Math.max(0, line.unitPrice || 0);
    rawSubtotalHT += qty * price;
  });
  const subtotalHT = round(rawSubtotalHT);

  // 2. Remise
  const rawDiscount = subtotalHT * (discountPct / 100);
  const discountAmount = round(rawDiscount);
  const netHT = round(Math.max(0, subtotalHT - discountAmount));

  // 3. TVA par ligne (avec prorata de remise)
  const discountRatio = subtotalHT > 0 ? (netHT / subtotalHT) : (1 - discountPct / 100);
  let rawVatTotal = 0;
  lines.forEach(line => {
    const qty = Math.max(0, line.quantity || 0);
    const price = Math.max(0, line.unitPrice || 0);
    const lineHT = qty * price;
    const lineNetHT = lineHT * discountRatio;
    const lineVatRate = line.vatRate !== undefined && !isNaN(line.vatRate) ? Math.max(0, line.vatRate) : defaultVat;
    rawVatTotal += lineNetHT * (lineVatRate / 100);
  });
  const vatAmount = round(rawVatTotal);

  // 4. Total TTC
  const totalTTC = round(netHT + vatAmount);

  // 5. Acompte (selon réglage TTC ou HT)
  const depositBase = depositMode === 'ht' ? netHT : totalTTC;
  const depositAmount = round(depositBase * (depositPct / 100));

  return {
    subtotalHT,
    discountPercent: discountPct,
    discountAmount,
    netHT,
    vatRate: defaultVat,
    vatAmount,
    totalTTC,
    depositPercent: depositPct,
    depositAmount
  };
}

/**
 * Générateur séquentiel continu sans trou pour la numérotation légale (DEV-AAAA-NNN, FAC-AAAA-NNN).
 * Détecte le numéro le plus élevé existant pour l'année en cours et incrémente de façon strictement continue.
 */
export function generateNextDocumentNumber(
  existingNumbers: string[],
  docType: 'DEV' | 'FAC',
  year: number = new Date().getFullYear(),
  customPrefix?: string
): string {
  const defaultPrefix = `${docType}-${year}-`;
  const prefixToMatch = customPrefix && customPrefix.includes(String(year)) ? customPrefix : defaultPrefix;

  let maxNum = 0;
  const regex = new RegExp(`^${docType}[-_]${year}[-_](\\d+)`, 'i');

  (existingNumbers || []).forEach(numStr => {
    if (!numStr) return;
    const match = numStr.match(regex);
    if (match && match[1]) {
      const parsed = parseInt(match[1], 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    } else if (customPrefix && numStr.startsWith(customPrefix)) {
      const rest = numStr.slice(customPrefix.length);
      const parsed = parseInt(rest, 10);
      if (!isNaN(parsed) && parsed > maxNum) {
        maxNum = parsed;
      }
    }
  });

  const nextSeq = maxNum + 1;
  const paddedSeq = String(nextSeq).padStart(3, '0');
  return `${prefixToMatch}${paddedSeq}`;
}

/**
 * Validation d'une prestation de catalogue
 */
export function validatePrestationData(data: Partial<CatalogService>): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || !data.name.trim()) {
    errors.push('Le nom de la prestation est obligatoire.');
  }

  if (data.unitPriceCents === undefined || data.unitPriceCents === null || isNaN(data.unitPriceCents) || data.unitPriceCents < 0) {
    errors.push('Le tarif unitaire HT doit être supérieur ou égal à 0.');
  }

  if (data.turnaroundDays !== undefined && (isNaN(data.turnaroundDays) || data.turnaroundDays < 1)) {
    errors.push('Le délai type doit être d’au moins 1 jour ouvré.');
  }

  if (data.revisionLimit !== undefined && (isNaN(data.revisionLimit) || data.revisionLimit < 0)) {
    errors.push('Le nombre de révisions incluses ne peut pas être négatif.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validation d'un pack de prestations
 */
export function validatePackData(data: Partial<CatalogPack> & { items?: any[]; packPriceCents?: number }): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || !data.name.trim()) {
    errors.push('Le nom du pack est obligatoire.');
  }

  const itemsList = data.items || data.serviceIds;
  if (!itemsList || itemsList.length === 0) {
    errors.push('Le pack doit contenir au moins une prestation.');
  }

  const price = data.packPriceCents !== undefined ? data.packPriceCents : data.priceCents;
  if (price === undefined || price === null || isNaN(price) || price < 0) {
    errors.push('Le tarif du pack doit être supérieur ou égal à 0.');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Suggestions de prestations courantes pour les comptes neufs.
 * Fournies avec suggestions de descriptifs, unités, délais et révisions,
 * et un prix suggéré que le freelance peut personnaliser librement (sans prix imposé).
 */
export interface DefaultPrestationSuggestion {
  id: string;
  name: string;
  category: string;
  deliverableDescription: string;
  unit: CatalogUnit;
  suggestedPriceEur: number;
  suggestedPriceFcfa: number;
  turnaroundDays: number;
  revisionLimit: number;
}

export const COMMON_PRESTATION_SUGGESTIONS: DefaultPrestationSuggestion[] = [
  {
    id: 'sug_logo',
    name: 'Création de Logo & Logotype',
    category: 'logo',
    deliverableDescription: 'Recherche créative, 3 pistes de logotypes distinctes, déclinaisons couleurs & noir/blanc, fichiers vectoriels HD (.AI, .EPS, .SVG, .PNG).',
    unit: 'forfait',
    suggestedPriceEur: 1200,
    suggestedPriceFcfa: 750000,
    turnaroundDays: 14,
    revisionLimit: 3
  },
  {
    id: 'sug_brand',
    name: 'Identité Visuelle & Charte Graphique Complète',
    category: 'identite_visuelle',
    deliverableDescription: 'Guide de normes graphiques complet (typographies, palette colorimétrique, règles d’usage, interdits, papeterie et modèles vectoriels).',
    unit: 'forfait',
    suggestedPriceEur: 2400,
    suggestedPriceFcfa: 1500000,
    turnaroundDays: 21,
    revisionLimit: 3
  },
  {
    id: 'sug_poster',
    name: 'Affiche Grand Format & Événementielle (A1/A2/A3)',
    category: 'affiche',
    deliverableDescription: 'Direction artistique visuelle percutante, travail typographique et composition. Fichiers prêts pour rotative ou impression numérique (CMJN, 300 DPI, traits de coupe).',
    unit: 'forfait',
    suggestedPriceEur: 750,
    suggestedPriceFcfa: 450000,
    turnaroundDays: 7,
    revisionLimit: 2
  },
  {
    id: 'sug_flyer',
    name: 'Flyer Publicitaire / Dépliant 2 à 3 Volets',
    category: 'flyer',
    deliverableDescription: 'Mise en page recto-verso ou triptyque avec hiérarchisation de contenu, iconographie et préparation BAT pour imprimeur.',
    unit: 'forfait',
    suggestedPriceEur: 450,
    suggestedPriceFcfa: 280000,
    turnaroundDays: 5,
    revisionLimit: 2
  },
  {
    id: 'sug_business_card',
    name: 'Carte de Visite Haut de Gamme',
    category: 'carte_visite',
    deliverableDescription: 'Conception recto/verso avec finitions spéciales (vernis sélectif 3D, dorure à chaud, gaufrage), gabarits prêts pour l’atelier d’impression.',
    unit: 'forfait',
    suggestedPriceEur: 250,
    suggestedPriceFcfa: 150000,
    turnaroundDays: 3,
    revisionLimit: 2
  },
  {
    id: 'sug_packaging',
    name: 'Packaging, Étiquette & Boîtage Produit',
    category: 'packaging',
    deliverableDescription: 'Design de volume sur tracé de découpe fourni, mise en conformité des mentions légales, codes-barres et préparation technique pré-presse.',
    unit: 'forfait',
    suggestedPriceEur: 1600,
    suggestedPriceFcfa: 1000000,
    turnaroundDays: 14,
    revisionLimit: 2
  },
  {
    id: 'sug_social',
    name: 'Kit Réseaux Sociaux & Templates Figma (12 Visuels)',
    category: 'reseaux_sociaux',
    deliverableDescription: 'Composants Figma adaptatifs (posts carrés, carrousels LinkedIn, stories Instagram), grilles typographiques et exports prêts à publier.',
    unit: 'forfait',
    suggestedPriceEur: 850,
    suggestedPriceFcfa: 500000,
    turnaroundDays: 7,
    revisionLimit: 2
  },
  {
    id: 'sug_day_rate',
    name: 'Accompagnement DA / Journée de Direction Artistique',
    category: 'formation',
    deliverableDescription: 'Journée d’intervention créative dédiée (conseil stratégique, ateliers design, validation de maquettes ou shooting).',
    unit: 'jour',
    suggestedPriceEur: 650,
    suggestedPriceFcfa: 400000,
    turnaroundDays: 1,
    revisionLimit: 1
  }
];

/**
 * Détermine si une facture est en retard de paiement (échéance passée et solde dû non nul).
 */
export function isInvoiceOverdue(invoice: {
  dueDate: string;
  totalTTC: number;
  paidAmount: number;
  balanceDue?: number;
  status: string;
  isCancelled?: boolean;
}): boolean {
  if (invoice.isCancelled || invoice.status === 'cancelled' || invoice.status === 'paid') {
    return false;
  }
  const due = invoice.balanceDue !== undefined ? invoice.balanceDue : (invoice.totalTTC - invoice.paidAmount);
  if (due <= 0) return false;

  const dueTimestamp = new Date(invoice.dueDate).getTime();
  return !isNaN(dueTimestamp) && dueTimestamp < Date.now();
}

/**
 * Retourne le statut effectif de la facture (prend en compte l'échéance automatique).
 */
export function getEffectiveInvoiceStatus(invoice: {
  dueDate: string;
  totalTTC: number;
  paidAmount: number;
  balanceDue?: number;
  status: string;
  isCancelled?: boolean;
}): string {
  if (invoice.isCancelled || invoice.status === 'cancelled') return 'cancelled';
  const due = invoice.balanceDue !== undefined ? invoice.balanceDue : (invoice.totalTTC - invoice.paidAmount);
  if (due <= 0) return 'paid';
  if (isInvoiceOverdue(invoice)) return 'overdue';
  return invoice.status;
}

/**
 * Calcul unifié des totaux financiers d'un projet (facturé, encaissé, reste à facturer, solde dû).
 */
export function calculateProjectFinancials(
  project: { budget: number; totalTTC?: number; lines?: Array<{ unitPrice: number; quantity: number }> },
  invoices: Array<{ totalTTC: number; paidAmount: number; isCancelled?: boolean }>
) {
  const budgetTTC = project.totalTTC ?? project.budget ?? 0;
  const activeInvoices = (invoices || []).filter(i => !i.isCancelled);
  const totalInvoicedTTC = activeInvoices.reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);
  const totalPaidTTC = activeInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const remainingToInvoiceTTC = Math.max(0, budgetTTC - totalInvoicedTTC);
  const balanceDueTTC = Math.max(0, totalInvoicedTTC - totalPaidTTC);

  return {
    budgetTTC,
    totalInvoicedTTC,
    totalPaidTTC,
    remainingToInvoiceTTC,
    balanceDueTTC
  };
}

/**
 * Calcul unifié des totaux financiers d'un client.
 */
export function calculateClientFinancials(
  clientId: string,
  projects: Array<{ id: string; clientId: string; isArchived?: boolean; currentStep?: string }>,
  invoices: Array<{ clientId: string; totalTTC: number; paidAmount: number; isCancelled?: boolean }>
) {
  const clientProjects = (projects || []).filter(p => p.clientId === clientId);
  const clientInvoices = (invoices || []).filter(i => i.clientId === clientId && !i.isCancelled);

  const totalInvoicedTTC = clientInvoices.reduce((sum, inv) => sum + (inv.totalTTC || 0), 0);
  const totalPaidTTC = clientInvoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const balanceDueTTC = Math.max(0, totalInvoicedTTC - totalPaidTTC);
  const activeProjectsCount = clientProjects.filter(p => !p.isArchived && p.currentStep !== 'livre').length;

  return {
    clientProjects,
    clientInvoices,
    totalInvoicedTTC,
    totalPaidTTC,
    balanceDueTTC,
    activeProjectsCount
  };
}
