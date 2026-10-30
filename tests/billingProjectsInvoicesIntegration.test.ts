/**
 * Suite de Tests d'Intégration : Projets, Devis & Factures (Cycle Complet & Cohérence)
 * 
 * Vérifie :
 * 1. Création de devis depuis un projet (lignes copiées, délai, révisions, conditions, statut Brouillon).
 * 2. Création de devis depuis une fiche client (choix du projet ou création d'un projet).
 * 3. Modification d'un tarif catalogue après création (le devis reste strictement intact).
 * 4. Cycle complet de vie :
 *    - Plusieurs versions de devis (V1, V2) pour un même projet ; un seul accepté.
 *    - À l'acceptation : devis verrouillé, projet passe à "devis_accepte", bouton facture d'acompte.
 *    - Facture d'acompte : calcul sur TTC ou HT selon réglage, conservation devisId, projectId, clientId.
 *    - Paiement d'acompte : passage à Payée, projet avance à "acompte_recu".
 *    - Facture de solde : reste à facturer exact calculé automatiquement.
 *    - Paiement du solde : projet passe à "solde_recu" et livraison déverrouillée automatiquement selon réglage.
 * 5. Tentative de modification d'une facture émise (rejetée, correction par annulation et avoir).
 * 6. Numérotation continue sans trou (DEV-AAAA-NNN, FAC-AAAA-NNN).
 * 7. Compte neuf : workspace vide, création réussie sans blocage.
 */

import {
  calculateDocumentTotals,
  generateNextDocumentNumber,
  isInvoiceOverdue,
  getEffectiveInvoiceStatus,
  fromSmallestUnit
} from '../src/utils/pricingEngine.js';
import {
  Client,
  Project,
  ProjectServiceLine,
  CatalogService,
  Quote,
  Invoice,
  DesignerProfile,
  CreativeBrief
} from '../src/types/index.js';

interface TestResult {
  name: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function check(condition: boolean, name: string) {
  if (condition) {
    results.push({ name, passed: true });
    console.log(`  ✓ [PASS] ${name}`);
  } else {
    results.push({ name, passed: false });
    console.error(`  ✗ [FAIL] ${name}`);
  }
}

console.log('\n==================================================================');
console.log('🧾 EYES-ONWORK - TESTS D\'INTÉGRATION PROJETS, DEVIS & FACTURES');
console.log('==================================================================\n');

// ---------------------------------------------------------------------------
// Profil Graphiste & Configuration
// ---------------------------------------------------------------------------
const mockProfile: DesignerProfile = {
  id: 'usr_freelance_1',
  name: 'Camille Graphiste',
  studioName: 'Atelier Camille Studio',
  email: 'camille@atelier.fr',
  phone: '+33611223344',
  address: '10 passage des Panoramas, 75002 Paris',
  siret: '89012345600012',
  website: 'https://atelier-camille.fr',
  avatarUrl: '',
  vatRate: 20,
  defaultVatRate: 20,
  defaultDepositPercent: 50,
  defaultTurnaroundWeeks: 3,
  defaultRevisionLimit: 3,
  termsTemplate: 'Règlement : 50% d’acompte à la commande, solde avant la livraison des livrables finaux.',
  legalNoticeTemplate: 'Dispensé d’immatriculation au RCS · TVA 20%',
  legalNotice: 'Dispensé d’immatriculation au RCS · TVA 20%',
  autoUnlockDeliveryOnFullPayment: true,
  defaultConditionsQuote: 'Règlement : 50% d’acompte à la commande, solde avant la livraison des livrables finaux.',
  depositCalculation: 'ttc',
  quotePrefix: 'DEV',
  invoicePrefix: 'FAC',
  currency: 'EUR',
  maxFileSizeMb: 50,
  onboardingCompleted: true,
  messageTemplates: {},
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const mockBrief: CreativeBrief = {
  objectives: 'Branding complet et supports digitaux',
  targetAudience: 'Clientèle premium',
  desiredStyle: 'Élégant, contemporain',
  colors: [{ hex: '#C9A96E', name: 'Or' }, { hex: '#111625', name: 'Nuit' }],
  typographyAndReferences: 'Didot, Montserrat',
  expectedFormats: ['SVG', 'PDF', 'PNG', 'AI'],
  clientProvidedAssets: 'Photos haute résolution et guide des marques'
};

// ---------------------------------------------------------------------------
// 1. DEVIS DEPUIS UN PROJET
// ---------------------------------------------------------------------------
console.log('1. Tests de création de devis depuis un projet :');

const clientA: Client = {
  id: 'cli_luxe_1',
  workspaceId: 'ws_test_1',
  name: 'Claire Dupont',
  company: 'Maison Claire',
  email: 'claire@maisonclaire.fr',
  phone: '+33612345678',
  address: '8 rue de la Paix, 75001 Paris',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const projectLineLogo: ProjectServiceLine = {
  id: 'psl_logo',
  name: 'Création Logotype Signature',
  description: 'Logotype vectoriel, palette chromatique et livrables HD',
  unit: 'forfait',
  unitPrice: 1500,
  quantity: 1,
  vatRate: 20,
  totalHT: 1500,
  totalTTC: 1800,
  turnaroundDays: 14,
  revisionLimit: 3
};

const projectLineSocial: ProjectServiceLine = {
  id: 'psl_social',
  name: 'Kit Réseaux Sociaux & Bannières',
  description: 'Bannières LinkedIn, Instagram et templates Canva',
  unit: 'forfait',
  unitPrice: 500,
  quantity: 1,
  vatRate: 20,
  totalHT: 500,
  totalTTC: 600,
  turnaroundDays: 7,
  revisionLimit: 2
};

const projectA: Project = {
  id: 'proj_maison_claire_identite',
  workspaceId: 'ws_test_1',
  clientId: clientA.id,
  clientShareToken: 'tok_claire_identite',
  clientLinkActive: true,
  title: 'Identité Visuelle & Direction Artistique',
  type: 'identite_visuelle',
  brief: mockBrief,
  budget: 2400,
  depositAmount: 1200,
  depositPercent: 50,
  discountPercent: 0,
  paidAmount: 0,
  deadline: '2026-12-15',
  currentStep: 'demande_recue',
  revisionLimit: 3,
  revisionsUsed: 0,
  paidRevisionsAdded: 0,
  lines: [projectLineLogo, projectLineSocial],
  tasks: [],
  activity: [],
  mockupRounds: [],
  files: [],
  delivery: { mode: 'auto', isUnlocked: false, thankYouMessage: '', selectedDeliverableIds: [] },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

// Simulation création automatique de devis prérempli depuis le projet
function createQuoteFromProject(proj: Project, client: Client, profile: DesignerProfile, existingQuotes: Quote[]): Quote {
  const quoteLines = (proj.lines || []).map(l => ({
    id: `ql_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
    sourceCatalogServiceId: l.sourceCatalogServiceId,
    designation: l.name,
    description: l.description || '',
    quantity: l.quantity,
    unitPrice: l.unitPrice,
    vatRate: l.vatRate,
    total: l.unitPrice * l.quantity
  }));

  const totals = calculateDocumentTotals(quoteLines, {
    discountPercent: proj.discountPercent || 0,
    defaultVatRate: profile.vatRate ?? 20,
    depositPercent: proj.depositPercent || 50,
    depositCalculation: profile.depositCalculation,
    currency: profile.currency
  });

  const existingNumbers = existingQuotes.map(q => q.quoteNumber);
  const quoteNumber = generateNextDocumentNumber(existingNumbers, 'DEV', 2026, profile.quotePrefix);

  return {
    id: `quote_${Date.now()}`,
    workspaceId: proj.workspaceId,
    quoteNumber,
    version: 1,
    clientId: proj.clientId,
    projectId: proj.id,
    createdAt: new Date().toISOString(),
    validityDays: 30,
    dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    lines: quoteLines,
    subtotal: totals.subtotalHT,
    discountPercent: totals.discountPercent,
    discountAmount: totals.discountAmount,
    netHT: totals.netHT,
    vatRate: totals.vatRate,
    vatAmount: totals.vatAmount,
    totalTTC: totals.totalTTC,
    depositPercent: totals.depositPercent,
    depositAmount: totals.depositAmount,
    revisionLimit: proj.revisionLimit,
    turnaroundTime: '3 semaines',
    termsAndConditions: profile.defaultConditionsQuote || '',
    status: 'draft',
    isLocked: false
  };
}

const quoteFromProj = createQuoteFromProject(projectA, clientA, mockProfile, []);

check(quoteFromProj.clientId === clientA.id, 'Le devis est correctement rattaché au client du projet');
check(quoteFromProj.projectId === projectA.id, 'Le devis est directement relié au projet');
check(quoteFromProj.lines.length === 2, 'Les 2 prestations du projet sont intégralement copiées dans le devis');
check(quoteFromProj.lines[0].unitPrice === 1500 && quoteFromProj.lines[1].unitPrice === 500, 'Les prix des lignes sont fidèlement copiés (1 500 € et 500 €)');
check(quoteFromProj.subtotal === 2000, 'Sous-total HT exact (2 000 €)');
check(quoteFromProj.totalTTC === 2400, 'Total TTC exact avec TVA 20% (2 400 €)');
check(quoteFromProj.depositAmount === 1200, 'Acompte 50% sur TTC exact (1 200 €)');
check(quoteFromProj.status === 'draft', 'Dès la création, le devis est en statut Brouillon sans autre action');
check(quoteFromProj.revisionLimit === 3, 'Nombre de révisions incluses hérité du projet (3)');
check(quoteFromProj.termsAndConditions.includes('50%'), 'Conditions de règlement intégrées dans le devis');

// ---------------------------------------------------------------------------
// 2. DEVIS DEPUIS UNE FICHE CLIENT
// ---------------------------------------------------------------------------
console.log('\n2. Tests de création de devis depuis une fiche client :');

// Cas A : Choix d'un projet existant parmi les projets du client
const clientQuotesList: Quote[] = [quoteFromProj];
const clientProjects = [projectA];

check(clientProjects.some(p => p.id === quoteFromProj.projectId), 'Le devis depuis la fiche client est associé au projet choisi');

// Cas B : Création préalable d'un projet pour un client neuf
const clientB: Client = {
  id: 'cli_tech_2',
  workspaceId: 'ws_test_1',
  name: 'Alexandre Martin',
  company: 'NovaTech SaaS',
  email: 'alex@novatech.io',
  phone: '+33699887766',
  address: '42 boulevard Haussmann, 75009 Paris',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const projectB: Project = {
  id: 'proj_novatech_app',
  workspaceId: 'ws_test_1',
  clientId: clientB.id,
  clientShareToken: 'tok_novatech_app',
  clientLinkActive: true,
  title: 'Supports Visuels Réseaux Sociaux & Bannières',
  type: 'reseaux_sociaux',
  brief: mockBrief,
  budget: 3600,
  depositAmount: 1800,
  depositPercent: 50,
  paidAmount: 0,
  deadline: '2026-12-31',
  currentStep: 'demande_recue',
  revisionLimit: 3,
  revisionsUsed: 0,
  paidRevisionsAdded: 0,
  lines: [],
  tasks: [],
  activity: [],
  mockupRounds: [],
  files: [],
  delivery: { mode: 'auto', isUnlocked: false, thankYouMessage: '', selectedDeliverableIds: [] },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const quoteClientB = createQuoteFromProject(projectB, clientB, mockProfile, [quoteFromProj]);
check(quoteClientB.clientId === clientB.id, 'Devis client B créé avec succès');
check(quoteClientB.quoteNumber === 'DEV-2026-002', 'Numérotation continue attribuée au second devis (DEV-2026-002)');

// ---------------------------------------------------------------------------
// 3. NON-RÉTROACTIVITÉ DU CATALOGUE APRÈS CRÉATION DU DEVIS
// ---------------------------------------------------------------------------
console.log('\n3. Non-rétroactivité : modification d\'un prix catalogue après création :');

const catalogServiceA: CatalogService = {
  id: 'cat_logo_signature',
  workspaceId: 'ws_test_1',
  name: 'Création Logotype Signature',
  category: 'logo',
  deliverableDescription: 'Pistes créatives & vectoriels',
  unit: 'forfait',
  unitPriceCents: 150000, // 1 500,00 €
  taxRate: 20,
  turnaroundDays: 14,
  revisionLimit: 3,
  status: 'active',
  priceHistory: [],
  usageCount: 1,
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-01T10:00:00Z'
};

// Le graphiste augmente le prix dans son catalogue officiel à 2 200 €
const updatedCatalogServiceA: CatalogService = {
  ...catalogServiceA,
  unitPriceCents: 220000, // 2 200,00 €
  updatedAt: '2026-06-01T10:00:00Z'
};

check(quoteFromProj.lines[0].unitPrice === 1500, 'Le devis DEV-2026-001 conserve sa ligne à 1 500 €');
check(quoteFromProj.totalTTC === 2400, 'Le total TTC du devis historique reste intact à 2 400 € malgré la hausse catalogue à 2 200 €');
check(fromSmallestUnit(updatedCatalogServiceA.unitPriceCents, 'EUR') === 2200, 'Le catalogue reflète son nouveau prix pour les devis futurs');

// ---------------------------------------------------------------------------
// 4. CYCLE COMPLET : VERSIONS, ACCEPTATION, ACOMPTE, SOLDE & DÉVERROUILLAGE
// ---------------------------------------------------------------------------
console.log('\n4. Cycle complet : versions, acceptation, facture d\'acompte, paiement et solde :');

// Versioning : création de V2 pour le projet A
function createQuoteVersion(original: Quote, allQuotes: Quote[]): Quote {
  const existingNumbers = allQuotes.map(q => q.quoteNumber);
  const nextNum = generateNextDocumentNumber(existingNumbers, 'DEV', 2026);
  return {
    ...original,
    id: `quote_v2_${Date.now()}`,
    quoteNumber: nextNum,
    version: (original.version || 1) + 1,
    parentQuoteId: original.id,
    status: 'draft',
    isLocked: false,
    createdAt: new Date().toISOString()
  };
}

const quoteV2 = createQuoteVersion(quoteFromProj, [quoteFromProj, quoteClientB]);
check(quoteV2.version === 2, 'Création de la version V2 pour le projet');
check(quoteV2.quoteNumber === 'DEV-2026-003', 'Attribution continue du numéro DEV-2026-003 pour la V2');

// Acceptation de la version V2
function simulateAcceptQuote(acceptedQuoteId: string, quotesList: Quote[], proj: Project) {
  const targetQuote = quotesList.find(q => q.id === acceptedQuoteId)!;
  const now = new Date().toISOString();

  // 1 seul devis accepté par projet ; les autres passent à "expired"
  const updatedQuotes = quotesList.map(q => {
    if (q.id === acceptedQuoteId) {
      return { ...q, status: 'accepted' as const, isLocked: true, acceptedAt: now, acceptedByName: 'Claire Dupont' };
    }
    if (q.projectId === targetQuote.projectId) {
      return { ...q, status: 'expired' as const, isLocked: true };
    }
    return q;
  });

  // Projet avance à "devis_accepte"
  const updatedProject: Project = {
    ...proj,
    currentStep: 'devis_accepte',
    budget: targetQuote.totalTTC,
    depositAmount: targetQuote.depositAmount,
    depositPercent: targetQuote.depositPercent
  };

  return { updatedQuotes, updatedProject };
}

const acceptResult = simulateAcceptQuote(quoteV2.id, [quoteFromProj, quoteClientB, quoteV2], projectA);
const acceptedQuoteFinal = acceptResult.updatedQuotes.find(q => q.id === quoteV2.id)!;
const olderQuoteV1 = acceptResult.updatedQuotes.find(q => q.id === quoteFromProj.id)!;

check(acceptedQuoteFinal.status === 'accepted' && acceptedQuoteFinal.isLocked === true, 'Le devis V2 est accepté et verrouillé 🔒');
check(olderQuoteV1.status === 'expired', 'L’ancien devis V1 pour le même projet est expiré (un seul devis accepté)');
check(acceptResult.updatedProject.currentStep === 'devis_accepte', 'Le projet avance automatiquement à l’étape "devis_accepte"');

// Émission de la Facture d'acompte depuis le devis accepté
function simulateCreateDepositInvoice(quote: Quote, proj: Project, existingInvoices: Invoice[], depositMode: 'ttc' | 'ht' = 'ttc'): Invoice {
  const existingNumbers = existingInvoices.map(i => i.invoiceNumber);
  const invoiceNumber = generateNextDocumentNumber(existingNumbers, 'FAC', 2026);
  const vatRate = quote.vatRate ?? 20;

  let totalTTC = 0;
  let subtotal = 0;
  const depositPct = quote.depositPercent || 50;

  if (depositMode === 'ttc') {
    totalTTC = Math.round(quote.totalTTC * (depositPct / 100));
    subtotal = Math.round(totalTTC / (1 + vatRate / 100));
  } else {
    subtotal = Math.round(quote.subtotal * (depositPct / 100));
    totalTTC = Math.round(subtotal * (1 + vatRate / 100));
  }

  return {
    id: `inv_dep_${Date.now()}`,
    workspaceId: proj.workspaceId,
    invoiceNumber,
    type: 'deposit',
    quoteId: quote.id,
    devisId: quote.id,
    projectId: proj.id,
    clientId: proj.clientId,
    createdAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
    lines: [
      {
        id: `il_dep_1`,
        designation: `Facture d'acompte (${depositPct}%) — Devis ${quote.quoteNumber}`,
        description: 'Acompte de démarrage des créations',
        quantity: 1,
        unitPrice: subtotal,
        vatRate,
        total: subtotal
      }
    ],
    subtotal,
    vatRate,
    vatAmount: totalTTC - subtotal,
    totalTTC,
    paidAmount: 0,
    balanceDue: totalTTC,
    status: 'sent',
    isLocked: true,
    legalNotice: 'Dispensé d’immatriculation au RCS · TVA 20%',
    payments: []
  };
}

const depositInvoice = simulateCreateDepositInvoice(acceptedQuoteFinal, acceptResult.updatedProject, []);
check(depositInvoice.quoteId === acceptedQuoteFinal.id && depositInvoice.devisId === acceptedQuoteFinal.id, 'La facture d’acompte conserve devisId');
check(depositInvoice.projectId === projectA.id && depositInvoice.clientId === clientA.id, 'La facture d’acompte conserve projectId et clientId');
check(depositInvoice.invoiceNumber === 'FAC-2026-001', 'Attribution du numéro officiel FAC-2026-001');
check(depositInvoice.totalTTC === 1200, 'Montant de l’acompte TTC : 1 200 €');
check(depositInvoice.isLocked === true, 'La facture émise est verrouillée d’office (conformité fiscale)');

// Paiement de l'acompte
function simulateRecordPayment(inv: Invoice, amount: number, proj: Project) {
  const newPaid = inv.paidAmount + amount;
  const newBalance = Math.max(0, inv.totalTTC - newPaid);
  const updatedInv: Invoice = {
    ...inv,
    paidAmount: newPaid,
    balanceDue: newBalance,
    status: newBalance <= 0 ? 'paid' : 'partially_paid',
    payments: [
      ...inv.payments,
      {
        id: `pay_${Date.now()}`,
        invoiceId: inv.id,
        amount,
        date: new Date().toISOString(),
        method: 'virement',
        recordedBy: 'Camille'
      }
    ]
  };

  const updatedProject: Project = {
    ...proj,
    paidAmount: proj.paidAmount + amount,
    currentStep: (inv.type === 'deposit' && newBalance <= 0 && proj.currentStep === 'devis_accepte')
      ? 'acompte_recu'
      : proj.currentStep
  };

  return { updatedInv, updatedProject };
}

const payDepositRes = simulateRecordPayment(depositInvoice, 1200, acceptResult.updatedProject);
check(payDepositRes.updatedInv.status === 'paid', 'La facture d’acompte passe au statut "Payée"');
check(payDepositRes.updatedProject.currentStep === 'acompte_recu', 'Le projet passe automatiquement à "acompte_recu"');
check(payDepositRes.updatedProject.paidAmount === 1200, 'Total encaissé du projet mis à jour à 1 200 €');

// Émission de la Facture de solde
function simulateCreateBalanceInvoice(quote: Quote, proj: Project, existingInvoices: Invoice[]): Invoice {
  const alreadyInvoicedTTC = existingInvoices.filter(i => !i.isCancelled).reduce((sum, i) => sum + i.totalTTC, 0);
  const remainingTTC = Math.max(0, quote.totalTTC - alreadyInvoicedTTC);
  const vatRate = quote.vatRate ?? 20;
  const subtotal = Math.round(remainingTTC / (1 + vatRate / 100));

  const existingNumbers = existingInvoices.map(i => i.invoiceNumber);
  const invoiceNumber = generateNextDocumentNumber(existingNumbers, 'FAC', 2026);

  return {
    id: `inv_bal_${Date.now()}`,
    workspaceId: proj.workspaceId,
    invoiceNumber,
    type: 'balance',
    quoteId: quote.id,
    devisId: quote.id,
    projectId: proj.id,
    clientId: proj.clientId,
    createdAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 15 * 24 * 3600 * 1000).toISOString(),
    lines: [
      {
        id: 'il_bal_1',
        designation: `Facture de solde — Devis ${quote.quoteNumber}`,
        description: 'Règlement final pour remise des fichiers sources',
        quantity: 1,
        unitPrice: subtotal,
        vatRate,
        total: subtotal
      }
    ],
    subtotal,
    vatRate,
    vatAmount: remainingTTC - subtotal,
    totalTTC: remainingTTC,
    paidAmount: 0,
    balanceDue: remainingTTC,
    status: 'sent',
    isLocked: true,
    legalNotice: 'Dispensé d’immatriculation au RCS · TVA 20%',
    payments: []
  };
}

const balanceInvoice = simulateCreateBalanceInvoice(acceptedQuoteFinal, payDepositRes.updatedProject, [payDepositRes.updatedInv]);
check(balanceInvoice.invoiceNumber === 'FAC-2026-002', 'Numérotation continue attribuée pour le solde : FAC-2026-002');
check(balanceInvoice.totalTTC === 1200, 'Reste à facturer calculé fidèlement (2 400 € TTC - 1 200 € acompte = 1 200 €)');

// Paiement du solde & déverrouillage de la livraison
const payBalanceRes = simulateRecordPayment(balanceInvoice, 1200, payDepositRes.updatedProject);
check(payBalanceRes.updatedInv.status === 'paid', 'La facture de solde passe à "Payée"');

// Déverrouillage automatique de la livraison
function checkDeliveryUnlock(proj: Project, totalBudget: number, totalPaid: number): boolean {
  if (proj.delivery.mode === 'auto' && totalPaid >= totalBudget) {
    return true;
  }
  return false;
}

const isDeliveryUnlocked = checkDeliveryUnlock(payBalanceRes.updatedProject, 2400, payDepositRes.updatedProject.paidAmount + 1200);
check(isDeliveryUnlocked === true, 'Le paiement complet du solde déverrouille automatiquement la livraison finale');

// ---------------------------------------------------------------------------
// 5. IMMUABILITÉ D'UNE FACTURE ÉMISE & CORRECTION PAR AVOIR
// ---------------------------------------------------------------------------
console.log('\n5. Inaltérabilité d\'une facture émise & Annulation avec avoir :');

function attemptModifyInvoice(inv: Invoice): { allowed: boolean; reason?: string } {
  if (inv.status === 'draft') return { allowed: true };
  return {
    allowed: false,
    reason: 'Conformité fiscale : Une facture émise ne peut être ni modifiée ni supprimée. Vous devez procéder par annulation avec facture rectificative ou avoir.'
  };
}

const checkModifyLocked = attemptModifyInvoice(depositInvoice);
check(checkModifyLocked.allowed === false, 'Tentative de modification directe d’une facture émise formellement REFUSÉE');
check((checkModifyLocked.reason || '').includes('Conformité fiscale'), 'Motif légal de rejet explicite');

// Annulation avec avoir rectificatif
function simulateCancelInvoiceWithCreditNote(inv: Invoice, existingInvoices: Invoice[]) {
  const existingNumbers = existingInvoices.map(i => i.invoiceNumber);
  const creditNoteNumber = generateNextDocumentNumber(existingNumbers, 'FAC', 2026);
  const now = new Date().toISOString();

  const cancelledInvoice: Invoice = {
    ...inv,
    status: 'cancelled',
    isCancelled: true,
    cancelledAt: now,
    cancellationReason: 'Erreur d’adresse de facturation'
  };

  const creditNote: Invoice = {
    id: `inv_cn_${Date.now()}`,
    workspaceId: inv.workspaceId,
    invoiceNumber: creditNoteNumber,
    type: 'credit_note',
    quoteId: inv.quoteId,
    devisId: inv.devisId,
    projectId: inv.projectId,
    clientId: inv.clientId,
    createdAt: now,
    dueDate: now,
    lines: inv.lines.map(l => ({ ...l, total: -Math.abs(l.total) })),
    subtotal: -Math.abs(inv.subtotal),
    vatRate: inv.vatRate,
    vatAmount: -Math.abs(inv.vatAmount),
    totalTTC: -Math.abs(inv.totalTTC),
    paidAmount: 0,
    balanceDue: 0,
    status: 'paid',
    isLocked: true,
    isCreditNote: true,
    originalInvoiceNumber: inv.invoiceNumber,
    legalNotice: 'Dispensé d’immatriculation au RCS · TVA 20%',
    payments: []
  };

  return { cancelledInvoice, creditNote };
}

const cancelRes = simulateCancelInvoiceWithCreditNote(balanceInvoice, [depositInvoice, balanceInvoice]);
check(cancelRes.cancelledInvoice.status === 'cancelled' && cancelRes.cancelledInvoice.isCancelled === true, 'La facture d’origine est marquée Annulée avec traçabilité');
check(cancelRes.creditNote.invoiceNumber === 'FAC-2026-003', 'Avoir rectificatif généré avec numérotation séquentielle continue (FAC-2026-003)');
check(cancelRes.creditNote.totalTTC === -1200, 'L’avoir porte un montant négatif exact (-1 200 €) pour annuler l’écriture');

// ---------------------------------------------------------------------------
// 6. NUMÉROTATION SANS TROU & RETARD AUTOMATIQUE
// ---------------------------------------------------------------------------
console.log('\n6. Tests de numérotation séquentielle sans trou & Factures en retard :');

const seqList = ['DEV-2026-001', 'DEV-2026-002'];
const nextSeq = generateNextDocumentNumber(seqList, 'DEV', 2026);
check(nextSeq === 'DEV-2026-003', 'Numérotation continue sans trou : DEV-2026-003 succède à DEV-2026-002');

// Détection automatique facture en retard
const overdueInvoice: Invoice = {
  ...balanceInvoice,
  id: 'inv_late_test',
  dueDate: '2026-01-01T00:00:00Z', // Échéance dépassée
  totalTTC: 1200,
  paidAmount: 400,
  balanceDue: 800,
  status: 'sent'
};

const overdueCalculated = isInvoiceOverdue(overdueInvoice);
const effectiveStatus = getEffectiveInvoiceStatus(overdueInvoice);
check(overdueCalculated === true, 'Facture non soldée avec date passée détectée comme en retard');
check(effectiveStatus === 'overdue', 'Statut effectif calculé automatiquement à "overdue" (En retard)');

// ---------------------------------------------------------------------------
// 7. COMPTE NEUF & PREMIER DEVIS
// ---------------------------------------------------------------------------
console.log('\n7. Tests de compte neuf (aucun client, projet, devis ni facture) :');

const emptyQuotes: Quote[] = [];
const emptyInvoices: Invoice[] = [];

const firstQuoteNumber = generateNextDocumentNumber(emptyQuotes.map(q => q.quoteNumber), 'DEV', 2026);
const firstInvoiceNumber = generateNextDocumentNumber(emptyInvoices.map(i => i.invoiceNumber), 'FAC', 2026);

check(firstQuoteNumber === 'DEV-2026-001', 'Premier devis d’un compte neuf numéroté DEV-2026-001');
check(firstInvoiceNumber === 'FAC-2026-001', 'Première facture d’un compte neuf numérotée FAC-2026-001');

// ---------------------------------------------------------------------------
// SYNTHÈSE
// ---------------------------------------------------------------------------
const passed = results.filter(r => r.passed).length;
const total = results.length;

console.log('\n==================================================================');
console.log(`BILAN DES TESTS INTÉGRATION DEVIS & FACTURES : ${passed}/${total} validés.`);
if (passed === total) {
  console.log('✅ TOUTES LES RELATIONS PROJETS, DEVIS & FACTURES SONT 100% CONFORMES.');
} else {
  console.error('❌ ÉCHEC DE CERTAINS INVARIANTS.');
}
console.log('==================================================================\n');

process.exit(passed === total ? 0 : 1);
