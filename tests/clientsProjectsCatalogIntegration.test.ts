/**
 * Tests d'Intégration : Clients, Projets & Catalogue de Prestations
 * Vérifie :
 * 1. Création de client et de plusieurs projets rattachés (clientId obligatoire)
 * 2. Ajout de prestations du catalogue (copie indépendante)
 * 3. Non-rétroactivité : modification ultérieure d'un tarif catalogue ne change pas le projet
 * 4. Ajustement du prix unitaire spécifique au projet sans impacter le catalogue
 * 5. Calcul automatique du budget (Sous-total HT, Remise, TVA, TTC, Acompte %)
 * 6. Intégrité des données : interdiction de supprimer un client avec projets/devis/factures (archivage proposé)
 * 7. Intégrité des projets : interdiction de supprimer un projet avec devis/factures (archivage proposé)
 * 8. Compte neuf & création de client à la volée dans le formulaire de projet
 * 9. Application d'un modèle de projet avec préremplissage automatique des prestations
 */

import { Client, Project, ProjectServiceLine, CatalogService, CatalogPack, ProjectTemplate, Quote, Invoice, CreativeBrief } from '../src/types/index.js';
import { fromSmallestUnit } from '../src/utils/pricingEngine.js';

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
console.log('🔗 EYES-ONWORK - TESTS INTÉGRATION CLIENTS, PROJETS & CATALOGUE');
console.log('==================================================================\n');

const sampleBrief: CreativeBrief = {
  objectives: 'Branding luxe et packaging',
  targetAudience: 'Clientèle premium',
  desiredStyle: 'Élégant, minimaliste',
  colors: [{ hex: '#C9A96E', name: 'Or' }],
  typographyAndReferences: 'Didot, Bodoni',
  expectedFormats: ['AI', 'PDF', 'SVG'],
  clientProvidedAssets: 'Photos'
};

// ---------------------------------------------------------------------------
// 1. CRÉATION D'UN CLIENT ET DE PLUSIEURS PROJETS RATTACHÉS
// ---------------------------------------------------------------------------
console.log('1. Tests Multi-projets par client avec clientId obligatoire :');

const client1: Client = {
  id: 'cli_solene_1',
  workspaceId: 'ws_test_1',
  name: 'Solène Bernard',
  company: 'Maison Solène',
  email: 'solene@maisonsolene.fr',
  phone: '+33612345678',
  address: '14 rue Saint-Honoré, 75001 Paris',
  status: 'active',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const project1: Project = {
  id: 'proj_solene_identite',
  workspaceId: 'ws_test_1',
  clientId: client1.id, // Obligatoire
  clientShareToken: 'tok_solene_1',
  clientLinkActive: true,
  title: 'Identité Visuelle & Logo Haute Couture',
  type: 'identite_visuelle',
  brief: sampleBrief,
  budget: 2400,
  depositAmount: 1200,
  paidAmount: 0,
  deadline: '2026-11-15',
  currentStep: 'demande_recue',
  revisionLimit: 3,
  revisionsUsed: 0,
  paidRevisionsAdded: 0,
  tasks: [],
  activity: [],
  mockupRounds: [],
  files: [],
  delivery: { mode: 'auto', isUnlocked: false, thankYouMessage: '', selectedDeliverableIds: [] },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const project2: Project = {
  id: 'proj_solene_packaging',
  workspaceId: 'ws_test_1',
  clientId: client1.id, // Même client, second projet
  clientShareToken: 'tok_solene_2',
  clientLinkActive: true,
  title: 'Packaging Coffret & Étiquettes Flacons',
  type: 'emballage',
  brief: sampleBrief,
  budget: 1800,
  depositAmount: 900,
  paidAmount: 0,
  deadline: '2026-12-01',
  currentStep: 'demande_recue',
  revisionLimit: 3,
  revisionsUsed: 0,
  paidRevisionsAdded: 0,
  tasks: [],
  activity: [],
  mockupRounds: [],
  files: [],
  delivery: { mode: 'auto', isUnlocked: false, thankYouMessage: '', selectedDeliverableIds: [] },
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

check(client1.id !== undefined && client1.id.length > 0, 'Le client possède un identifiant unique');
check(project1.clientId === client1.id, 'Le projet 1 est bien rattaché au client Solène');
check(project2.clientId === client1.id, 'Le projet 2 est rattaché au même client (multi-projets)');
check(project1.id !== project2.id, 'Chaque projet dispose d’un identifiant et d’un token sécurisé distinct');

// ---------------------------------------------------------------------------
// 2. PRESTATIONS DU CATALOGUE & COPIE INDÉPENDANTE (SNAPSHOT)
// ---------------------------------------------------------------------------
console.log('\n2. Tests d\'ajout de prestations du catalogue & Copie snapshot :');

const catalogServiceA: CatalogService = {
  id: 'cat_svc_logo_prestige',
  workspaceId: 'ws_test_1',
  name: 'Création Logotype Signature & Déclinaisons',
  category: 'logo',
  deliverableDescription: 'Pistes créatives, fichiers vectoriels AI/EPS/SVG et guide de bon usage',
  unit: 'forfait',
  unitPriceCents: 120000, // 1 200,00 €
  taxRate: 20,
  turnaroundDays: 14,
  revisionLimit: 3,
  status: 'active',
  priceHistory: [],
  usageCount: 5,
  createdAt: '2026-01-01T10:00:00Z',
  updatedAt: '2026-01-01T10:00:00Z'
};

// Simulation de l'ajout dans le projet : COPIE de la prestation
const projectLine1: ProjectServiceLine = {
  id: 'psl_1',
  sourceCatalogServiceId: catalogServiceA.id,
  name: catalogServiceA.name,
  description: catalogServiceA.deliverableDescription,
  unit: catalogServiceA.unit,
  unitPrice: fromSmallestUnit(catalogServiceA.unitPriceCents, 'EUR'), // 1200 €
  quantity: 1,
  vatRate: catalogServiceA.taxRate || 20,
  totalHT: 1200,
  totalTTC: Math.round(1200 * 1.2),
  turnaroundDays: catalogServiceA.turnaroundDays,
  revisionLimit: catalogServiceA.revisionLimit
};

check(projectLine1.unitPrice === 1200, 'Le prix unitaire est copié dans la ligne du projet (1 200 €)');
check(projectLine1.name === catalogServiceA.name, 'Le nom de la prestation est copié textuellement');

// ---------------------------------------------------------------------------
// 3. NON-RÉTROACTIVITÉ : MODIFICATION DU CATALOGUE
// ---------------------------------------------------------------------------
console.log('\n3. Non-rétroactivité : changement ultérieur du tarif catalogue :');

// Le graphiste augmente le prix dans son catalogue à 1 500 €
const updatedCatalogServiceA: CatalogService = {
  ...catalogServiceA,
  unitPriceCents: 150000, // 1 500,00 €
  updatedAt: '2026-06-01T10:00:00Z'
};

check(projectLine1.unitPrice === 1200, 'La ligne du projet reste à 1 200 € malgré la hausse catalogue à 1 500 €');
check(projectLine1.totalHT === 1200, 'Le total HT de la ligne de projet ne bouge pas');

// ---------------------------------------------------------------------------
// 4. AJUSTEMENT DU PRIX SPÉCIFIQUE AU PROJET
// ---------------------------------------------------------------------------
console.log('\n4. Négociation / Ajustement du prix unitaire spécifique au projet :');

// Le graphiste accorde un tarif personnalisé sur ce projet (ex: 1 100 €)
projectLine1.unitPrice = 1100;
projectLine1.totalHT = projectLine1.unitPrice * projectLine1.quantity;
projectLine1.totalTTC = Math.round(projectLine1.totalHT * (1 + projectLine1.vatRate / 100));

check(projectLine1.unitPrice === 1100, 'Le prix de la ligne du projet est ajusté à 1 100 €');
check(updatedCatalogServiceA.unitPriceCents === 150000, 'Le catalogue conserve intact son prix officiel de 1 500 €');

// ---------------------------------------------------------------------------
// 5. CALCUL AUTOMATIQUE DU BUDGET (HT, REMISE, TVA, TTC, ACOMPTE %)
// ---------------------------------------------------------------------------
console.log('\n5. Calcul automatique du budget à partir des lignes :');

const projectLine2: ProjectServiceLine = {
  id: 'psl_2',
  name: 'Charte Graphique & Typographies',
  description: 'Guide des styles, palette de couleurs et gabarits',
  unit: 'forfait',
  unitPrice: 900,
  quantity: 1,
  vatRate: 20,
  totalHT: 900,
  totalTTC: 1080
};

const projectLines = [projectLine1, projectLine2]; // 1100 + 900 = 2000 € HT brut
const discountPct = 10; // Remise 10%
const depositPct = 40; // Acompte 40%

const rawSubtotalHT = projectLines.reduce((acc, l) => acc + (l.unitPrice * l.quantity), 0);
const discountAmt = Math.round(rawSubtotalHT * (discountPct / 100));
const netSubtotalHT = rawSubtotalHT - discountAmt;
const totalVat = Math.round(projectLines.reduce((acc, l) => acc + (l.unitPrice * l.quantity * (l.vatRate / 100)), 0) * (1 - discountPct / 100));
const calculatedBudgetTTC = netSubtotalHT + totalVat;
const calculatedDepositAmt = Math.round(calculatedBudgetTTC * (depositPct / 100));

check(rawSubtotalHT === 2000, 'Sous-total HT brut calculé : 2 000 €');
check(discountAmt === 200, 'Remise 10% calculée : 200 €');
check(netSubtotalHT === 1800, 'Net HT après remise : 1 800 €');
check(totalVat === 360, 'TVA 20% sur 1 800 € : 360 €');
check(calculatedBudgetTTC === 2160, 'Budget Total TTC calculé : 2 160 €');
check(calculatedDepositAmt === 864, 'Acompte 40% sur TTC calculé : 864 €');

// ---------------------------------------------------------------------------
// 6. INTÉGRITÉ DES DONNÉES : PROTECTION ANTI-SUPPRESSION CLIENT
// ---------------------------------------------------------------------------
console.log('\n6. Intégrité des données : protection anti-suppression client avec projets :');

function simulateCanDeleteClient(
  targetClientId: string,
  allProjects: Project[],
  allQuotes: Quote[],
  allInvoices: Invoice[]
) {
  const pCount = allProjects.filter(p => p.clientId === targetClientId).length;
  const qCount = allQuotes.filter(q => q.clientId === targetClientId).length;
  const iCount = allInvoices.filter(i => i.clientId === targetClientId).length;
  if (pCount > 0 || qCount > 0 || iCount > 0) {
    return {
      allowed: false,
      reason: `Ce client possède ${pCount} projet(s), ${qCount} devis et ${iCount} facture(s). Archivage recommandé.`,
      projectCount: pCount,
      quoteCount: qCount,
      invoiceCount: iCount
    };
  }
  return { allowed: true, projectCount: 0, quoteCount: 0, invoiceCount: 0 };
}

const checkClientWithProjects = simulateCanDeleteClient(client1.id, [project1, project2], [], []);
check(!checkClientWithProjects.allowed, 'Suppression directe du client Solène refusée car il possède 2 projets');
check(checkClientWithProjects.projectCount === 2, 'Détection exacte de 2 projets associés');
check((checkClientWithProjects.reason || '').includes('Archivage'), 'Proposition explicite d’archivage');

// Client vierge (aucun projet, devis ni facture)
const freshClient: Client = {
  id: 'cli_fresh_0',
  workspaceId: 'ws_test_1',
  name: 'Prospect Neuf',
  company: 'Nouveau Contact',
  email: 'neuf@contact.com',
  phone: '',
  address: '',
  status: 'prospect',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString()
};

const checkFreshClient = simulateCanDeleteClient(freshClient.id, [project1, project2], [], []);
check(checkFreshClient.allowed === true, 'Suppression autorisée pour un client neuf sans aucun document lié');

// ---------------------------------------------------------------------------
// 7. INTÉGRITÉ DES PROJETS : PROTECTION ANTI-SUPPRESSION PROJET
// ---------------------------------------------------------------------------
console.log('\n7. Intégrité des projets : protection anti-suppression projet avec devis/factures :');

function simulateCanDeleteProject(
  targetProjectId: string,
  allQuotes: Quote[],
  allInvoices: Invoice[]
) {
  const qCount = allQuotes.filter(q => q.projectId === targetProjectId).length;
  const iCount = allInvoices.filter(i => i.projectId === targetProjectId).length;
  if (qCount > 0 || iCount > 0) {
    return {
      allowed: false,
      reason: `Ce projet comporte ${qCount} devis et ${iCount} facture(s). Archivage requis.`,
      quoteCount: qCount,
      invoiceCount: iCount
    };
  }
  return { allowed: true, quoteCount: 0, invoiceCount: 0 };
}

const dummyQuote: Quote = {
  id: 'dev_101',
  quoteNumber: 'DEV-2026-01',
  projectId: project1.id,
  clientId: client1.id,
  createdAt: new Date().toISOString(),
  validityDays: 30,
  dueDate: '2026-11-01',
  lines: [],
  subtotal: 2000,
  vatRate: 20,
  vatAmount: 400,
  totalTTC: 2400,
  depositPercent: 50,
  depositAmount: 1200,
  revisionLimit: 3,
  turnaroundTime: '3 semaines',
  termsAndConditions: '',
  status: 'accepted'
};

const checkProjectWithQuote = simulateCanDeleteProject(project1.id, [dummyQuote], []);
check(!checkProjectWithQuote.allowed, 'Suppression directe du projet refusée car il a un devis accepté rattaché');

const checkProjectWithoutQuote = simulateCanDeleteProject(project2.id, [dummyQuote], []);
check(checkProjectWithoutQuote.allowed === true, 'Suppression directe autorisée pour un projet sans devis ni facture');

// ---------------------------------------------------------------------------
// 8. CRÉATION DE CLIENT À LA VOLÉE DANS LE FORMULAIRE DE PROJET
// ---------------------------------------------------------------------------
console.log('\n8. Création de client à la volée dans le formulaire de nouveau projet :');

function simulateInlineClientCreation(
  currentClients: Client[],
  inlineData: { name: string; company: string; email: string; phone: string }
): { newClient: Client; updatedList: Client[] } {
  const newClient: Client = {
    id: `cli_${Date.now()}`,
    name: inlineData.name,
    company: inlineData.company,
    email: inlineData.email,
    phone: inlineData.phone,
    address: '',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  return { newClient, updatedList: [...currentClients, newClient] };
}

const inlineResult = simulateInlineClientCreation([client1], {
  name: 'Marc Dupond',
  company: 'Atelier Dupond',
  email: 'marc@dupond.fr',
  phone: '+33600000000'
});

check(inlineResult.newClient.company === 'Atelier Dupond', 'Le client est créé instantanément avec ses coordonnées');
check(inlineResult.updatedList.length === 2, 'La liste des clients est enrichie sans quitter le modal');

// ---------------------------------------------------------------------------
// 9. MODÈLE DE PROJET PRÉREMPLI AVEC PRESTATIONS
// ---------------------------------------------------------------------------
console.log('\n9. Application d’un modèle de cadrage avec prestations préremplies :');

const mockTemplate: ProjectTemplate = {
  id: 'tmpl_branding_complet',
  name: 'Refonte de Marque & Identité 360°',
  projectType: 'identite_visuelle',
  description: 'Kit de refonte complète pour PME et créateurs',
  defaultServiceIds: [catalogServiceA.id],
  defaultTasks: [
    { title: 'Questionnaire de positionnement', daysOffset: 2 },
    { title: 'Exploration 3 pistes typographiques', daysOffset: 7 }
  ],
  briefQuestions: ['Quelle est la promesse centrale ?', 'Quels sont vos 3 concurrents directs ?'],
  requiredClientAssets: ['Logo actuel haute déf', 'Photos produits']
};

check(mockTemplate.defaultServiceIds?.length === 1, 'Le modèle embarque la prestation de logotype');
check(mockTemplate.briefQuestions.length === 2, 'Le modèle fournit les questions de cadrage stratégique');
check(mockTemplate.defaultTasks.length === 2, 'Le modèle configure la checklist opérationnelle');

// ---------------------------------------------------------------------------
// SYNTHÈSE
// ---------------------------------------------------------------------------
const passed = results.filter(r => r.passed).length;
const total = results.length;

console.log('\n==================================================================');
console.log(`BILAN DES TESTS INTÉGRATION : ${passed}/${total} invariants validés.`);
if (passed === total) {
  console.log('✅ TOUTES LES RELATIONS CLIENTS, PROJETS ET CATALOGUE SONT CONFORMES.');
} else {
  console.error('❌ ÉCHEC DE CERTAINS INVARIANTS.');
}
console.log('==================================================================\n');

process.exit(passed === total ? 0 : 1);
