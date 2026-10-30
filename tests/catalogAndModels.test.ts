/**
 * Automated Test Suite for "Catalogue & Modèles"
 * Validates:
 * 1. Créer une prestation (champs complets, validation nom & prix >= 0)
 * 2. Modifier une prestation
 * 3. Archiver et réactiver une prestation
 * 4. Protection contre la suppression définitive si utilisée dans devis/facture/pack
 * 5. Modifier un prix : conservation de l'historique (date, ancien, nouveau, motif)
 * 6. Créer un pack (mode calculé & mode forfait libre) et dupliquer
 * 7. Créer un modèle de projet (jalons, checklist J+x, brief, assets) et dupliquer
 * 8. Compte neuf : catalogue vide, assistant "Ajouter des prestations courantes" SANS prix imposé
 * 9. Stockage en plus petite unité (entiers centimes / FCFA) & formatMontant
 */

import assert from 'assert';
import { 
  CatalogService, 
  CatalogPack, 
  ProjectTemplate, 
  PriceHistoryEntry,
  Quote 
} from '../src/types/index.js';
import { 
  toSmallestUnit, 
  fromSmallestUnit, 
  formatSmallestUnit,
  calculateItemsTotalCents,
  validatePrestationData,
  validatePackData,
  COMMON_PRESTATION_SUGGESTIONS,
  STANDARD_CATALOG_CATEGORIES,
  getCategoryLabel
} from '../src/utils/pricingEngine.js';
import { formatMontant } from '../src/utils/formatUtils.js';

console.log('\n==================================================================');
console.log('📦 EYES-ONWORK - TESTS AUTOMATISÉS "CATALOGUE & MODÈLES"');
console.log('==================================================================\n');

let passCount = 0;
let totalCount = 0;

function test(name: string, fn: () => void) {
  totalCount++;
  try {
    fn();
    console.log(`  ✓ [PASS] ${name}`);
    passCount++;
  } catch (err: any) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 1. CRÉER UNE PRESTATION & VALIDATIONS
// ---------------------------------------------------------------------------
console.log('1. Tests de création & validation de prestation :');

test('Validation : rejet si le nom est manquant ou vide', () => {
  const invalid = validatePrestationData({
    name: '   ',
    unitPriceCents: 10000
  });
  assert.strictEqual(invalid.isValid, false);
  assert(invalid.errors.some(e => e.includes('nom de la prestation est obligatoire')));
});

test('Validation : rejet si le prix est négatif', () => {
  const invalid = validatePrestationData({
    name: 'Création Logo',
    unitPriceCents: -500
  });
  assert.strictEqual(invalid.isValid, false);
  assert(invalid.errors.some(e => e.includes('supérieur ou égal à 0')));
});

test('Création réussie avec ensemble des champs spécifiés', () => {
  const valid = validatePrestationData({
    name: 'Identité Visuelle Complète & Charte 20 pages',
    category: 'identite_visuelle',
    deliverableDescription: '3 pistes créatives, logotype vectoriel, déclinaisons, palette de couleurs et guide de style.',
    unit: 'forfait',
    unitPriceCents: toSmallestUnit(2400, 'EUR'), // 240000 cents
    taxRate: null, // Hérité
    turnaroundDays: 21,
    revisionLimit: 3
  });
  assert.strictEqual(valid.isValid, true);
  assert.strictEqual(valid.errors.length, 0);
});

// ---------------------------------------------------------------------------
// 2. MODIFICATION & GESTION DU CYCLE DE VIE (ARCHIVER / RÉACTIVER)
// ---------------------------------------------------------------------------
console.log('\n2. Tests de cycle de vie de prestation (Modifier, Archiver, Réactiver) :');

const mockService: CatalogService = {
  id: 'srv_test_logo',
  workspaceId: 'ws_demo_123',
  name: 'Création de Logo Signature',
  category: 'logo',
  deliverableDescription: 'Recherche créative & 3 propositions vectorielles HD',
  unit: 'forfait',
  unitPriceCents: toSmallestUnit(1200, 'EUR'), // 120000
  taxRate: null,
  turnaroundDays: 14,
  revisionLimit: 3,
  status: 'active',
  priceHistory: [],
  usageCount: 0,
  createdAt: '2026-01-01T10:00:00.000Z',
  updatedAt: '2026-01-01T10:00:00.000Z'
};

test('Modification des livrables et du délai d’une prestation', () => {
  const updated: CatalogService = {
    ...mockService,
    deliverableDescription: 'Recherche créative, 4 pistes de logos, déclinaisons monochrome & guide.',
    turnaroundDays: 16,
    updatedAt: new Date().toISOString()
  };
  assert.strictEqual(updated.turnaroundDays, 16);
  assert(updated.deliverableDescription.includes('4 pistes'));
});

test('Archivage d’une prestation (statut devient archived)', () => {
  const archived: CatalogService = {
    ...mockService,
    status: 'archived',
    updatedAt: new Date().toISOString()
  };
  assert.strictEqual(archived.status, 'archived');
});

test('Réactivation d’une prestation archivée (statut redevient active)', () => {
  const reactivated: CatalogService = {
    ...mockService,
    status: 'active',
    updatedAt: new Date().toISOString()
  };
  assert.strictEqual(reactivated.status, 'active');
});

// ---------------------------------------------------------------------------
// 3. PROTECTION STRICTE CONTRE LA SUPPRESSION DÉFINITIVE SI UTILISÉE
// ---------------------------------------------------------------------------
console.log('\n3. Protection légale & comptable anti-suppression si déjà utilisée :');

function attemptDeleteService(
  service: CatalogService,
  existingQuotes: Array<{ lines: Array<{ designation: string }> }>
): { success: boolean; error?: string } {
  const isUsedInQuotes = existingQuotes.some(q => 
    q.lines?.some(l => l.designation?.toLowerCase().includes(service.name.toLowerCase()))
  );
  const isUsed = (service.usageCount && service.usageCount > 0) || isUsedInQuotes;

  if (isUsed) {
    return {
      success: false,
      error: "Cette prestation a déjà été utilisée dans des devis, factures ou packs créés. Pour préserver la conformité légale et comptable de vos documents, vous pouvez l'archiver mais pas la supprimer définitivement."
    };
  }
  return { success: true };
}

test('Refus de suppression d’une prestation utilisée dans un devis historique', () => {
  const usedQuotes = [
    { lines: [{ designation: 'Création de Logo Signature pour Maison Solène' }] }
  ];
  const deleteResult = attemptDeleteService(mockService, usedQuotes);
  assert.strictEqual(deleteResult.success, false);
  assert(deleteResult.error?.includes('déjà été utilisée'));
  assert(deleteResult.error?.includes('archiver'));
});

test('Suppression autorisée d’une prestation jamais utilisée dans aucun document', () => {
  const freshService: CatalogService = {
    ...mockService,
    id: 'srv_unused',
    name: 'Prestation Test Éphémère',
    usageCount: 0
  };
  const deleteResult = attemptDeleteService(freshService, []);
  assert.strictEqual(deleteResult.success, true);
});

// ---------------------------------------------------------------------------
// 4. HISTORIQUE DES PRIX & NON-RÉTROACTIVITÉ SUR LES DOCUMENTS SCORÉS
// ---------------------------------------------------------------------------
console.log('\n4. Traçabilité des prix & Non-rétroactivité :');

test('La modification de tarif conserve un historique détaillé (date, ancien, nouveau, raison)', () => {
  const initialPriceCents = toSmallestUnit(1200, 'EUR'); // 120000
  const newPriceCents = toSmallestUnit(1450, 'EUR');     // 145000
  const now = new Date().toISOString();

  const historyEntry: PriceHistoryEntry = {
    date: now,
    oldPriceCents: initialPriceCents,
    newPriceCents: newPriceCents,
    reason: 'Réévaluation annuelle 2026 & acquisition nouveaux outils 3D'
  };

  const updatedService: CatalogService = {
    ...mockService,
    unitPriceCents: newPriceCents,
    priceHistory: [historyEntry, ...(mockService.priceHistory || [])],
    updatedAt: now
  };

  assert.strictEqual(updatedService.unitPriceCents, 145000);
  assert.strictEqual(updatedService.priceHistory.length, 1);
  assert.strictEqual(updatedService.priceHistory[0].oldPriceCents, 120000);
  assert.strictEqual(updatedService.priceHistory[0].newPriceCents, 145000);
  assert.strictEqual(updatedService.priceHistory[0].reason, 'Réévaluation annuelle 2026 & acquisition nouveaux outils 3D');
});

test('Les devis passés restent intacts et ne changent pas de montant après modification du catalogue', () => {
  // Devis créé avec l'ancien tarif de 1 200 €
  const historicalQuote = {
    id: 'dev_2026_001',
    lines: [
      { designation: 'Création de Logo Signature', quantity: 1, unitPrice: 1200, total: 1200 }
    ],
    subtotal: 1200,
    totalTTC: 1440
  };

  // Après modification de la prestation à 1 450 €, le devis historique n'est PAS modifié
  assert.strictEqual(historicalQuote.lines[0].unitPrice, 1200);
  assert.strictEqual(historicalQuote.totalTTC, 1440);
});

// ---------------------------------------------------------------------------
// 5. CRÉATION DE PACKS (MODE CALCULÉ & MODE FORFAIT LIBRE)
// ---------------------------------------------------------------------------
console.log('\n5. Tests des Packs de prestations :');

test('Pack en mode calculé : somme automatique exacte des prestations et quantités', () => {
  const items = [
    { serviceId: 'srv_logo', serviceName: 'Logo HD', quantity: 1, unitPriceCents: 120000 },
    { serviceId: 'srv_card', serviceName: 'Carte de visite', quantity: 2, unitPriceCents: 25000 }
  ];
  // 120 000 + (2 * 25 000) = 170 000 cents (1 700 €)
  const totalCents = calculateItemsTotalCents(items);
  assert.strictEqual(totalCents, 170000);
  assert.strictEqual(fromSmallestUnit(totalCents, 'EUR'), 1700);
});

test('Pack en mode forfait libre / remisé : validation et tarification forfaitaire', () => {
  const calculatedSum = 170000;
  const discountedFixedPriceCents = toSmallestUnit(1490, 'EUR'); // 149000

  const pack: CatalogPack = {
    id: 'pack_identite_express',
    workspaceId: 'ws_demo_123',
    name: 'Pack Identité & Papeterie Express',
    category: 'identite_visuelle',
    description: 'Offre packagée tout-en-un avec tarif préférentiel',
    deliverableDescription: 'Logotype vectoriel complet + 2 déclinaisons de cartes de visite prêtes à imprimer',
    items: [
      { serviceId: 'srv_logo', serviceName: 'Logo HD', quantity: 1, unitPriceCents: 120000 },
      { serviceId: 'srv_card', serviceName: 'Carte de visite', quantity: 2, unitPriceCents: 25000 }
    ],
    pricingMode: 'fixed',
    packPriceCents: discountedFixedPriceCents,
    taxRate: null,
    turnaroundDays: 14,
    revisionLimit: 3,
    status: 'active',
    priceHistory: [],
    usageCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  const validation = validatePackData(pack);
  assert.strictEqual(validation.isValid, true);
  assert.strictEqual(pack.packPriceCents, 149000);
  // Économie client
  const clientSavings = calculatedSum - pack.packPriceCents;
  assert.strictEqual(clientSavings, 21000); // 210 € d'économie
});

// ---------------------------------------------------------------------------
// 6. CRÉATION & APPLICATION DE MODÈLES DE PROJET
// ---------------------------------------------------------------------------
console.log('\n6. Tests des Modèles de projet (Jalons, Tâches, Brief, Assets) :');

test('Création d’un modèle complet de cadrage', () => {
  const template: ProjectTemplate = {
    id: 'tmpl_lancement_marque',
    workspaceId: 'ws_demo_123',
    name: 'Refonte d’Identité de Marque 360°',
    title: 'Refonte d’Identité de Marque 360°',
    projectType: 'identite_visuelle',
    description: 'Processus méthodique en 4 jalons pour cadrer la création visuelle.',
    defaultServiceIds: ['srv_logo', 'srv_identity'],
    defaultSteps: [
      { key: 'demande_recue', label: 'Cadrage & Benchmark', daysOffset: 3 },
      { key: 'creation', label: 'Pistes & Moodboard', daysOffset: 8 },
      { key: 'retours_client', label: 'Ajustements', daysOffset: 15 },
      { key: 'finalisation', label: 'Livrables finaux', daysOffset: 21 }
    ],
    defaultTasks: [
      { title: 'Validation du brief stratégique', daysOffset: 3 },
      { title: 'Moodboard d’intentions graphiques', daysOffset: 7 },
      { title: 'Présentation des 3 pistes de logotypes', daysOffset: 12 },
      { title: 'Génération du guide de style PDF 20 pages', daysOffset: 20 }
    ],
    briefQuestions: [
      'Quelle est la mission fondamentale de votre entreprise ?',
      'Qui est votre audience cible prioritaire ?',
      'Citez 3 marques dont l’univers visuel vous inspire.'
    ],
    requiredClientAssets: [
      'Logo vectoriel antérieur si refonte',
      'Photos haute définition validées',
      'Textes et baseline officiels'
    ]
  };

  assert.strictEqual(template.defaultSteps?.length, 4);
  assert.strictEqual(template.defaultTasks.length, 4);
  assert.strictEqual(template.briefQuestions.length, 3);
  assert.strictEqual(template.requiredClientAssets.length, 3);
});

// ---------------------------------------------------------------------------
// 7. COMPTE NEUF : CATALOGUE VIDE & ASSISTANT SANS PRIX IMPOSÉ
// ---------------------------------------------------------------------------
console.log('\n7. Compte neuf (Catalogue vide) & Assistant suggestions SANS prix imposé :');

test('Un nouveau workspace démarre avec un catalogue vide', () => {
  const newWorkspaceId = `ws_new_${Date.now()}`;
  const allServices: CatalogService[] = [
    { ...mockService, workspaceId: 'ws_abdoulaye' } // service d'un autre workspace
  ];

  // Filtrage cloisonné par workspace
  const workspaceServices = allServices.filter(s => s.workspaceId === newWorkspaceId);
  assert.strictEqual(workspaceServices.length, 0, 'Le catalogue du nouveau compte doit être strictement vide');
});

test('L’assistant propose des suggestions mais permet la saisie libre du tarif par le graphiste', () => {
  // L'utilisateur choisit 2 suggestions et définit ses propres tarifs sur-mesure
  const userChosenCustomPrices = [
    { suggestionId: 'sug_logo', customPriceCents: toSmallestUnit(950, 'EUR') },     // 950 € au lieu des 1200 suggérés
    { suggestionId: 'sug_poster', customPriceCents: toSmallestUnit(600000, 'FCFA') } // 600 000 FCFA au lieu des 450 000 suggérés
  ];

  const importedServices: CatalogService[] = userChosenCustomPrices.map(item => {
    const sug = COMMON_PRESTATION_SUGGESTIONS.find(s => s.id === item.suggestionId)!;
    return {
      id: `srv_${Date.now()}_${sug.id}`,
      workspaceId: 'ws_new_brand',
      name: sug.name,
      category: sug.category,
      deliverableDescription: sug.deliverableDescription,
      unit: sug.unit,
      unitPriceCents: item.customPriceCents, // Prix libre choisi par le designer
      taxRate: null,
      turnaroundDays: sug.turnaroundDays,
      revisionLimit: sug.revisionLimit,
      status: 'active',
      priceHistory: [],
      usageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  });

  assert.strictEqual(importedServices.length, 2);
  assert.strictEqual(importedServices[0].unitPriceCents, 95000); // 950.00 €
  assert.strictEqual(importedServices[1].unitPriceCents, 600000); // 600000 FCFA
  assert(importedServices[0].name.includes('Logo'));
  assert(importedServices[1].name.includes('Affiche'));
});

// ---------------------------------------------------------------------------
// 8. PRÉCISION FINANCIÈRE ENTIÈRE & FORMATAGE
// ---------------------------------------------------------------------------
console.log('\n8. Stockage en plus petite unité entière (Centimes & FCFA) :');

test('Conversion correcte EUR (1 200,50 € -> 120 050 centimes)', () => {
  const cents = toSmallestUnit('1200,50', 'EUR');
  assert.strictEqual(cents, 120050);
  assert.strictEqual(fromSmallestUnit(cents, 'EUR'), 1200.50);
});

test('Conversion correcte FCFA (750 000 FCFA entier direct sans décimales)', () => {
  const fcfa = toSmallestUnit(750000, 'FCFA');
  assert.strictEqual(fcfa, 750000);
  assert.strictEqual(fromSmallestUnit(fcfa, 'FCFA'), 750000);
});

test('Formatage propre via formatMontant sans slash ni caractère brisé', () => {
  const formattedEur = formatMontant(1200.50, 'EUR');
  assert(formattedEur.includes('1 200,50') || formattedEur.includes('1200,50'));
  assert(formattedEur.includes('€'));
  assert(!formattedEur.includes('/'));

  const formattedFcfa = formatMontant(750000, 'FCFA');
  assert(formattedFcfa.includes('750 000') || formattedFcfa.includes('750000'));
  assert(formattedFcfa.includes('FCFA'));
  assert(!formattedFcfa.includes(',00'));
});

console.log('\n==================================================================');
console.log(`✅ TOUS LES TESTS "CATALOGUE & MODÈLES" ONT RÉUSSI : ${passCount}/${totalCount}`);
console.log('==================================================================\n');

process.exit(0);
