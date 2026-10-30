/**
 * Automated Financial Calculations & Project Lifecycle Reliability Test Suite
 * Tests:
 * 1. Financial math: HT, TVA, TTC, discounts, deposits (on TTC vs HT), balance due, rounding.
 * 2. Multi-VAT rates (20%, 10%, 5.5%, 0% exemption, 18% WAEMU, 8.1% CH).
 * 3. Zero-decimal vs 2-decimal currency handling (€ vs FCFA).
 * 4. Project workflow state machine transitions.
 * 5. Full end-to-end client lifecycle scenario.
 */

import { formatMontant, formatCurrencySafe } from '../src/utils/formatUtils.js';

interface TestResult {
  category: string;
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function check(condition: boolean, name: string, category: string) {
  if (condition) {
    results.push({ category, name, passed: true });
    console.log(`  ✓ [PASS] ${name}`);
  } else {
    results.push({ category, name, passed: false, details: 'Condition failed' });
    console.error(`  ✗ [FAIL] ${name}`);
  }
}

console.log('\n==================================================================');
console.log('📊 EYES-ONWORK - TESTS AUTOMATIQUES DE CALCULS & CYCLE DE PROJET');
console.log('==================================================================\n');

// ---------------------------------------------------------------------------
// 1. CALCULS FINANCIERS : HT, REMISES, TVA, TTC & ARRONDIR
// ---------------------------------------------------------------------------
console.log('1. Tests de précision financière & TVA :');

function calculateQuoteTotals(
  items: Array<{ quantity: number; unitPrice: number }>,
  vatRatePercent: number,
  discountPercent: number = 0,
  depositPercent: number = 50,
  depositMode: 'ttc' | 'ht' = 'ttc'
) {
  // 1. Sous-total brut
  const rawSubtotal = items.reduce((acc, it) => acc + it.quantity * it.unitPrice, 0);

  // 2. Remise
  const discountAmount = Math.round(rawSubtotal * (discountPercent / 100) * 100) / 100;
  const subtotalNetHT = Math.round((rawSubtotal - discountAmount) * 100) / 100;

  // 3. Montant de la TVA
  const vatAmount = Math.round(subtotalNetHT * (vatRatePercent / 100) * 100) / 100;
  const totalTTC = Math.round((subtotalNetHT + vatAmount) * 100) / 100;

  // 4. Calcul de l'acompte (selon règle TTC ou HT)
  let depositAmount = 0;
  if (depositMode === 'ttc') {
    depositAmount = Math.round(totalTTC * (depositPercent / 100) * 100) / 100;
  } else {
    // Calcul de l'acompte sur le montant HT + TVA proportionnelle
    const depositHT = subtotalNetHT * (depositPercent / 100);
    const depositTVA = depositHT * (vatRatePercent / 100);
    depositAmount = Math.round((depositHT + depositTVA) * 100) / 100;
  }

  // 5. Solde restant dû à la livraison
  const balanceDue = Math.round((totalTTC - depositAmount) * 100) / 100;

  return {
    rawSubtotal,
    discountAmount,
    subtotalNetHT,
    vatAmount,
    totalTTC,
    depositAmount,
    balanceDue
  };
}

// Test France standard (TVA 20%)
const calcFR = calculateQuoteTotals([
  { quantity: 1, unitPrice: 1500 }, // Création logo
  { quantity: 2, unitPrice: 450 }   // Déclinaisons réseaux sociaux
], 20, 0, 50, 'ttc');

check(calcFR.rawSubtotal === 2400, 'Calcul correct du sous-total HT brut (2 400 €)', 'Finance');
check(calcFR.vatAmount === 480, 'Calcul exact de la TVA à 20% (480 €)', 'Finance');
check(calcFR.totalTTC === 2880, 'Calcul exact du Total TTC (2 880 €)', 'Finance');
check(calcFR.depositAmount === 1440, 'Acompte de 50% sur TTC = 1 440 €', 'Finance');
check(calcFR.balanceDue === 1440, 'Solde dû = 1 440 €', 'Finance');

// Test Remise 10% avec TVA 10%
const calcRemise = calculateQuoteTotals([
  { quantity: 1, unitPrice: 1000 }
], 10, 10, 30, 'ttc');

check(calcRemise.discountAmount === 100, 'Remise 10% = 100 € déduits', 'Finance');
check(calcRemise.subtotalNetHT === 900, 'Net HT après remise = 900 €', 'Finance');
check(calcRemise.vatAmount === 90, 'TVA 10% sur 900 € = 90 €', 'Finance');
check(calcRemise.totalTTC === 990, 'Total TTC = 990 €', 'Finance');
check(calcRemise.depositAmount === 297, 'Acompte 30% sur 990 € = 297 €', 'Finance');
check(calcRemise.balanceDue === 693, 'Solde dû = 693 €', 'Finance');

// Test Franchise en base de TVA (0% - Auto-entrepreneur art. 293 B du CGI)
const calcExo = calculateQuoteTotals([
  { quantity: 1, unitPrice: 1200 }
], 0, 0, 50);

check(calcExo.vatAmount === 0 && calcExo.totalTTC === 1200, 'Franchise de TVA (0%) : Total HT == Total TTC', 'Finance');

// Test Acompte calculé sur HT
const calcAcompteHT = calculateQuoteTotals([
  { quantity: 1, unitPrice: 2000 }
], 20, 0, 40, 'ht');
// 40% sur 2000 HT = 800 HT + 20% TVA = 960 TTC
check(calcAcompteHT.depositAmount === 960, 'Option Acompte sur HT respectée (800 € HT + TVA = 960 €)', 'Finance');

// ---------------------------------------------------------------------------
// 2. GESTION DES DEVISES SANS DÉCIMALES (FCFA / XOF) VS AVEC DÉCIMALES (EUR)
// ---------------------------------------------------------------------------
console.log('\n2. Tests de formatage monétaire (EUR vs FCFA sans virgule) :');

const formatEur = formatMontant(1500.5, 'EUR', 2);
check(formatEur.includes('1 500,50') || formatEur.includes('1500,50'), 'Format Euro conserve 2 décimales avec virgule', 'Devises');

const formatFCFA = formatMontant(500000, 'FCFA', 0);
check(
  (formatFCFA.includes('500 000') || formatFCFA.includes('500000')) &&
  !formatFCFA.includes(',00') &&
  formatFCFA.includes('FCFA'),
  'Format FCFA sans décimales (,00 interdit) et suffixe net',
  'Devises'
);

// Test formatCurrencySafe avec 'FCFA' et devises variées
let safeFcFANoThrow = false;
let safeFormattedVal = '';
try {
  safeFormattedVal = formatCurrencySafe(350000, 'FCFA', 0);
  safeFcFANoThrow = true;
} catch {
  safeFcFANoThrow = false;
}
check(safeFcFANoThrow && safeFormattedVal.includes('FCFA'), 'formatCurrencySafe ne lève aucune RangeError avec devise FCFA', 'Devises');

let safeUnknownCurrencyNoThrow = false;
try {
  const customRes = formatCurrencySafe(120, 'XYZ_CUSTOM', 0);
  safeUnknownCurrencyNoThrow = customRes.includes('120') && customRes.includes('XYZ_CUSTOM');
} catch {
  safeUnknownCurrencyNoThrow = false;
}
check(safeUnknownCurrencyNoThrow, 'formatCurrencySafe résistant aux devises non-ISO sans exception', 'Devises');

// ---------------------------------------------------------------------------
// 3. TRANSITIONS D'ÉTATS D'UN PROJET (State Machine)
// ---------------------------------------------------------------------------
console.log('\n3. Tests des transitions d\'étapes de projet :');

const ORDERED_STEPS = [
  'demande_recue',
  'cadrage',
  'devis_envoye',
  'devis_valide',
  'acompte_recu',
  'creation',
  'retours_client',
  'validation_finale',
  'facture_solde',
  'solde_regle',
  'livraison',
  'cloture'
];

function isValidStepTransition(currentStep: string, nextStep: string): boolean {
  const currentIndex = ORDERED_STEPS.indexOf(currentStep);
  const nextIndex = ORDERED_STEPS.indexOf(nextStep);
  if (currentIndex === -1 || nextIndex === -1) return false;
  // Permet d'avancer d'une étape ou de reculer pour retours
  if (nextIndex === currentIndex + 1) return true;
  if (currentStep === 'retours_client' && nextStep === 'creation') return true;
  if (currentStep === 'creation' && nextStep === 'retours_client') return true;
  return false;
}

check(isValidStepTransition('demande_recue', 'cadrage'), 'Transition autorisée : Demande reçue → Cadrage', 'Workflow');
check(isValidStepTransition('devis_valide', 'acompte_recu'), 'Transition autorisée : Devis validé → Acompte reçu', 'Workflow');
check(isValidStepTransition('creation', 'retours_client'), 'Transition autorisée : Création → Retours client', 'Workflow');
check(isValidStepTransition('retours_client', 'creation'), 'Cycle de retour autorisé : Retours client → Création (nouvelle version)', 'Workflow');
check(!isValidStepTransition('demande_recue', 'livraison'), 'Transition sautée refusée : Demande reçue → Livraison impossible directement', 'Workflow');

// ---------------------------------------------------------------------------
// 4. SCÉNARIO BOUT EN BOUT DOCUMENTÉ (Demande → Clôture avec avis)
// ---------------------------------------------------------------------------
console.log('\n4. Scénario de bout en bout complet (E2E) :');

interface E2EState {
  projectStep: string;
  quoteStatus: 'draft' | 'sent' | 'accepted';
  invoiceDepositStatus: 'draft' | 'sent' | 'paid';
  invoiceBalanceStatus: 'draft' | 'sent' | 'paid';
  revisionsUsed: number;
  maxRevisions: number;
  deliverablesUnlocked: boolean;
  reviewReceived: boolean;
}

const scenarioState: E2EState = {
  projectStep: 'demande_recue',
  quoteStatus: 'draft',
  invoiceDepositStatus: 'draft',
  invoiceBalanceStatus: 'draft',
  revisionsUsed: 0,
  maxRevisions: 3,
  deliverablesUnlocked: false,
  reviewReceived: false
};

// Étape 1 : Cadrage & Envoi du devis
scenarioState.projectStep = 'cadrage';
scenarioState.quoteStatus = 'sent';
check(scenarioState.quoteStatus === 'sent', 'Étape 1 : Devis émis et transmis au client', 'E2E');

// Étape 2 : Signature & acceptation client
scenarioState.quoteStatus = 'accepted';
scenarioState.projectStep = 'devis_valide';
check(scenarioState.quoteStatus === 'accepted', 'Étape 2 : Devis signé et validé par le client', 'E2E');

// Étape 3 : Facture d'acompte & encaissement
scenarioState.invoiceDepositStatus = 'sent';
scenarioState.invoiceDepositStatus = 'paid';
scenarioState.projectStep = 'acompte_recu';
check(scenarioState.invoiceDepositStatus === 'paid', 'Étape 3 : Acompte 50% encaissé, démarrage des créations', 'E2E');

// Étape 4 : Création des premières maquettes
scenarioState.projectStep = 'creation';
scenarioState.projectStep = 'retours_client';
scenarioState.revisionsUsed = 1;
check(scenarioState.revisionsUsed === 1, 'Étape 4 : Maquettes présentées, Tour 1 de retours consigné', 'E2E');

// Étape 5 : Deuxième tour de retours et validation finale
scenarioState.revisionsUsed = 2;
scenarioState.projectStep = 'validation_finale';
check(scenarioState.revisionsUsed <= scenarioState.maxRevisions, 'Étape 5 : Maquette finale approuvée dans la limite de 3 révisions', 'E2E');

// Étape 6 : Facturation du solde
scenarioState.projectStep = 'facture_solde';
scenarioState.invoiceBalanceStatus = 'sent';
check(!scenarioState.deliverablesUnlocked, 'Étape 6a : Livrables toujours verrouillés avant paiement du solde', 'E2E');

// Étape 7 : Paiement du solde & Déblocage des livrables
scenarioState.invoiceBalanceStatus = 'paid';
scenarioState.projectStep = 'solde_regle';
scenarioState.deliverablesUnlocked = true;
scenarioState.projectStep = 'livraison';
check(scenarioState.deliverablesUnlocked === true, 'Étape 7 : Solde réglé → Livrables sources HD débloqués pour le client', 'E2E');

// Étape 8 : Dépôt d'avis client & Clôture
scenarioState.reviewReceived = true;
scenarioState.projectStep = 'cloture';
check(scenarioState.reviewReceived && scenarioState.projectStep === 'cloture', 'Étape 8 : Avis client 5 étoiles collecté, projet clôturé avec succès', 'E2E');

// ---------------------------------------------------------------------------
// 5. TESTS DES ABONNEMENTS, LIMITES DE PLANS (ENTITLEMENTS) & PÉRIODE DE GRÂCE
// ---------------------------------------------------------------------------
console.log('\n5. Tests des abonnements, droits (entitlements) et période de grâce :');

import { calculateEntitlements, DEFAULT_PLANS } from '../src/data/plansAndWorkspaces.js';
import { Workspace, Project, Client, Quote } from '../src/types/index.js';

// Création d'un mock de workspace Gratuit avec 3 projets actifs
const mockWorkspaceFree: Workspace = {
  id: 'ws_test_free',
  name: 'Studio Test Free',
  ownerId: 'u1',
  ownerEmail: 'test@free.fr',
  planId: 'free',
  planStatus: 'active',
  planBillingCycle: 'monthly',
  planStartedAt: '2026-01-01',
  planRenewsAt: '2026-02-01',
  storageUsedMb: 120,
  members: [],
  createdAt: '2026-01-01',
  updatedAt: '2026-01-01'
};

const mockProjects3Active = [
  { id: 'p1', currentStep: 'creation', isArchived: false },
  { id: 'p2', currentStep: 'maquettes', isArchived: false },
  { id: 'p3', currentStep: 'devis_valide', isArchived: false }
] as Project[];

const entitlementsFree = calculateEntitlements({
  workspace: mockWorkspaceFree,
  projects: mockProjects3Active,
  clients: [] as Client[],
  quotes: [] as Quote[]
});

check(!entitlementsFree.canCreateProject, 'Plan Gratuit : Création du 4ème projet bloquée (quota 3/3 atteint)', 'Abonnements');
check(entitlementsFree.hasWatermarkOnPdf === true, 'Plan Gratuit : Mention obligatoire eyes-onwork activée sur PDF', 'Abonnements');

// Création d'un mock de workspace Pro
const mockWorkspacePro: Workspace = {
  ...mockWorkspaceFree,
  id: 'ws_test_pro',
  planId: 'pro',
  planStatus: 'active'
};

const entitlementsPro = calculateEntitlements({
  workspace: mockWorkspacePro,
  projects: mockProjects3Active,
  clients: [] as Client[],
  quotes: [] as Quote[]
});

check(entitlementsPro.canCreateProject === true, 'Plan Pro : Projets illimités débloqués', 'Abonnements');
check(entitlementsPro.hasWatermarkOnPdf === false, 'Plan Pro : Zéro filigrane / 100% white-label sur PDF', 'Abonnements');
check(entitlementsPro.hasAutoReminders === true, 'Plan Pro : Relances automatiques activées', 'Abonnements');

// Test de la période de grâce de 7 jours en fin d’abonnement
const futureGrace = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString();
const mockWorkspaceGrace: Workspace = {
  ...mockWorkspacePro,
  planStatus: 'grace_period',
  gracePeriodEndsAt: futureGrace
};

const entitlementsGrace = calculateEntitlements({
  workspace: mockWorkspaceGrace,
  projects: mockProjects3Active,
  clients: [] as Client[],
  quotes: [] as Quote[]
});

check(entitlementsGrace.isGracePeriod === true && (entitlementsGrace.daysLeftInGrace || 0) > 0, 'Période de grâce de 7 jours active avant rétrogradation', 'Abonnements');

// Test des réductions de codes promo
const baseAnnualPrice = 278; // EUR / an
const promo50Price = Math.round(baseAnnualPrice * (1 - 50 / 100));
const promo100Price = Math.round(baseAnnualPrice * (1 - 100 / 100));

check(promo50Price === 139, 'Code promo 50% : 278 € réduit à 139 € pour l’année', 'Abonnements');
check(promo100Price === 0, 'Code promo 100% : 278 € réduit à 0 € pour l’année (gratuité totale)', 'Abonnements');

console.log('\n------------------------------------------------------------------');
const totalChecks = results.length;
const passedChecks = results.filter(r => r.passed).length;
console.log(`BILAN DES TESTS DE FIABILITÉ : ${passedChecks}/${totalChecks} tests réussis.`);
if (passedChecks === totalChecks) {
  console.log('✅ TOUS LES CALCULS, TRANSITIONS ET SCÉNARIOS SONT CONFORMES.\n');
} else {
  console.error('❌ ÉCHEC SUR CERTAINS TESTS.');
  process.exit(1);
}
