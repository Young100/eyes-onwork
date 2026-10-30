export type ProjectType = 
  | 'identite_visuelle' 
  | 'web_design' 
  | 'print' 
  | 'illustration' 
  | 'emballage' 
  | 'direction_artistique' 
  | 'autre';

export const PROJECT_TYPE_LABELS: Record<ProjectType, string> = {
  identite_visuelle: 'Identité Visuelle & Branding',
  web_design: 'Web Design & UI/UX',
  print: 'Édition & Print',
  illustration: 'Illustration & Vectoriel',
  emballage: 'Packaging & Packaging',
  direction_artistique: 'Direction Artistique',
  autre: 'Création sur mesure'
};

export type ProjectStepKey = 
  | 'demande_recue'
  | 'brief_valide'
  | 'devis_accepte'
  | 'acompte_paye'
  | 'acompte_recu'
  | 'recherches_en_cours'
  | 'pistes_presentees'
  | 'retours_en_cours'
  | 'revisions'
  | 'maquettes'
  | 'maquette_validee'
  | 'validation_finale'
  | 'facture_solde_emise'
  | 'solde_regle'
  | 'solde_recu'
  | 'livraison_effectuee'
  | 'livre'
  | 'projet_cloture';

export interface ProjectStepDefinition {
  key: ProjectStepKey;
  label: string;
  shortLabel?: string;
  order?: number;
  description: string;
  color: string;
}

export const PROJECT_STEPS: ProjectStepDefinition[] = [
  { order: 1, key: 'demande_recue', label: 'Demande reçue', shortLabel: 'Demande', description: 'Brief ou premier contact reçu du client', color: '#8E97AB' },
  { order: 2, key: 'brief_valide', label: 'Brief validé', shortLabel: 'Brief', description: 'Objectifs et cahier des charges confirmés', color: '#60A5FA' },
  { order: 3, key: 'devis_accepte', label: 'Devis accepté', shortLabel: 'Devis', description: 'Devis signé par le client', color: '#f7c548' },
  { order: 4, key: 'acompte_paye', label: 'Acompte versé', shortLabel: 'Acompte', description: 'Acompte de démarrage encaissé', color: '#34D399' },
  { order: 5, key: 'recherches_en_cours', label: 'Recherches en cours', shortLabel: 'Recherches', description: 'Exploration graphique et moodboards', color: '#818CF8' },
  { order: 6, key: 'pistes_presentees', label: 'Pistes présentées', shortLabel: 'Pistes', description: 'Premières maquettes soumises au client', color: '#F472B6' },
  { order: 7, key: 'retours_en_cours', label: 'Retours client', shortLabel: 'Retours', description: 'Ajustements selon retours', color: '#FBBF24' },
  { order: 8, key: 'maquette_validee', label: 'Maquette validée', shortLabel: 'Validée', description: 'Version finale approuvée', color: '#10B981' },
  { order: 9, key: 'facture_solde_emise', label: 'Facture solde émise', shortLabel: 'Facture', description: 'Facture finale transmise', color: '#A78BFA' },
  { order: 10, key: 'solde_regle', label: 'Solde réglé', shortLabel: 'Solde', description: 'Paiement intégral reçu', color: '#059669' },
  { order: 11, key: 'livraison_effectuee', label: 'Livraison effectuée', shortLabel: 'Livré', description: 'Tous les fichiers finaux transmis', color: '#D97706' },
  { order: 12, key: 'projet_cloture', label: 'Projet clôturé', shortLabel: 'Clôturé', description: 'Prestation achevée avec succès', color: '#6EE7B7' }
];

/* =========================================================================
   Catalogue de prestations & Lignes de projet
   ========================================================================= */

export type CatalogUnit = 'forfait' | 'heure' | 'jour' | 'piece' | 'page' | 'mois';

export const CATALOG_UNIT_LABELS: Record<CatalogUnit, string> = {
  forfait: 'Forfait',
  heure: 'À l’heure',
  jour: 'Par jour (TJM)',
  piece: 'À la pièce',
  page: 'À la page',
  mois: 'Par mois'
};

export interface PriceHistoryEntry {
  date: string;
  oldPriceCents: number;
  newPriceCents: number;
  reason?: string;
}

export interface CatalogService {
  id: string;
  workspaceId: string;
  name: string;
  category: string;
  deliverableDescription: string;
  unit: CatalogUnit;
  unitPriceCents: number;
  taxRate: number | null;
  turnaroundDays: number;
  revisionLimit: number;
  status: 'active' | 'archived';
  priceHistory: PriceHistoryEntry[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogPack {
  id: string;
  workspaceId: string;
  name: string;
  description?: string;
  deliverableDescription?: string;
  category?: string;
  serviceIds?: string[];
  items?: Array<{ serviceId: string; quantity: number }>;
  pricingMode?: 'fixed' | 'sum';
  priceCents?: number;
  packPriceCents?: number;
  taxRate?: number | null;
  turnaroundDays?: number;
  revisionLimit?: number;
  usageCount?: number;
  status: 'active' | 'archived';
  priceHistory?: PriceHistoryEntry[];
  createdAt: string;
  updatedAt?: string;
}

export interface ProjectPrestationLine {
  id: string;
  sourceCatalogServiceId?: string;
  name: string;
  description?: string;
  unit: CatalogUnit;
  unitPrice: number;
  quantity: number;
  vatRate: number;
  totalHT: number;
  totalTTC: number;
  turnaroundDays?: number;
  revisionLimit?: number;
}

export type ProjectServiceLine = ProjectPrestationLine;

export interface CreativeBriefColor {
  hex: string;
  name: string;
}

export interface CreativeBrief {
  objectives?: string;
  targetAudience?: string;
  desiredStyle?: string;
  colors?: CreativeBriefColor[];
  typographyAndReferences?: string;
  expectedFormats?: string[];
  clientProvidedAssets?: string;
  [key: string]: any;
}

export interface ProjectTemplate {
  id: string;
  workspaceId: string;
  title: string;
  name?: string;
  category?: ProjectType;
  projectType?: ProjectType;
  description: string;
  steps?: ProjectStepKey[];
  defaultSteps?: ProjectStepKey[];
  defaultTasks: { title: string; defaultDaysOffset: number }[];
  briefQuestions: string[];
  defaultPrestationIds?: string[];
  defaultServiceIds?: string[];
  requiredClientAssets?: string[];
  revisionLimit: number;
  turnaroundDays: number;
  updatedAt?: string;
  createdAt?: string;
}

/* =========================================================================
   Clients & Projets
   ========================================================================= */

export interface Client {
  id: string;
  workspaceId: string;
  name: string;
  company?: string;
  email: string;
  phone?: string;
  whatsapp?: string;
  website?: string;
  address?: string;
  status: 'active' | 'archived' | 'prospect';
  notes?: string;
  privateNotes?: string;
  isDemo?: boolean;
  createdAt: string;
  updatedAt: string;
  // Synthesized / computed financial & project totals
  totalInvoiced?: number;
  totalCollected?: number;
  totalRemaining?: number;
  activeProjectsCount?: number;
}

export interface ProjectTask {
  id: string;
  title: string;
  completed: boolean;
  dueDate?: string;
}

export interface ActivityLog {
  id: string;
  date: string;
  action?: string;
  title?: string;
  description?: string;
  details?: string;
  type?: string;
  authorName?: string;
}

export interface MockupPinComment {
  id: string;
  pinNumber?: number;
  xPercent: number;
  yPercent: number;
  author: string;
  content: string;
  createdAt: string;
}

export interface MockupGeneralComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
}

export interface MockupVersion {
  id: string;
  versionNumber: number;
  title: string;
  description?: string;
  fileUrl: string;
  fileName: string;
  fileType: 'image' | 'pdf';
  fileSize: string;
  createdAt: string;
  pinComments: MockupPinComment[];
  generalComments: MockupGeneralComment[];
}

export type MockupRoundStatus = 'pending_client' | 'changes_requested' | 'validated';

export interface MockupRound {
  id: string;
  roundNumber: number;
  title: string;
  status: MockupRoundStatus;
  versions: MockupVersion[];
  createdAt: string;
  validatedAt?: string;
  feedbackMessage?: string;
}

export type FileCategory = 'client_provided' | 'sources' | 'mockups' | 'deliverables';

export interface ProjectFile {
  id: string;
  name: string;
  category: FileCategory;
  version: number;
  sizeBytes: number;
  formattedSize: string;
  extension: string;
  url: string;
  uploadedAt: string;
  uploadedBy: 'designer' | 'client';
}

export interface DeliveryConfig {
  mode: 'auto' | 'manual';
  isUnlocked: boolean;
  unlockedAt?: string;
  thankYouMessage?: string;
  selectedDeliverableIds: string[];
}

export interface Project {
  id: string;
  workspaceId: string;
  clientId: string; // Obligatoire
  clientShareToken: string;
  clientLinkActive: boolean;
  title: string;
  type: ProjectType;
  budget: number;
  depositAmount: number;
  paidAmount: number;
  subtotalHT?: number;
  vatAmount?: number;
  totalTTC?: number;
  deadline: string;
  currentStep: ProjectStepKey;
  revisionLimit: number;
  revisionsUsed: number;
  paidRevisionsAdded: number;
  brief?: CreativeBrief;
  lines?: ProjectPrestationLine[];
  tasks: ProjectTask[];
  activity: ActivityLog[];
  mockupRounds: MockupRound[];
  files: ProjectFile[];
  delivery: DeliveryConfig;
  reviews?: ProjectReview[];
  coverImageUrl?: string;
  depositPercent?: number;
  discountPercent?: number;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
  isArchived?: boolean;
  isDemo?: boolean;
}

/* =========================================================================
   Devis (Multi-versions, TVA par ligne, acceptation & verrouillage)
   ========================================================================= */

export interface QuoteLine {
  id: string;
  sourceCatalogServiceId?: string;
  designation: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  vatRate?: number;
  total: number;
}

export type QuoteStatus = 'draft' | 'sent' | 'accepted' | 'refused' | 'expired';

export interface Quote {
  id: string;
  workspaceId?: string;
  isDemo?: boolean;
  quoteNumber: string; // DEV-AAAA-NNN
  version?: number; // 1, 2, ...
  parentQuoteId?: string;
  projectId: string;
  clientId: string;
  createdAt: string;
  validityDays: number;
  dueDate: string;
  lines: QuoteLine[];
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  netHT?: number;
  vatRate: number;
  vatAmount: number;
  totalTTC: number;
  depositPercent: number; // e.g. 50
  depositAmount: number;
  revisionLimit: number;
  turnaroundTime: string;
  termsAndConditions: string;
  status: QuoteStatus;
  isLocked?: boolean;
  acceptedAt?: string;
  acceptedByName?: string;
  refusedAt?: string;
  refusalReason?: string;
}

/* =========================================================================
   Factures & Paiements (Inaltérables, avoirs, numérotation séquentielle)
   ========================================================================= */

export type InvoiceType = 'deposit' | 'balance' | 'full' | 'additional' | 'credit_note';

export type PaymentMethod = 'virement' | 'especes' | 'mobile_money' | 'cheque' | 'autre';

export interface PaymentRecord {
  id: string;
  invoiceId: string;
  amount: number;
  date: string;
  method: PaymentMethod;
  reference?: string;
  notes?: string;
  recordedBy: string;
}

export type InvoiceStatus = 'draft' | 'sent' | 'partially_paid' | 'paid' | 'overdue' | 'cancelled';

export interface Invoice {
  id: string;
  workspaceId?: string;
  isDemo?: boolean;
  invoiceNumber: string; // FAC-AAAA-NNN
  type: InvoiceType;
  quoteId?: string;
  devisId?: string;
  projectId: string;
  clientId: string;
  createdAt: string;
  dueDate: string;
  lines: QuoteLine[];
  subtotal: number;
  discountPercent?: number;
  discountAmount?: number;
  netHT?: number;
  vatRate: number;
  vatAmount: number;
  totalTTC: number;
  paidAmount: number;
  balanceDue: number;
  status: InvoiceStatus;
  legalNotice: string;
  payments: PaymentRecord[];
  isLocked?: boolean;
  isCancelled?: boolean;
  cancelledAt?: string;
  cancellationReason?: string;
  rectifyingInvoiceNumber?: string;
  originalInvoiceNumber?: string;
  isCreditNote?: boolean;
}

/* =========================================================================
   Profil Designer & Workspace & Entitlements
   ========================================================================= */

export interface DesignerProfile {
  id?: string;
  name: string;
  studioName: string;
  email: string;
  phone: string;
  address: string;
  siret?: string;
  tvaNumber?: string;
  website?: string;
  avatarUrl?: string;
  iban?: string;
  bic?: string;
  currency: string;
  defaultVatRate: number;
  vatRate?: number;
  defaultDepositPercent: number;
  defaultTurnaroundWeeks: number;
  defaultRevisionLimit: number;
  termsTemplate: string;
  legalNoticeTemplate: string;
  legalNotice?: string;
  defaultConditionsQuote?: string;
  depositCalculation?: 'ht' | 'ttc';
  quotePrefix?: string;
  invoicePrefix?: string;
  maxFileSizeMb?: number;
  onboardingCompleted?: boolean;
  messageTemplates?: Record<string, string>;
  brandColor?: string;
  autoUnlockDeliveryOnFullPayment: boolean;
  defaultProjectTemplateId?: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  termsAcceptedVersion?: string;
  termsAcceptedAt?: string;
  privacyAcceptedVersion?: string;
  privacyAcceptedAt?: string;
  onboardingCompletedAt?: string;
  onboardingStep?: string | number;
  workspaceId?: string;
  legalNoticesByCountry?: Record<string, string>;
  showHelpBubbles?: boolean;
  logoUrl?: string;
  specialty?: string;
  accentColor?: string;
  countryCode?: string;
  timezone?: string;
  createdAt?: string;
  updatedAt?: string;
}

export type PlanId = 'free' | 'pro' | 'studio';
export type BillingCycle = 'monthly' | 'quarterly' | 'semiannual' | 'yearly' | 'annual';

export interface PlanConfig {
  id: PlanId;
  name: string;
  tagline?: string;
  priceMonthly: number;
  prices?: Record<string, number>;
  maxActiveProjects: number;
  maxClients: number;
  maxQuotesPerMonth: number;
  maxStorageMb?: number;
  customBranding: boolean;
  multiVersionsAllowed: boolean;
  prioritySupport: boolean;
  limits?: any;
}

export interface PromoCode {
  id?: string;
  code: string;
  discountPercent: number;
  durationMonths?: number;
  validUntil?: string;
  active: boolean;
  usedCount?: number;
}

export interface PlatformEmailTemplate {
  id: string;
  key: string;
  name: string;
  title?: string;
  subject: string;
  body: string;
  content?: string;
  variables?: string[];
}

export interface Workspace {
  id: string;
  name: string;
  ownerId: string;
  ownerEmail?: string;
  planId: PlanId;
  planStatus?: string;
  trialEndsAt?: string;
  planRenewsAt?: string;
  planStartedAt?: string;
  planBillingCycle?: string;
  promoCodeApplied?: string;
  storageUsedMb?: number;
  members?: any[];
  updatedAt?: string;
  createdAt: string;
}

export interface WorkspaceEntitlements {
  maxActiveProjects: number;
  maxClients: number;
  maxQuotesPerMonth: number;
  customBranding: boolean;
  multiVersionsAllowed: boolean;
  prioritySupport: boolean;
  canCreateProject: boolean;
  canCreateClient: boolean;
  canCreateQuote: boolean;
  activeProjectsCount: number;
  clientsCount: number;
  quotesThisMonthCount: number;
  hasWatermarkOnPdf?: boolean;
  hasAutoReminders?: boolean;
  maxStorageMb?: number;
  currentStorageMb?: number;
  isGracePeriod?: boolean;
  daysLeftInGrace?: number;
  currentActiveProjects?: number;
  currentClients?: number;
  currentQuotesThisMonth?: number;
  blockReasonProject?: string;
  blockReasonClient?: string;
  blockReasonQuote?: string;
  reasonBlocked?: string;
}

export interface UserAuth {
  uid: string;
  email: string;
  displayName?: string;
  isSuperAdmin?: boolean;
  isAuthenticated?: boolean;
  workspaceId?: string;
  photoURL?: string;
  emailVerified?: boolean;
  emailVerifiedAt?: string;
  role?: string;
  termsAcceptedVersion?: string;
  termsAcceptedAt?: string;
  privacyAcceptedVersion?: string;
  privacyAcceptedAt?: string;
  onboardingCompleted?: boolean;
  onboardingCompletedAt?: string;
  onboardingStep?: string | number;
  linkedProviders?: string[];
  provider?: string;
  twoFactorEnabled?: boolean;
  createdAt?: string;
}

export interface ProjectReview {
  id: string;
  rating: number;
  feedback?: string;
  clientName?: string;
  clientCompany?: string;
  comment?: string;
  createdAt: string;
}

export interface ClientAppointment {
  id: string;
  clientId: string;
  title: string;
  date: string;
  time: string;
  status: 'scheduled' | 'completed' | 'cancelled';
  workspaceId?: string;
  isDemo?: boolean;
  durationMinutes?: number;
  reminderMinutes?: number;
  notes?: string;
  locationDetails?: string;
  locationType?: string;
}

export interface TimeEntry {
  id: string;
  projectId: string;
  description: string;
  durationMinutes: number;
  hourlyRate?: number;
  date: string;
  workspaceId?: string;
  isDemo?: boolean;
}

export interface ProjectExpense {
  id: string;
  projectId: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  workspaceId?: string;
  isDemo?: boolean;
}

export interface ReminderRuleConfig {
  id: string;
  title: string;
  daysAfterDueDate: number;
  active: boolean;
}

export interface ReminderQueueItem {
  id: string;
  invoiceId: string;
  clientId: string;
  scheduledDate: string;
  status: 'pending' | 'sent' | 'dismissed' | 'cancelled' | 'draft';
  workspaceId?: string;
  isDemo?: boolean;
}

export interface PublicLeadSubmission {
  id: string;
  name: string;
  email: string;
  company?: string;
  projectType: ProjectType;
  budgetEstimate?: number;
  message: string;
  status: 'new' | 'contacted' | 'converted' | 'archived';
  createdAt: string;
  workspaceId?: string;
  isDemo?: boolean;
}

export interface EmailLogItem {
  id: string;
  to: string;
  subject: string;
  templateKey: string;
  sentAt: string;
  success: boolean;
  workspaceId?: string;
  isDemo?: boolean;
}

export interface PaymentTransaction {
  id: string;
  invoiceId: string;
  amount: number;
  transactionRef: string;
  status: 'succeeded' | 'failed';
  date: string;
  workspaceId?: string;
  isDemo?: boolean;
}

export interface AuditLogItem {
  id: string;
  action: string;
  userId?: string;
  details: string;
  timestamp: string;
  workspaceId?: string;
  isDemo?: boolean;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert' | 'invoice_paid' | 'mockup_validated' | 'mockup_comment' | 'mockup_changes_requested' | 'client_file_uploaded' | 'quote_accepted' | 'quote_refused' | 'system' | string;
  read: boolean;
  linkProjectId?: string;
  linkTab?: string;
  date?: string;
  createdAt?: string;
  workspaceId?: string;
  isDemo?: boolean;
}

export interface SecuritySession {
  id: string;
  userId: string;
  device: string;
  browser: string;
  ip: string;
  location: string;
  lastActiveAt: string;
  isCurrent: boolean;
}

export interface AccountAuditEvent {
  id: string;
  userId: string;
  action: string;
  timestamp: string;
  ip?: string;
  details?: string;
}
