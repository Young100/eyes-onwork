import { 
  CatalogPack, 
  CatalogService, 
  Client, 
  DesignerProfile, 
  Invoice, 
  Project, 
  ProjectTemplate, 
  Quote,
  NotificationItem,
  ClientAppointment,
  TimeEntry,
  ProjectExpense,
  ReminderQueueItem,
  ReminderRuleConfig,
  PublicLeadSubmission,
  EmailLogItem,
  PaymentTransaction,
  AuditLogItem
} from '../types';

export const INITIAL_DESIGNER_PROFILE: DesignerProfile = {
  name: 'Solène Mercier',
  studioName: 'Atelier Solène Graphic Design',
  email: 'solene@atelier-mercier.fr',
  phone: '+33 6 12 34 56 78',
  address: '14 rue Saint-Honoré, 75001 Paris, France',
  siret: '849 201 392 00018',
  tvaNumber: 'FR 32 849201392',
  iban: 'FR76 3000 4000 5000 6000 7000 890',
  bic: 'BNPAFRPP',
  currency: 'EUR',
  defaultVatRate: 20,
  defaultDepositPercent: 50,
  defaultTurnaroundWeeks: 3,
  defaultRevisionLimit: 3,
  termsTemplate: 'Acompte de 50% à la signature pour réservation du planning. Solde exigible avant livraison finale des fichiers sources. Cession de droits selon devis accepté.',
  legalNoticeTemplate: 'TVA 20% applicable. Pénalités de retard : 3 fois le taux d’intérêt légal + indemnité forfaitaire de 40 €.',
  brandColor: '#f7c548',
  autoUnlockDeliveryOnFullPayment: true
};

export const INITIAL_CATALOG_SERVICES: CatalogService[] = [
  {
    id: 'cat_logo_essentiel',
    workspaceId: 'ws_default',
    name: 'Logotype Essentiel & Mini-Charte',
    category: 'identite_visuelle',
    deliverableDescription: '3 pistes créatives, déclinaisons vectorielles (SVG, AI, PDF, PNG transparent), mini guide de couleurs et typographies.',
    unit: 'forfait',
    unitPriceCents: 120000,
    taxRate: 20,
    turnaroundDays: 14,
    revisionLimit: 3,
    status: 'active',
    priceHistory: [],
    usageCount: 12,
    createdAt: '2026-01-10T09:00:00Z',
    updatedAt: '2026-01-10T09:00:00Z'
  },
  {
    id: 'cat_branding_complet',
    workspaceId: 'ws_default',
    name: 'Identité Visuelle Haute Définition & Brand Guidelines',
    category: 'identite_visuelle',
    deliverableDescription: 'Identité globale, logotype responsive, système colorimétrique, typographies de marque, motifs & patterns, guide de normes graphiques complet (40 pages PDF).',
    unit: 'forfait',
    unitPriceCents: 240000,
    taxRate: 20,
    turnaroundDays: 25,
    revisionLimit: 4,
    status: 'active',
    priceHistory: [],
    usageCount: 8,
    createdAt: '2026-01-12T10:00:00Z',
    updatedAt: '2026-01-12T10:00:00Z'
  },
  {
    id: 'cat_packaging_coffret',
    workspaceId: 'ws_default',
    name: 'Packaging Coffret & Étuis Flacons',
    category: 'emballage',
    deliverableDescription: 'Conception dieline couteau d’impression, étiquettes dorure à chaud, maquettes 3D de rendu produit, fichiers imprimeur haute fidélité.',
    unit: 'forfait',
    unitPriceCents: 180000,
    taxRate: 20,
    turnaroundDays: 20,
    revisionLimit: 3,
    status: 'active',
    priceHistory: [],
    usageCount: 5,
    createdAt: '2026-01-15T11:00:00Z',
    updatedAt: '2026-01-15T11:00:00Z'
  },
  {
    id: 'cat_site_vitrine',
    workspaceId: 'ws_default',
    name: 'Web Design UI/UX Site Vitrine',
    category: 'web_design',
    deliverableDescription: 'Architecture de l’information, maquettes Figma responsives (desktop/mobile, 5 pages clés), kit composants interactifs.',
    unit: 'forfait',
    unitPriceCents: 190000,
    taxRate: 20,
    turnaroundDays: 21,
    revisionLimit: 3,
    status: 'active',
    priceHistory: [],
    usageCount: 9,
    createdAt: '2026-01-20T14:00:00Z',
    updatedAt: '2026-01-20T14:00:00Z'
  },
  {
    id: 'cat_suivi_da_tjm',
    workspaceId: 'ws_default',
    name: 'Direction Artistique & Suivi de Fabrication (TJM)',
    category: 'direction_artistique',
    deliverableDescription: 'Journée complète de suivi DA, calage imprimeur ou supervision shooting.',
    unit: 'jour',
    unitPriceCents: 60000,
    taxRate: 20,
    turnaroundDays: 1,
    revisionLimit: 2,
    status: 'active',
    priceHistory: [],
    usageCount: 4,
    createdAt: '2026-02-01T08:00:00Z',
    updatedAt: '2026-02-01T08:00:00Z'
  }
];

export const INITIAL_CATALOG_PACKS: CatalogPack[] = [
  {
    id: 'pack_luxe_launch',
    workspaceId: 'ws_default',
    name: 'Pack Lancement Maison de Luxe',
    description: 'Comprend le Branding Complet + Packaging Coffret avec 15% de synergie.',
    serviceIds: ['cat_branding_complet', 'cat_packaging_coffret'],
    priceCents: 357000,
    status: 'active',
    createdAt: '2026-01-25T10:00:00Z'
  }
];

export const INITIAL_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'tpl_branding',
    workspaceId: 'ws_default',
    title: 'Modèle Lancement Identité de Marque',
    category: 'identite_visuelle',
    description: 'Processus structuré en 5 jalons clés avec questionnaire de cadrage et validation progressive des pistes.',
    steps: ['demande_recue', 'brief_valide', 'devis_accepte', 'acompte_paye', 'recherches_en_cours', 'pistes_presentees', 'retours_en_cours', 'maquette_validee', 'facture_solde_emise', 'solde_regle', 'livraison_effectuee', 'projet_cloture'],
    defaultTasks: [
      { title: 'Validation du brief et moodboard d’inspiration', defaultDaysOffset: 3 },
      { title: 'Présentation de 3 axes créatifs distincts', defaultDaysOffset: 10 },
      { title: 'Affinage de l’axe retenu et déclinaisons', defaultDaysOffset: 17 },
      { title: 'Exportation des packs logos et guide de marque', defaultDaysOffset: 24 }
    ],
    briefQuestions: [
      'Quelle est la vision et l’histoire singulière de votre marque ?',
      'Quels sont vos 3 concurrents de référence et votre public cible ?',
      'Quels adjectifs décrivent l’atmosphère recherchée ?'
    ],
    defaultPrestationIds: ['cat_branding_complet'],
    revisionLimit: 4,
    turnaroundDays: 25
  },
  {
    id: 'tpl_packaging',
    workspaceId: 'ws_default',
    title: 'Modèle Packaging & Habillage Cosmétique',
    category: 'emballage',
    description: 'Conception d’étuis, flaconnages et vérification de la faisabilité imprimeur.',
    steps: ['demande_recue', 'brief_valide', 'devis_accepte', 'acompte_paye', 'recherches_en_cours', 'pistes_presentees', 'maquette_validee', 'solde_regle', 'livraison_effectuee'],
    defaultTasks: [
      { title: 'Réception des plans de pose et spécifications techniques', defaultDaysOffset: 2 },
      { title: 'Création des concepts d’étiquettes et textures', defaultDaysOffset: 8 },
      { title: 'Rendus 3D photoréalistes pour validation client', defaultDaysOffset: 14 },
      { title: 'Contrôle chromatique et génération des PDF imprimeur CMJN', defaultDaysOffset: 19 }
    ],
    briefQuestions: [
      'Quelles sont les dimensions et contraintes matières (verre, carton, dorure) ?',
      'Quelles mentions légales ou certifications obligatoires doivent figurer ?'
    ],
    defaultPrestationIds: ['cat_packaging_coffret'],
    revisionLimit: 3,
    turnaroundDays: 20
  }
];

export const INITIAL_CLIENTS: Client[] = [
  {
    id: 'client_maison_solene',
    workspaceId: 'ws_default',
    name: 'Maison Solène Haute Joaillerie',
    company: 'Solène Luxury Group SAS',
    email: 'direction@maisonsolene.fr',
    phone: '+33 1 42 68 55 00',
    address: '22 Place Vendôme, 75001 Paris',
    status: 'active',
    notes: 'Client d’exception, exigeant sur la colorimétrie et les dorures.',
    createdAt: '2026-01-05T10:00:00Z',
    updatedAt: '2026-02-01T15:00:00Z'
  },
  {
    id: 'client_botanica',
    workspaceId: 'ws_default',
    name: 'Botanica Skincare & Soins',
    company: 'Laboratoires Botanica Bio',
    email: 'contact@botanica-soins.com',
    phone: '+33 4 91 22 33 44',
    address: '8 Boulevard de la Canebière, 13001 Marseille',
    status: 'active',
    notes: 'Marque éco-responsable, étiquettes recyclées.',
    createdAt: '2026-01-18T14:00:00Z',
    updatedAt: '2026-02-10T12:00:00Z'
  }
];

export const INITIAL_PROJECTS: Project[] = [
  {
    id: 'proj_solene_branding',
    workspaceId: 'ws_default',
    clientId: 'client_maison_solene',
    clientShareToken: 'tok_solene_brand_2026',
    clientLinkActive: true,
    title: 'Refonte Identité Visuelle & Signature Joaillière',
    type: 'identite_visuelle',
    budget: 2880,
    depositAmount: 1440,
    paidAmount: 1440,
    subtotalHT: 2400,
    vatAmount: 480,
    totalTTC: 2880,
    deadline: '2026-11-20',
    currentStep: 'pistes_presentees',
    revisionLimit: 4,
    revisionsUsed: 1,
    paidRevisionsAdded: 0,
    lines: [
      {
        id: 'pline_1',
        sourceCatalogServiceId: 'cat_branding_complet',
        name: 'Identité Visuelle Haute Définition & Brand Guidelines',
        description: 'Identité globale, logotype responsive, système colorimétrique, guide 40p.',
        unit: 'forfait',
        unitPrice: 2400,
        quantity: 1,
        vatRate: 20,
        totalHT: 2400,
        totalTTC: 2880,
        turnaroundDays: 25,
        revisionLimit: 4
      }
    ],
    tasks: [
      { id: 'task_1', title: 'Cadrage du brief et moodboard Vendôme', completed: true, dueDate: '2026-10-25' },
      { id: 'task_2', title: 'Création des monogrammes or et sceaux', completed: true, dueDate: '2026-11-02' },
      { id: 'task_3', title: 'Présentation des maquettes au comité', completed: false, dueDate: '2026-11-10' },
      { id: 'task_4', title: 'Livraison des fichiers vectoriels et brand book', completed: false, dueDate: '2026-11-20' }
    ],
    activity: [
      { id: 'act_1', date: '2026-01-20T10:00:00Z', action: 'Création du projet', details: 'Rattaché à Maison Solène' },
      { id: 'act_2', date: '2026-01-22T14:30:00Z', action: 'Devis accepté', details: 'Devis DEV-2026-001 validé par le client' }
    ],
    mockupRounds: [],
    files: [],
    delivery: {
      mode: 'auto',
      isUnlocked: false,
      thankYouMessage: 'Merci pour votre confiance ! Retrouvez ci-dessous l’ensemble de vos fichiers haute définition.',
      selectedDeliverableIds: []
    },
    createdAt: '2026-01-20T09:00:00Z',
    updatedAt: '2026-02-15T11:00:00Z'
  }
];

export const INITIAL_QUOTES: Quote[] = [
  {
    id: 'quote_solene_001',
    workspaceId: 'ws_default',
    quoteNumber: 'DEV-2026-001',
    version: 1,
    projectId: 'proj_solene_branding',
    clientId: 'client_maison_solene',
    createdAt: '2026-01-20T10:00:00Z',
    validityDays: 30,
    dueDate: '2026-02-19T10:00:00Z',
    lines: [
      {
        id: 'qline_1',
        sourceCatalogServiceId: 'cat_branding_complet',
        designation: 'Identité Visuelle Haute Définition & Brand Guidelines',
        description: 'Identité globale, logotype responsive, système colorimétrique, guide 40p.',
        quantity: 1,
        unitPrice: 2400,
        vatRate: 20,
        total: 2400
      }
    ],
    subtotal: 2400,
    discountPercent: 0,
    discountAmount: 0,
    netHT: 2400,
    vatRate: 20,
    vatAmount: 480,
    totalTTC: 2880,
    depositPercent: 50,
    depositAmount: 1440,
    revisionLimit: 4,
    turnaroundTime: '25 jours ouvrés',
    termsAndConditions: 'Acompte de 50% à la commande pour démarrage du planning créatif.',
    status: 'accepted',
    isLocked: true,
    acceptedAt: '2026-01-22T14:30:00Z',
    acceptedByName: 'Maison Solène — Direction Générale'
  }
];

export const INITIAL_INVOICES: Invoice[] = [
  {
    id: 'inv_solene_acompte',
    workspaceId: 'ws_default',
    invoiceNumber: 'FAC-2026-001',
    type: 'deposit',
    quoteId: 'quote_solene_001',
    devisId: 'quote_solene_001',
    projectId: 'proj_solene_branding',
    clientId: 'client_maison_solene',
    createdAt: '2026-01-22T15:00:00Z',
    dueDate: '2026-02-21T15:00:00Z',
    lines: [
      {
        id: 'invline_1',
        sourceCatalogServiceId: 'cat_branding_complet',
        designation: 'Acompte 50% — Refonte Identité Visuelle & Signature Joaillière',
        description: 'Réf. Devis DEV-2026-001 (Version 1)',
        quantity: 1,
        unitPrice: 1200,
        vatRate: 20,
        total: 1200
      }
    ],
    subtotal: 1200,
    netHT: 1200,
    vatRate: 20,
    vatAmount: 240,
    totalTTC: 1440,
    paidAmount: 1440,
    balanceDue: 0,
    status: 'paid',
    legalNotice: 'Facture d’acompte acquittée. Paiement par virement bancaire reçu.',
    payments: [
      {
        id: 'pay_1',
        invoiceId: 'inv_solene_acompte',
        amount: 1440,
        date: '2026-01-23',
        method: 'virement',
        reference: 'VIR-SOLENE-AC01',
        recordedBy: 'Solène Mercier'
      }
    ],
    isLocked: true
  }
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif_welcome',
    title: 'Bienvenue sur eyes-onwork',
    message: 'Votre espace de travail est prêt. Créez votre premier projet ou explorez le catalogue.',
    type: 'info',
    read: false,
    createdAt: '2026-01-20T10:00:00Z',
    workspaceId: 'ws_default'
  }
];

export const INITIAL_APPOINTMENTS: ClientAppointment[] = [
  {
    id: 'apt_1',
    clientId: 'client_maison_solene',
    title: 'Point d’étape & validation des pistes',
    date: '2026-02-05T14:00:00Z',
    time: '14:00',
    durationMinutes: 45,
    status: 'scheduled',
    notes: 'Présentation des trois directions artistiques retenues.',
    locationDetails: 'Visioconférence Google Meet',
    locationType: 'online',
    workspaceId: 'ws_default'
  }
];

export const INITIAL_TIME_ENTRIES: TimeEntry[] = [];
export const INITIAL_EXPENSES: ProjectExpense[] = [];
export const INITIAL_REMINDERS: ReminderQueueItem[] = [];

export const INITIAL_REMINDER_RULES: ReminderRuleConfig[] = [
  {
    id: 'rule_echeance_3j',
    title: 'Rappel 3 jours avant échéance',
    daysAfterDueDate: -3,
    active: true
  },
  {
    id: 'rule_retard_1j',
    title: 'Relance 1 jour après échéance',
    daysAfterDueDate: 1,
    active: true
  },
  {
    id: 'rule_retard_7j',
    title: 'Deuxième relance 7 jours après échéance',
    daysAfterDueDate: 7,
    active: true
  }
];

export const INITIAL_LEADS: PublicLeadSubmission[] = [];
export const INITIAL_EMAIL_LOGS: EmailLogItem[] = [];
export const INITIAL_PAYMENT_TRANSACTIONS: PaymentTransaction[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogItem[] = [];

export function generateSampleDemoData(workspaceId: string = 'ws_default') {
  return {
    clients: INITIAL_CLIENTS.map(c => ({ ...c, workspaceId, isDemo: true })),
    projects: INITIAL_PROJECTS.map(p => ({ ...p, workspaceId, isDemo: true })),
    quotes: INITIAL_QUOTES.map(q => ({ ...q, workspaceId, isDemo: true })),
    invoices: INITIAL_INVOICES.map(i => ({ ...i, workspaceId, isDemo: true })),
    appointments: INITIAL_APPOINTMENTS.map(a => ({ ...a, workspaceId, isDemo: true })),
    notifications: INITIAL_NOTIFICATIONS.map(n => ({ ...n, workspaceId, isDemo: true }))
  };
}
