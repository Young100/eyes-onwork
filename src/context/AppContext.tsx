import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { CURRENT_TERMS_VERSION, CURRENT_PRIVACY_VERSION } from '../config/termsConfig';
import { db, auth as firebaseAuth } from '../config/firebase';
import { signOut } from 'firebase/auth';
import { 
  collection as firestoreCol, 
  doc as firestoreDoc, 
  setDoc as firestoreSetDoc, 
  deleteDoc as firestoreDeleteDoc, 
  getDocs as firestoreGetDocs, 
  query as firestoreQuery, 
  where as firestoreWhere 
} from 'firebase/firestore';
import { 
  INITIAL_CLIENTS, 
  INITIAL_DESIGNER_PROFILE, 
  INITIAL_PROJECTS, 
  INITIAL_QUOTES, 
  INITIAL_INVOICES, 
  INITIAL_NOTIFICATIONS,
  INITIAL_APPOINTMENTS,
  INITIAL_TIME_ENTRIES,
  INITIAL_EXPENSES,
  INITIAL_REMINDERS,
  INITIAL_REMINDER_RULES,
  INITIAL_LEADS,
  INITIAL_EMAIL_LOGS,
  INITIAL_PAYMENT_TRANSACTIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_CATALOG_SERVICES,
  INITIAL_CATALOG_PACKS,
  INITIAL_TEMPLATES,
  generateSampleDemoData
} from '../data/initialData';
import { 
  ActivityLog, 
  Client, 
  DesignerProfile, 
  Project, 
  ProjectStepKey, 
  ProjectTask, 
  UserAuth,
  Quote,
  QuoteStatus,
  QuoteLine,
  Invoice,
  InvoiceStatus,
  PaymentRecord,
  NotificationItem,
  MockupRound,
  MockupVersion,
  MockupPinComment,
  ProjectFile,
  ProjectReview,
  DeliveryConfig,
  FileCategory,
  ClientAppointment,
  TimeEntry,
  ProjectExpense,
  ReminderRuleConfig,
  ReminderQueueItem,
  PublicLeadSubmission,
  EmailLogItem,
  PaymentTransaction,
  AuditLogItem,
  CatalogService,
  CatalogPack,
  ProjectTemplate,
  CatalogUnit,
  PriceHistoryEntry,
  Workspace,
  PlanId,
  BillingCycle,
  PlanConfig,
  PromoCode,
  PlatformEmailTemplate,
  WorkspaceEntitlements
} from '../types';
import { 
  COMMON_PRESTATION_SUGGESTIONS, 
  calculateDocumentTotals, 
  generateNextDocumentNumber 
} from '../utils/pricingEngine';
import {
  DEFAULT_PLANS,
  INITIAL_PROMO_CODES,
  DEFAULT_PLATFORM_EMAIL_TEMPLATES,
  INITIAL_DEMO_WORKSPACES,
  calculateEntitlements,
  isSuperAdminUser,
  migrateLegacyDataToWorkspace,
  SUPER_ADMIN_EMAIL
} from '../data/plansAndWorkspaces';

interface AppContextType {
  auth: UserAuth;
  loginAsDemo: () => void;
  loginWithEmail: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // Workspaces & Subscriptions (Multi-tenant)
  allWorkspaces: Workspace[];
  currentWorkspace: Workspace;
  plans: PlanConfig[];
  promoCodes: PromoCode[];
  platformEmailTemplates: PlatformEmailTemplate[];
  entitlements: WorkspaceEntitlements;
  isUpgradeModalOpen: boolean;
  openUpgradeModal: (reasonOrPlan?: string | PlanId) => void;
  closeUpgradeModal: () => void;
  changePlan: (planId: PlanId, cycle: BillingCycle, promoCode?: string) => Promise<{ success: boolean; message: string }>;
  superAdminUpdateWorkspacePlan: (workspaceId: string, planId: PlanId, durationMonths?: number) => void;
  superAdminToggleWorkspaceStatus: (workspaceId: string, status?: 'active' | 'expired' | 'trial' | 'grace_period') => void;
  updatePlansConfig: (newPlans: PlanConfig[]) => void;
  addPromoCode: (promo: Omit<PromoCode, 'id' | 'usedCount'>) => void;
  togglePromoCode: (id: string) => void;
  exportFullWorkspaceData: () => void;
  workspace?: Workspace;
  upgradeModalOpen?: boolean;
  upgradeReason?: string;
  setPlan?: (planId: PlanId) => void;
  markNotificationAsRead?: (id: string) => void;

  // Auth additions
  registerWithEmail: (email: string, password: string, name: string, termsVersion?: string) => Promise<{ success: boolean; error?: string; requireVerification?: boolean }>;
  loginWithGoogle: (email?: string, name?: string) => Promise<{ success: boolean; error?: string; requireTermsAcceptance?: boolean }>;
  sendVerificationCode: (emailToUse?: string) => Promise<{ success: boolean; error?: string; message?: string; cooldownSeconds?: number; expiresAt?: number }>;
  verifyEmailCode: (code: string) => Promise<{ success: boolean; error?: string; message?: string; remainingAttempts?: number }>;
  acceptCurrentTerms: (version?: string) => Promise<{ success: boolean; error?: string }>;
  linkGoogleAccount: (email?: string) => Promise<boolean>;
  reauthenticate: (password: string) => Promise<boolean>;
  isAuthLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  
  // Data
  clients: Client[];
  projects: Project[];
  quotes: Quote[];
  invoices: Invoice[];
  notifications: NotificationItem[];
  profile: DesignerProfile;
  
  // Client actions
  addClient: (client: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>) => Client;
  updateClient: (id: string, updates: Partial<Client>) => void;
  deleteClient: (id: string) => boolean | void;
  archiveClient: (id: string) => void;
  canDeleteClient: (id: string) => { allowed: boolean; reason?: string; projectCount: number; quoteCount: number; invoiceCount: number };
  getClientById: (id: string) => Client | undefined;
  
  // Project actions
  addProject: (project: Omit<Project, 'id' | 'clientShareToken' | 'clientLinkActive' | 'createdAt' | 'updatedAt' | 'paidAmount' | 'revisionsUsed' | 'paidRevisionsAdded' | 'tasks' | 'activity' | 'mockupRounds' | 'files' | 'delivery'>) => Project;
  updateProject: (id: string, updates: Partial<Project>) => void;
  deleteProject: (id: string) => boolean | void;
  canDeleteProject: (id: string) => { allowed: boolean; reason?: string; quoteCount: number; invoiceCount: number };
  updateProjectStep: (id: string, newStep: ProjectStepKey) => void;
  getProjectById: (id: string) => Project | undefined;
  getProjectByShareToken: (token: string) => Project | undefined;
  regenerateShareToken: (projectId: string) => string;
  toggleShareLinkActive: (projectId: string) => void;
  archiveProject: (projectId: string) => void;
  
  // Task actions
  addTask: (projectId: string, title: string, dueDate?: string) => void;
  toggleTask: (projectId: string, taskId: string) => void;
  deleteTask: (projectId: string, taskId: string) => void;
  
  // Activity actions
  addActivity: (projectId: string, activity: Omit<ActivityLog, 'id' | 'date'>) => void;
  
  // Mockup actions
  addMockupRound: (projectId: string, title: string) => void;
  addMockupVersion: (projectId: string, roundId: string, versionData: Omit<MockupVersion, 'id' | 'versionNumber' | 'createdAt' | 'pinComments' | 'generalComments'>) => void;
  addPinComment: (projectId: string, roundId: string, versionId: string, comment: Omit<MockupPinComment, 'id' | 'pinNumber' | 'createdAt'>) => void;
  addGeneralComment: (projectId: string, roundId: string, versionId: string, author: string, content: string) => void;
  validateMockupRound: (projectId: string, roundId: string, clientName: string) => void;
  requestMockupChanges: (projectId: string, roundId: string, feedback: string, clientName: string) => void;
  addPaidRevision: (projectId: string, cost: number) => void;
  
  // File actions
  uploadProjectFile: (projectId: string, file: Omit<ProjectFile, 'id' | 'uploadedAt'>) => void;
  deleteProjectFile: (projectId: string, fileId: string) => void;
  
  // Quote actions
  addQuote: (quote: Omit<Quote, 'id' | 'quoteNumber' | 'createdAt'>) => Quote;
  updateQuote: (id: string, updates: Partial<Quote>) => void;
  deleteQuote: (id: string) => void;
  duplicateQuote: (id: string) => Quote;
  createQuoteVersion: (quoteId: string) => Quote;
  acceptQuote: (quoteId: string, acceptedByName: string) => void;
  refuseQuote: (quoteId: string, reason: string) => void;
  getQuotesByProjectId: (projectId: string) => Quote[];
  
  // Invoice & Payment actions
  addInvoice: (invoice: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'paidAmount' | 'balanceDue' | 'payments'>) => Invoice;
  createInvoiceFromQuote: (quoteId: string, type: 'deposit' | 'balance' | 'full') => Invoice;
  updateInvoice: (id: string, updates: Partial<Invoice>) => void;
  deleteInvoice: (id: string) => void;
  canModifyInvoice: (invoiceId: string) => { allowed: boolean; reason?: string };
  cancelInvoiceWithCreditNote: (invoiceId: string, reason?: string) => { cancelledInvoice: Invoice; creditNote: Invoice };
  recordPayment: (invoiceId: string, payment: Omit<PaymentRecord, 'id' | 'invoiceId' | 'recordedBy'>) => void;
  getInvoicesByProjectId: (projectId: string) => Invoice[];
  
  // Delivery & Review actions
  updateDeliveryConfig: (projectId: string, updates: Partial<DeliveryConfig>) => void;
  unlockDeliveryManually: (projectId: string) => void;
  submitProjectReview: (projectId: string, review: Omit<ProjectReview, 'id' | 'createdAt'>) => void;
  
  // Notifications actions
  addNotification: (notif: Omit<NotificationItem, 'id' | 'date' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  
  // Profile & settings
  updateProfile: (updates: Partial<DesignerProfile>) => void;
  resetDemoData: () => void;
  completeOnboarding: (step?: number) => Promise<{ success: boolean; error?: string }>;
  loadSampleDemoData: () => void;
  deleteDemoData: () => void;
  resetWorkspaceData: (confirmWord: string) => boolean;
  hasDemoData: boolean;
  
  // Client Portal preview
  activeClientPortalToken: string | null;
  isClientPortalPreview: boolean;
  openClientPortal: (token: string, isPreview?: boolean) => void;
  closeClientPortal: () => void;

  // Stage 3 Appointments & Planning
  appointments: ClientAppointment[];
  addAppointment: (apt: Omit<ClientAppointment, 'id'>) => ClientAppointment;
  deleteAppointment: (id: string) => void;

  // Stage 3 Time Tracking & Expenses
  timeEntries: TimeEntry[];
  addTimeEntry: (entry: Omit<TimeEntry, 'id'>) => TimeEntry;
  deleteTimeEntry: (id: string) => void;
  expenses: ProjectExpense[];
  addExpense: (expense: Omit<ProjectExpense, 'id'>) => ProjectExpense;
  deleteExpense: (id: string) => void;

  // Stage 3 Leads
  leads: PublicLeadSubmission[];
  addLead: (lead: Omit<PublicLeadSubmission, 'id' | 'createdAt' | 'status'>) => PublicLeadSubmission;
  updateLeadStatus: (id: string, status: 'new' | 'converted' | 'archived') => void;

  // Stage 3 Reminders
  reminderRules: ReminderRuleConfig[];
  updateReminderRule: (id: string, updates: Partial<ReminderRuleConfig>) => void;
  reminderQueue: ReminderQueueItem[];
  sendReminder: (reminderId: string) => void;
  dismissReminder: (reminderId: string) => void;

  // Stage 3 Email Logs
  emailLogs: EmailLogItem[];
  addEmailLog: (log: Omit<EmailLogItem, 'id' | 'sentAt'>) => void;

  // Stage 3 Payments & Audit
  paymentTransactions: PaymentTransaction[];
  recordOnlinePayment: (tx: Omit<PaymentTransaction, 'id' | 'date'>) => void;
  auditLogs: AuditLogItem[];
  addAuditLog: (log: Omit<AuditLogItem, 'id' | 'timestamp'>) => void;

  // Catalogue des Prestations & Tarifs
  catalogServices: CatalogService[];
  catalogPacks: CatalogPack[];
  projectTemplates: ProjectTemplate[];
  customCategories: string[];
  addCatalogService: (service: Omit<CatalogService, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'priceHistory' | 'usageCount'>) => CatalogService;
  updateCatalogService: (id: string, updates: Partial<CatalogService>, reason?: string) => void;
  duplicateCatalogService: (id: string) => CatalogService;
  archiveCatalogService: (id: string) => void;
  reactivateCatalogService: (id: string) => void;
  deleteCatalogService: (id: string) => { success: boolean; error?: string };
  importCommonPrestations: (items: Array<{ suggestionId: string; customPriceCents: number }>) => void;
  
  // Packs
  addCatalogPack: (pack: Omit<CatalogPack, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'priceHistory' | 'usageCount'>) => CatalogPack;
  updateCatalogPack: (id: string, updates: Partial<CatalogPack>, reason?: string) => void;
  duplicateCatalogPack: (id: string) => CatalogPack;
  archiveCatalogPack: (id: string) => void;
  reactivateCatalogPack: (id: string) => void;
  deleteCatalogPack: (id: string) => { success: boolean; error?: string };

  // Modèles de projet
  addProjectTemplate: (template: Omit<ProjectTemplate, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>) => ProjectTemplate;
  updateProjectTemplate: (id: string, updates: Partial<ProjectTemplate>) => void;
  duplicateProjectTemplate: (id: string) => ProjectTemplate;
  deleteProjectTemplate: (id: string) => void;
  addCustomCategory: (category: string) => void;
}

const STORAGE_KEYS = {
  AUTH: 'eyesonwork_auth',
  CLIENTS: 'eyesonwork_clients',
  PROJECTS: 'eyesonwork_projects',
  QUOTES: 'eyesonwork_quotes',
  INVOICES: 'eyesonwork_invoices',
  NOTIFICATIONS: 'eyesonwork_notifications',
  PROFILE: 'eyesonwork_profile',
  THEME: 'eyesonwork_theme',
  APPOINTMENTS: 'eyesonwork_appointments',
  TIME_ENTRIES: 'eyesonwork_time_entries',
  EXPENSES: 'eyesonwork_expenses',
  REMINDERS: 'eyesonwork_reminders',
  REMINDER_RULES: 'eyesonwork_reminder_rules',
  LEADS: 'eyesonwork_leads',
  EMAIL_LOGS: 'eyesonwork_email_logs',
  PAYMENTS: 'eyesonwork_payments',
  AUDIT_LOGS: 'eyesonwork_audit_logs',
  WORKSPACES: 'eyesonwork_workspaces',
  PLANS: 'eyesonwork_plans',
  PROMOS: 'eyesonwork_promos',
  PLATFORM_TEMPLATES: 'eyesonwork_platform_templates',
  CATALOG_SERVICES: 'eyesonwork_catalog_services',
  CATALOG_PACKS: 'eyesonwork_catalog_packs',
  PROJECT_TEMPLATES: 'eyesonwork_project_templates',
  CUSTOM_CATEGORIES: 'eyesonwork_custom_categories'
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Theme: Dark (Aurelia) and Light (Lumina) supported
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.THEME);
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (theme === 'light') {
      root.classList.remove('dark');
      root.classList.add('light');
    } else {
      root.classList.remove('light');
      root.classList.add('dark');
    }
    try {
      localStorage.setItem(STORAGE_KEYS.THEME, theme);
    } catch {}
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // Workspaces state
  const [allWorkspaces, setAllWorkspaces] = useState<Workspace[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.WORKSPACES);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_DEMO_WORKSPACES;
  });

  const saveWorkspaces = (next: Workspace[]) => {
    setAllWorkspaces(next);
    localStorage.setItem(STORAGE_KEYS.WORKSPACES, JSON.stringify(next));
  };

  // Plans config
  const [plans, setPlans] = useState<PlanConfig[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PLANS);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_PLANS;
  });

  // Promo codes
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PROMOS);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_PROMO_CODES;
  });

  // Platform email templates
  const [platformEmailTemplates, setPlatformEmailTemplates] = useState<PlatformEmailTemplate[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PLATFORM_TEMPLATES);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return DEFAULT_PLATFORM_EMAIL_TEMPLATES;
  });

  // Auth state
  const [auth, setAuth] = useState<UserAuth>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUTH);
    if (saved) {
      try { 
        const parsed = JSON.parse(saved);
        if (parsed && parsed.uid && parsed.isAuthenticated) {
          const isSuper = isSuperAdminUser(parsed.email);
          return {
            ...parsed,
            workspaceId: parsed.workspaceId || 'ws_abdoulaye',
            role: parsed.role || (isSuper ? 'superadmin' : 'owner'),
            isSuperAdmin: parsed.isSuperAdmin !== undefined ? parsed.isSuperAdmin : isSuper
          };
        }
      } catch {}
    }
    return {
      uid: '',
      email: '',
      displayName: '',
      isAuthenticated: false,
      emailVerified: false,
      provider: 'password',
      linkedProviders: ['password'],
      workspaceId: '',
      role: 'owner',
      isSuperAdmin: false,
      termsAcceptedVersion: undefined,
      termsAcceptedAt: undefined,
      onboardingCompleted: false,
      onboardingStep: 1
    };
  });

  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUTH);
      if (saved) {
        const parsed = JSON.parse(saved);
        return Boolean(parsed.isAuthenticated && parsed.email);
      }
    } catch {}
    return false;
  });
  const [authError, setAuthError] = useState<string | null>(null);
  const clearAuthError = () => setAuthError(null);

  const saveAuth = (newAuth: UserAuth) => {
    setAuth(newAuth);
    localStorage.setItem(STORAGE_KEYS.AUTH, JSON.stringify(newAuth));
  };

  const loginAsDemo = () => {
    saveAuth({
      uid: 'designer_001',
      email: 'contact@monstudio.fr',
      displayName: 'Mon Studio Graphique',
      photoURL: '',
      isAuthenticated: true,
      emailVerified: true,
      provider: 'password',
      linkedProviders: ['password'],
      workspaceId: 'ws_abdoulaye',
      role: 'owner',
      isSuperAdmin: false,
      termsAcceptedVersion: CURRENT_TERMS_VERSION,
      termsAcceptedAt: new Date().toISOString(),
      onboardingCompleted: true,
      onboardingStep: 5
    });
  };

  const loginWithEmail = async (email: string, pass: string): Promise<boolean> => {
    const cleanEmail = email.trim().toLowerCase();
    if (cleanEmail.length > 3 && pass.length >= 4) {
      setIsAuthLoading(true);
      try {
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanEmail,
            password: pass
          })
        });
        const loginData = await loginRes.json();
        if (!loginRes.ok || !loginData.success) {
          setIsAuthLoading(false);
          return false;
        }

        const serverUser = loginData.profile;
        const isSuper = isSuperAdminUser(cleanEmail) || serverUser?.role === 'superadmin';
        const existingWs = allWorkspaces.find(w => w.ownerEmail.toLowerCase() === cleanEmail);
        const wsId = serverUser?.workspaceId || (existingWs ? existingWs.id : `ws_${cleanEmail.replace(/[^a-z0-9]/gi, '_')}`);
        const isVerified = isSuper || Boolean(serverUser?.emailVerified);

        // Ensure workspace is registered in allWorkspaces
        if (!allWorkspaces.some(w => w.id === wsId)) {
          const userWs: Workspace = {
            id: wsId,
            name: serverUser?.studioName || `Studio ${serverUser?.displayName || cleanEmail.split('@')[0]}`,
            ownerId: serverUser?.uid || `user_${Date.now()}`,
            ownerEmail: cleanEmail,
            planId: 'free',
            planStatus: 'trial',
            planBillingCycle: 'monthly',
            planStartedAt: new Date().toISOString(),
            planRenewsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            storageUsedMb: 0,
            members: [{
              userId: serverUser?.uid || `user_${Date.now()}`,
              email: cleanEmail,
              name: serverUser?.displayName || cleanEmail.split('@')[0],
              role: 'owner',
              joinedAt: new Date().toISOString()
            }],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          saveWorkspaces([userWs, ...allWorkspaces]);
        }

        const newAuth: UserAuth = {
          uid: serverUser?.uid || (isSuper ? 'user_abdoulaye_admin' : `user_${Date.now()}`),
          email: cleanEmail,
          displayName: serverUser?.displayName || (isSuper ? 'Abdoulaye Ouattara' : cleanEmail.split('@')[0] || 'Graphiste'),
          isAuthenticated: true,
          emailVerified: isVerified,
          emailVerifiedAt: serverUser?.emailVerifiedAt || (isVerified ? new Date().toISOString() : null),
          provider: 'password',
          linkedProviders: ['password'],
          workspaceId: wsId,
          role: serverUser?.role || (isSuper ? 'superadmin' : 'owner'),
          isSuperAdmin: isSuper,
          termsAcceptedVersion: serverUser?.termsAcceptedVersion || null,
          termsAcceptedAt: serverUser?.termsAcceptedAt || null,
          privacyAcceptedVersion: serverUser?.privacyAcceptedVersion || null,
          privacyAcceptedAt: serverUser?.privacyAcceptedAt || null,
          onboardingCompleted: serverUser?.onboardingCompleted ?? false,
          onboardingCompletedAt: serverUser?.onboardingCompletedAt || null,
          onboardingStep: serverUser?.onboardingStep ?? 1,
          createdAt: serverUser?.createdAt || new Date().toISOString()
        };

        saveAuth(newAuth);
        localStorage.setItem(`${STORAGE_KEYS.AUTH}_${cleanEmail}`, JSON.stringify(newAuth));

        setProfile(prev => ({
          ...prev,
          name: serverUser?.displayName || prev.name,
          studioName: serverUser?.studioName || prev.studioName,
          email: cleanEmail,
          emailVerified: isVerified,
          emailVerifiedAt: serverUser?.emailVerifiedAt || (isVerified ? new Date().toISOString() : null),
          termsAcceptedVersion: serverUser?.termsAcceptedVersion || null,
          termsAcceptedAt: serverUser?.termsAcceptedAt || null,
          privacyAcceptedVersion: serverUser?.privacyAcceptedVersion || null,
          privacyAcceptedAt: serverUser?.privacyAcceptedAt || null,
          onboardingCompleted: serverUser?.onboardingCompleted ?? false,
          onboardingCompletedAt: serverUser?.onboardingCompletedAt || null,
          onboardingStep: serverUser?.onboardingStep ?? 1,
          workspaceId: wsId
        }));

        setIsAuthLoading(false);
        return true;
      } catch (err) {
        console.error('[loginWithEmail] login failed:', err);
        setIsAuthLoading(false);
        return false;
      }
    }
    return false;
  };

  const logout = () => {
    // 0. Sign out from Firebase Auth
    try {
      signOut(firebaseAuth).catch(() => {});
    } catch {}

    // 1. Reset auth state
    saveAuth({
      uid: '',
      email: '',
      displayName: '',
      isAuthenticated: false,
      workspaceId: '',
      role: 'owner',
      isSuperAdmin: false
    });

    // 2. Full deep cleanup: session, local caches, tokens
    try {
      localStorage.removeItem(STORAGE_KEYS.AUTH);
      localStorage.removeItem(STORAGE_KEYS.PROFILE);
      sessionStorage.clear();
      // Remove any user-scoped or session keys
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('eyesonwork_auth_') || k.startsWith('eyesonwork_session_') || k.startsWith('eyesonwork_token_'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}

    // 3. Reset in-memory profile
    setProfile(INITIAL_DESIGNER_PROFILE);

    // 4. Reset client portal state
    setActiveClientPortalToken(null);
    setIsClientPortalPreview(false);
    setIsUpgradeModalOpen(false);
  };

  // Active Workspace
  const currentWorkspace: Workspace = useMemo(() => {
    if (auth.workspaceId) {
      const found = allWorkspaces.find(w => w.id === auth.workspaceId);
      if (found) return found;
    }
    return allWorkspaces[0] || INITIAL_DEMO_WORKSPACES[0];
  }, [auth.workspaceId, allWorkspaces]);

  // Upgrade Modal State
  const [isUpgradeModalOpen, setIsUpgradeModalOpen] = useState(false);
  const openUpgradeModal = (_reasonOrPlan?: string | PlanId) => setIsUpgradeModalOpen(true);
  const closeUpgradeModal = () => setIsUpgradeModalOpen(false);

  // Change Plan
  const changePlan = async (planId: PlanId, cycle: BillingCycle, promoCode?: string): Promise<{ success: boolean; message: string }> => {
    const ws = currentWorkspace;
    if (!ws) return { success: false, message: 'Espace de travail introuvable.' };
    const now = new Date();
    const renews = new Date(now);
    if (cycle === 'monthly') renews.setMonth(renews.getMonth() + 1);
    else if (cycle === 'quarterly') renews.setMonth(renews.getMonth() + 3);
    else if (cycle === 'semiannual') renews.setMonth(renews.getMonth() + 6);
    else if (cycle === 'annual') renews.setFullYear(renews.getFullYear() + 1);

    const updatedWs: Workspace = {
      ...ws,
      planId,
      planStatus: 'active',
      planBillingCycle: cycle,
      planRenewsAt: renews.toISOString(),
      promoCodeApplied: promoCode,
      updatedAt: now.toISOString()
    };

    saveWorkspaces(allWorkspaces.map(w => w.id === ws.id ? updatedWs : w));
    return { success: true, message: `Votre formule a été mise à jour vers ${planId === 'pro' ? 'Pro' : 'Studio & Collectif'} avec succès !` };
  };

  // Super Admin Workspace Actions
  const superAdminUpdateWorkspacePlan = (workspaceId: string, planId: PlanId, durationMonths: number = 12) => {
    const now = new Date();
    const renews = new Date(now);
    renews.setMonth(renews.getMonth() + durationMonths);

    saveWorkspaces(allWorkspaces.map(w => {
      if (w.id === workspaceId) {
        return {
          ...w,
          planId,
          planStatus: 'active',
          planRenewsAt: renews.toISOString(),
          updatedAt: now.toISOString()
        };
      }
      return w;
    }));
  };

  const superAdminToggleWorkspaceStatus = (workspaceId: string, status?: 'active' | 'expired' | 'trial' | 'grace_period') => {
    const now = new Date();
    saveWorkspaces(allWorkspaces.map(w => {
      if (w.id === workspaceId) {
        const nextStatus = status || (w.planStatus === 'active' ? 'expired' : 'active');
        return {
          ...w,
          planStatus: nextStatus,
          updatedAt: now.toISOString()
        };
      }
      return w;
    }));
  };

  const updatePlansConfig = (newPlans: PlanConfig[]) => {
    setPlans(newPlans);
    localStorage.setItem(STORAGE_KEYS.PLANS, JSON.stringify(newPlans));
  };

  const addPromoCode = (promo: Omit<PromoCode, 'id' | 'usedCount'>) => {
    const newPromo: PromoCode = {
      ...promo,
      id: `promo_${Date.now()}`,
      usedCount: 0
    };
    const next = [newPromo, ...promoCodes];
    setPromoCodes(next);
    localStorage.setItem(STORAGE_KEYS.PROMOS, JSON.stringify(next));
  };

  const togglePromoCode = (id: string) => {
    const next = promoCodes.map(p => p.id === id ? { ...p, active: !p.active } : p);
    setPromoCodes(next);
    localStorage.setItem(STORAGE_KEYS.PROMOS, JSON.stringify(next));
  };

  // Auth additions
  const registerWithEmail = async (email: string, password: string, name: string, termsVersion: string = '2026.1'): Promise<{ success: boolean; error?: string; requireVerification?: boolean }> => {
    const cleanEmail = email.trim();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Veuillez saisir une adresse email valide.' };
    }
    if (password.length < 10) {
      return { success: false, error: 'Le mot de passe doit comporter au moins 10 caractères.' };
    }
    const isSuper = isSuperAdminUser(cleanEmail);
    const newWsId = `ws_${Date.now()}`;
    const newWs: Workspace = {
      id: newWsId,
      name: `Studio ${name || cleanEmail.split('@')[0]}`,
      ownerId: `user_${Date.now()}`,
      ownerEmail: cleanEmail,
      planId: 'free',
      planStatus: 'trial',
      planBillingCycle: 'monthly',
      planStartedAt: new Date().toISOString(),
      planRenewsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      storageUsedMb: 0,
      members: [
        {
          userId: `user_${Date.now()}`,
          email: cleanEmail,
          name: name || cleanEmail.split('@')[0],
          role: 'owner',
          joinedAt: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    saveWorkspaces([newWs, ...allWorkspaces]);

    const newAuth: UserAuth = {
      uid: newWs.ownerId,
      email: cleanEmail,
      displayName: name || cleanEmail.split('@')[0],
      isAuthenticated: true,
      emailVerified: false,
      provider: 'password',
      linkedProviders: ['password'],
      workspaceId: newWsId,
      role: isSuper ? 'superadmin' : 'owner',
      isSuperAdmin: isSuper,
      termsAcceptedVersion: termsVersion,
      termsAcceptedAt: new Date().toISOString(),
      onboardingCompleted: false,
      onboardingStep: 1,
      createdAt: new Date().toISOString()
    };
    saveAuth(newAuth);
    localStorage.setItem(`${STORAGE_KEYS.AUTH}_${cleanEmail.toLowerCase()}`, JSON.stringify(newAuth));

    const userProfileKey = `${STORAGE_KEYS.PROFILE}_${cleanEmail.toLowerCase()}`;
    const defaultProfile: DesignerProfile = {
      ...INITIAL_DESIGNER_PROFILE,
      id: newWs.ownerId,
      name: name || cleanEmail.split('@')[0] || 'Graphiste',
      studioName: name ? `Studio ${name}` : 'Mon Studio Graphique',
      email: cleanEmail,
      emailVerified: false,
      termsAcceptedVersion: null,
      onboardingCompleted: false,
      onboardingStep: 1,
      workspaceId: newWsId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    localStorage.setItem(userProfileKey, JSON.stringify(defaultProfile));
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(defaultProfile));
    setProfile(defaultProfile);

    // Enregistrement sécurisé du compte avec mot de passe sur le serveur
    try {
      const regRes = await fetch('/api/auth/register-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: cleanEmail,
          password,
          displayName: name || cleanEmail.split('@')[0],
          studioName: defaultProfile.studioName
        })
      });
      const regData = await regRes.json();
      if (!regRes.ok || !regData.success) {
        return { success: false, error: regData.error || 'Erreur lors de la création du compte.' };
      }
    } catch (regErr) {
      console.warn('[Register] Backend registration notice:', regErr);
    }

    return { success: true, requireVerification: true };
  };

  const loginWithGoogle = async (
    customEmail?: string,
    customName?: string
  ): Promise<{ success: boolean; error?: string; requireTermsAcceptance?: boolean }> => {
    if (!customEmail || !customEmail.trim()) {
      return { success: false, error: 'Veuillez sélectionner un compte Google.' };
    }
    const googleEmail = customEmail.trim().toLowerCase();
    const rawPart = googleEmail.split('@')[0].replace(/[._]/g, ' ');
    const displayName = customName || (rawPart.charAt(0).toUpperCase() + rawPart.slice(1));
    const isSuper = isSuperAdminUser(googleEmail);

    setIsAuthLoading(true);
    try {
      // Synchronisation avec la base de données permanente côté serveur
      const syncRes = await fetch('/api/auth/login-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: googleEmail,
          provider: 'google',
          displayName
        })
      });
      const syncData = await syncRes.json();
      const serverUser = syncData?.profile;

      let ws = allWorkspaces.find(w => w.ownerEmail.toLowerCase() === googleEmail);
      if (!ws) {
        ws = {
          id: serverUser?.workspaceId || `ws_${Date.now()}`,
          name: serverUser?.studioName || `Studio ${displayName}`,
          ownerId: serverUser?.uid || `user_${Date.now()}`,
          ownerEmail: googleEmail,
          planId: 'free',
          planStatus: 'trial',
          planBillingCycle: 'monthly',
          planStartedAt: new Date().toISOString(),
          planRenewsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
          storageUsedMb: 0,
          members: [{
            userId: serverUser?.uid || `user_${Date.now()}`,
            email: googleEmail,
            name: displayName,
            role: 'owner',
            joinedAt: new Date().toISOString()
          }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        saveWorkspaces([ws, ...allWorkspaces]);
      }

      const newAuth: UserAuth = {
        uid: serverUser?.uid || ws.ownerId,
        email: googleEmail,
        displayName: serverUser?.displayName || displayName,
        photoURL: serverUser?.avatarUrl || '',
        isAuthenticated: true,
        emailVerified: true,
        emailVerifiedAt: serverUser?.emailVerifiedAt || new Date().toISOString(),
        provider: 'google',
        linkedProviders: ['google'],
        workspaceId: ws.id,
        role: serverUser?.role || (isSuper ? 'superadmin' : 'owner'),
        isSuperAdmin: isSuper || serverUser?.role === 'superadmin',
        termsAcceptedVersion: serverUser?.termsAcceptedVersion || null,
        termsAcceptedAt: serverUser?.termsAcceptedAt || null,
        privacyAcceptedVersion: serverUser?.privacyAcceptedVersion || null,
        privacyAcceptedAt: serverUser?.privacyAcceptedAt || null,
        onboardingCompleted: serverUser?.onboardingCompleted ?? false,
        onboardingCompletedAt: serverUser?.onboardingCompletedAt || null,
        onboardingStep: serverUser?.onboardingStep ?? 1,
        createdAt: serverUser?.createdAt || new Date().toISOString()
      };
      saveAuth(newAuth);
      localStorage.setItem(`${STORAGE_KEYS.AUTH}_${googleEmail}`, JSON.stringify(newAuth));

      setProfile(prev => ({
        ...prev,
        id: serverUser?.uid || ws.ownerId,
        name: serverUser?.displayName || displayName,
        studioName: serverUser?.studioName || `Studio ${displayName}`,
        email: googleEmail,
        emailVerified: true,
        emailVerifiedAt: serverUser?.emailVerifiedAt || new Date().toISOString(),
        termsAcceptedVersion: serverUser?.termsAcceptedVersion || null,
        termsAcceptedAt: serverUser?.termsAcceptedAt || null,
        privacyAcceptedVersion: serverUser?.privacyAcceptedVersion || null,
        privacyAcceptedAt: serverUser?.privacyAcceptedAt || null,
        onboardingCompleted: serverUser?.onboardingCompleted ?? false,
        onboardingCompletedAt: serverUser?.onboardingCompletedAt || null,
        onboardingStep: serverUser?.onboardingStep ?? 1,
        workspaceId: ws.id
      }));

      setIsAuthLoading(false);
      const isTermsValid = Boolean(serverUser?.termsAcceptedVersion && serverUser.termsAcceptedVersion >= CURRENT_TERMS_VERSION);
      return { success: true, requireTermsAcceptance: !isTermsValid };
    } catch (err: any) {
      console.error('[loginWithGoogle] sync error:', err);
      setIsAuthLoading(false);
      return { success: false, error: 'Échec de synchronisation du compte Google.' };
    }
  };

  const sendVerificationCode = async (targetEmail?: string): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    cooldownSeconds?: number;
    expiresAt?: number;
  }> => {
    const emailToSend = (targetEmail || auth.email || '').trim().toLowerCase();
    if (!emailToSend) {
      return { success: false, error: 'NO_EMAIL', message: 'Adresse email manquante.' };
    }

    try {
      const res = await fetch('/api/auth/send-verification-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: emailToSend,
          userId: auth.uid,
          studioName: profile.studioName || profile.name || 'eyes-onwork'
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.error || 'SEND_FAILED',
          message: data.message || "Nous n'avons pas pu envoyer l'email, réessayez dans un instant.",
          cooldownSeconds: data.remainingSeconds || 0
        };
      }

      return {
        success: true,
        message: data.message || 'Code envoyé avec succès.',
        cooldownSeconds: data.cooldownSeconds || 60,
        expiresAt: data.expiresAt
      };
    } catch (err: any) {
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: "Nous n'avons pas pu envoyer l'email, réessayez dans un instant."
      };
    }
  };

  const verifyEmailCode = async (code: string): Promise<{
    success: boolean;
    error?: string;
    message?: string;
    remainingAttempts?: number;
  }> => {
    const cleanCode = code.trim();
    const cleanEmail = auth.email.trim().toLowerCase();

    if (!cleanCode) {
      return { success: false, error: 'EMPTY_CODE', message: 'Veuillez saisir votre code à 6 chiffres.' };
    }

    try {
      const res = await fetch('/api/auth/verify-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, code: cleanCode })
      });

      const data = await res.json();

      if (res.ok && data.success) {
        const verifiedAt = data.emailVerifiedAt || data.profile?.emailVerifiedAt || new Date().toISOString();
        if (auth.isAuthenticated) {
          const updatedAuth = {
            ...auth,
            emailVerified: true,
            emailVerifiedAt: verifiedAt
          };
          saveAuth(updatedAuth);
          if (auth.email) {
            localStorage.setItem(`${STORAGE_KEYS.AUTH}_${auth.email.toLowerCase()}`, JSON.stringify(updatedAuth));
          }
          // Marquer le profil utilisateur comme vérifié
          updateProfile({ emailVerified: true, emailVerifiedAt: verifiedAt });
        }
        return { success: true, message: data.message || 'Email vérifié avec succès.' };
      }

      return {
        success: false,
        error: data.error || 'INVALID_CODE',
        message: data.message || 'Code invalide.',
        remainingAttempts: data.remainingAttempts
      };
    } catch (err: any) {
      return {
        success: false,
        error: 'NETWORK_ERROR',
        message: 'Erreur réseau lors de la vérification. Veuillez réessayer.'
      };
    }
  };

  const acceptCurrentTerms = async (version: string = CURRENT_TERMS_VERSION): Promise<{ success: boolean; error?: string }> => {
    if (!auth.isAuthenticated || !auth.email) {
      return { success: false, error: 'Utilisateur non connecté.' };
    }

    try {
      const res = await fetch('/api/auth/accept-terms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: auth.email,
          termsVersion: version,
          privacyVersion: CURRENT_PRIVACY_VERSION
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        return {
          success: false,
          error: data.message || "Échec de l'enregistrement de vos conditions sur le serveur."
        };
      }

      const updated = data.profile;
      const updatedAuth: UserAuth = {
        ...auth,
        termsAcceptedVersion: updated.termsAcceptedVersion || version,
        termsAcceptedAt: updated.termsAcceptedAt || new Date().toISOString(),
        privacyAcceptedVersion: updated.privacyAcceptedVersion || CURRENT_PRIVACY_VERSION,
        privacyAcceptedAt: updated.privacyAcceptedAt || new Date().toISOString()
      };
      saveAuth(updatedAuth);
      localStorage.setItem(`${STORAGE_KEYS.AUTH}_${auth.email.toLowerCase()}`, JSON.stringify(updatedAuth));

      setProfile(prev => ({
        ...prev,
        termsAcceptedVersion: updated.termsAcceptedVersion || version,
        termsAcceptedAt: updated.termsAcceptedAt || new Date().toISOString(),
        privacyAcceptedVersion: updated.privacyAcceptedVersion || CURRENT_PRIVACY_VERSION,
        privacyAcceptedAt: updated.privacyAcceptedAt || new Date().toISOString()
      }));

      return { success: true };
    } catch (err: any) {
      return {
        success: false,
        error: "Erreur réseau : impossible d'enregistrer votre acceptation sur le serveur."
      };
    }
  };

  const completeOnboarding = async (step: number = 5): Promise<{ success: boolean; error?: string }> => {
    if (!auth.isAuthenticated || !auth.email) {
      return { success: false, error: 'Utilisateur non connecté.' };
    }

    try {
      const res = await fetch('/api/auth/complete-onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: auth.email,
          step
        })
      });

      const data = await res.json();
      const updated = data?.profile;

      const updatedAuth: UserAuth = {
        ...auth,
        onboardingCompleted: true,
        onboardingCompletedAt: updated?.onboardingCompletedAt || new Date().toISOString(),
        onboardingStep: step
      };
      saveAuth(updatedAuth);
      localStorage.setItem(`${STORAGE_KEYS.AUTH}_${auth.email.toLowerCase()}`, JSON.stringify(updatedAuth));

      setProfile(prev => ({
        ...prev,
        onboardingCompleted: true,
        onboardingCompletedAt: updated?.onboardingCompletedAt || new Date().toISOString(),
        onboardingStep: step
      }));

      return { success: true };
    } catch (err) {
      const updatedAuth: UserAuth = {
        ...auth,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
        onboardingStep: step
      };
      saveAuth(updatedAuth);
      setProfile(prev => ({
        ...prev,
        onboardingCompleted: true,
        onboardingCompletedAt: new Date().toISOString(),
        onboardingStep: step
      }));
      return { success: true };
    }
  };

  const linkGoogleAccount = async (_email?: string): Promise<boolean> => {
    if (auth.isAuthenticated) {
      const providers = auth.linkedProviders || [auth.provider || 'password'];
      if (!providers.includes('google')) {
        providers.push('google');
      }
      saveAuth({
        ...auth,
        linkedProviders: providers
      });
      return true;
    }
    return false;
  };

  const reauthenticate = async (password: string): Promise<boolean> => {
    return password.length >= 6;
  };

  // Profile
  const [profile, setProfile] = useState<DesignerProfile>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_DESIGNER_PROFILE;
  });

  const updateProfile = (updates: Partial<DesignerProfile>) => {
    setProfile(prev => {
      const next = { ...prev, ...updates };
      localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(next));
      if (auth.email) {
        localStorage.setItem(`${STORAGE_KEYS.PROFILE}_${auth.email.toLowerCase()}`, JSON.stringify(next));
      }
      return next;
    });
  };

  // Synchronisation avec le profil permanent sur le serveur de base de données
  useEffect(() => {
    let isCancelled = false;
    if (auth.isAuthenticated && auth.email) {
      setIsAuthLoading(true);
      fetch(`/api/user/profile?email=${encodeURIComponent(auth.email.trim().toLowerCase())}`)
        .then(res => res.json())
        .then(data => {
          if (isCancelled) return;
          if (data && data.success && data.profile) {
            const serverUser = data.profile;
            setAuth(prev => ({
              ...prev,
              uid: serverUser.uid || prev.uid,
              displayName: serverUser.displayName || prev.displayName,
              emailVerified: serverUser.emailVerified ?? prev.emailVerified,
              emailVerifiedAt: serverUser.emailVerifiedAt ?? prev.emailVerifiedAt,
              termsAcceptedVersion: serverUser.termsAcceptedVersion ?? prev.termsAcceptedVersion,
              termsAcceptedAt: serverUser.termsAcceptedAt ?? prev.termsAcceptedAt,
              privacyAcceptedVersion: serverUser.privacyAcceptedVersion ?? prev.privacyAcceptedVersion,
              privacyAcceptedAt: serverUser.privacyAcceptedAt ?? prev.privacyAcceptedAt,
              onboardingCompleted: serverUser.onboardingCompleted ?? prev.onboardingCompleted,
              onboardingCompletedAt: serverUser.onboardingCompletedAt ?? prev.onboardingCompletedAt,
              onboardingStep: serverUser.onboardingStep ?? prev.onboardingStep,
              workspaceId: serverUser.workspaceId ?? prev.workspaceId,
              role: serverUser.role ?? prev.role,
              isSuperAdmin: serverUser.role === 'superadmin' || isSuperAdminUser(serverUser.email)
            }));

            setProfile(prev => ({
              ...prev,
              name: serverUser.displayName || prev.name,
              studioName: serverUser.studioName || prev.studioName,
              email: serverUser.email || prev.email,
              emailVerified: serverUser.emailVerified ?? prev.emailVerified,
              emailVerifiedAt: serverUser.emailVerifiedAt ?? prev.emailVerifiedAt,
              termsAcceptedVersion: serverUser.termsAcceptedVersion ?? prev.termsAcceptedVersion,
              termsAcceptedAt: serverUser.termsAcceptedAt ?? prev.termsAcceptedAt,
              privacyAcceptedVersion: serverUser.privacyAcceptedVersion ?? prev.privacyAcceptedVersion,
              privacyAcceptedAt: serverUser.privacyAcceptedAt ?? prev.privacyAcceptedAt,
              onboardingCompleted: serverUser.onboardingCompleted ?? prev.onboardingCompleted,
              onboardingCompletedAt: serverUser.onboardingCompletedAt ?? prev.onboardingCompletedAt,
              onboardingStep: serverUser.onboardingStep ?? prev.onboardingStep,
              workspaceId: serverUser.workspaceId ?? prev.workspaceId
            }));
          }
        })
        .catch(err => {
          console.warn('[Profile Sync] Failed to fetch server profile:', err);
        })
        .finally(() => {
          if (!isCancelled) {
            setIsAuthLoading(false);
          }
        });
    } else {
      setIsAuthLoading(false);
    }

    return () => {
      isCancelled = true;
    };
  }, [auth.isAuthenticated, auth.email]);

  // Clients
  const [clients, setClients] = useState<Client[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CLIENTS);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_CLIENTS;
  });

  const saveClients = (next: Client[]) => {
    setClients(next);
    localStorage.setItem(STORAGE_KEYS.CLIENTS, JSON.stringify(next));
  };

  const addClient = (data: Omit<Client, 'id' | 'createdAt' | 'updatedAt'>): Client => {
    const now = new Date().toISOString();
    const newClient: Client = {
      ...data,
      workspaceId: currentWorkspace.id,
      id: `client_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: now,
      updatedAt: now
    };
    saveClients([newClient, ...clients]);

    // Persistance asynchrone Firestore
    firestoreSetDoc(firestoreDoc(db, 'clients', newClient.id), {
      ...newClient,
      ownerId: auth.uid || currentWorkspace.ownerId,
      workspaceId: currentWorkspace.id
    }).catch(err => console.warn('[Firestore] Client write notice:', err));

    return newClient;
  };

  const updateClient = (id: string, updates: Partial<Client>) => {
    const updatedList = clients.map(c => (c.id === id ? { ...c, ...updates, updatedAt: new Date().toISOString() } : c));
    saveClients(updatedList);
    const updated = updatedList.find(c => c.id === id);
    if (updated) {
      firestoreSetDoc(firestoreDoc(db, 'clients', id), updated, { merge: true }).catch(() => {});
    }
  };

  const canDeleteClient = (id: string): { allowed: boolean; reason?: string; projectCount: number; quoteCount: number; invoiceCount: number } => {
    const pCount = projects.filter(p => p.clientId === id).length;
    const qCount = quotes.filter(q => q.clientId === id).length;
    const iCount = invoices.filter(i => i.clientId === id).length;
    if (pCount > 0 || qCount > 0 || iCount > 0) {
      return {
        allowed: false,
        reason: `Ce client est rattaché à ${pCount} projet(s), ${qCount} devis et ${iCount} facture(s). Sa suppression définitive est interdite afin de respecter les obligations légales et comptables. Nous vous recommandons de l'archiver.`,
        projectCount: pCount,
        quoteCount: qCount,
        invoiceCount: iCount
      };
    }
    return { allowed: true, projectCount: 0, quoteCount: 0, invoiceCount: 0 };
  };

  const archiveClient = (id: string) => {
    updateClient(id, { status: 'archived' });
  };

  const deleteClient = (id: string) => {
    const check = canDeleteClient(id);
    if (!check.allowed) {
      console.warn(`[Integrity] Suppression refusée pour le client ${id}:`, check.reason);
      return false;
    }
    saveClients(clients.filter(c => c.id !== id));
    firestoreDeleteDoc(firestoreDoc(db, 'clients', id)).catch(() => {});
    return true;
  };

  const getClientById = (id: string) => clients.find(c => c.id === id);

  const canDeleteProject = (id: string): { allowed: boolean; reason?: string; quoteCount: number; invoiceCount: number } => {
    const qCount = quotes.filter(q => q.projectId === id).length;
    const iCount = invoices.filter(i => i.projectId === id).length;
    if (qCount > 0 || iCount > 0) {
      return {
        allowed: false,
        reason: `Ce projet possède ${qCount} devis et ${iCount} facture(s) rattaché(s). Sa suppression directe est bloquée pour préserver la traçabilité financière. Nous vous suggérons d'archiver ce projet.`,
        quoteCount: qCount,
        invoiceCount: iCount
      };
    }
    return { allowed: true, quoteCount: 0, invoiceCount: 0 };
  };

  // Normalizers for robust data integrity
  const normalizeProject = (p: any): Project => ({
    ...p,
    lines: Array.isArray(p.lines) ? p.lines : [],
    subtotalHT: p.subtotalHT ?? (p.budget ?? 0),
    vatAmount: p.vatAmount ?? 0,
    totalTTC: p.totalTTC ?? (p.budget ?? 0),
    discountPercent: p.discountPercent ?? 0,
    depositPercent: p.depositPercent ?? 50,
    tasks: Array.isArray(p.tasks) ? p.tasks : [],
    activity: Array.isArray(p.activity) ? p.activity : [],
    mockupRounds: Array.isArray(p.mockupRounds) ? p.mockupRounds.map((r: any) => ({
      ...r,
      versions: Array.isArray(r.versions) ? r.versions.map((v: any) => ({
        ...v,
        pinComments: Array.isArray(v.pinComments) ? v.pinComments : [],
        generalComments: Array.isArray(v.generalComments) ? v.generalComments : []
      })) : []
    })) : [],
    files: Array.isArray(p.files) ? p.files : [],
    brief: {
      objectives: p.brief?.objectives || '',
      targetAudience: p.brief?.targetAudience || '',
      desiredStyle: p.brief?.desiredStyle || '',
      colors: Array.isArray(p.brief?.colors) ? p.brief.colors : [],
      typographyAndReferences: p.brief?.typographyAndReferences || '',
      expectedFormats: Array.isArray(p.brief?.expectedFormats) ? p.brief.expectedFormats : [],
      clientProvidedAssets: p.brief?.clientProvidedAssets || ''
    },
    delivery: p.delivery || {
      mode: 'auto',
      isUnlocked: false,
      thankYouMessage: '',
      selectedDeliverableIds: []
    },
    reviews: Array.isArray(p.reviews) ? p.reviews : [],
    revisionLimit: p.revisionLimit ?? 3,
    revisionsUsed: p.revisionsUsed ?? 0,
    paidRevisionsAdded: p.paidRevisionsAdded ?? 0,
    paidAmount: p.paidAmount ?? 0,
    depositAmount: p.depositAmount ?? 0,
    budget: p.budget ?? 0,
    clientLinkActive: p.clientLinkActive ?? true,
    clientShareToken: p.clientShareToken || `tok_${Math.random().toString(36).substring(2, 9)}`
  });

  // Projects
  const [projects, setProjects] = useState<Project[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PROJECTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map(normalizeProject);
        }
      } catch {}
    }
    return INITIAL_PROJECTS.map(normalizeProject);
  });

  const saveProjects = (next: Project[]) => {
    setProjects(next);
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(next));
  };

  // Ensure client list consistency so projects always have a matching client (counter never 0 if projects exist)
  useEffect(() => {
    if (projects.length > 0) {
      const existingClientIds = new Set(clients.map(c => c.id));
      const missingClients: Client[] = [];
      projects.forEach(p => {
        if (p.clientId && !existingClientIds.has(p.clientId)) {
          const fallbackCompany = p.title.split('—')[0]?.trim() || p.title.split('-')[0]?.trim() || 'Client Entreprise';
          const newClient: Client = {
            id: p.clientId,
            workspaceId: p.workspaceId || currentWorkspace.id,
            name: fallbackCompany,
            company: fallbackCompany,
            email: `contact@${fallbackCompany.toLowerCase().replace(/[^a-z0-9]/g, '') || 'client'}.com`,
            phone: '',
            address: '',
            status: 'active',
            createdAt: p.createdAt || new Date().toISOString(),
            updatedAt: p.updatedAt || new Date().toISOString()
          };
          missingClients.push(newClient);
          existingClientIds.add(p.clientId);
        }
      });
      if (missingClients.length > 0) {
        saveClients([...clients, ...missingClients]);
      }
    }
  }, [projects.length]);

  // Quotes
  const [quotes, setQuotes] = useState<Quote[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.QUOTES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((q: any) => ({
            ...q,
            lines: Array.isArray(q.lines) ? q.lines : []
          }));
        }
      } catch {}
    }
    return INITIAL_QUOTES;
  });

  const saveQuotes = (next: Quote[]) => {
    setQuotes(next);
    localStorage.setItem(STORAGE_KEYS.QUOTES, JSON.stringify(next));
  };

  // Invoices
  const [invoices, setInvoices] = useState<Invoice[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.INVOICES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map((inv: any) => ({
            ...inv,
            lines: Array.isArray(inv.lines) ? inv.lines : [],
            payments: Array.isArray(inv.payments) ? inv.payments : []
          }));
        }
      } catch {}
    }
    return INITIAL_INVOICES;
  });

  const saveInvoices = (next: Invoice[]) => {
    setInvoices(next);
    localStorage.setItem(STORAGE_KEYS.INVOICES, JSON.stringify(next));
  };

  // Notifications
  const [notifications, setNotifications] = useState<NotificationItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return INITIAL_NOTIFICATIONS;
  });

  const saveNotifications = (next: NotificationItem[]) => {
    setNotifications(next);
    localStorage.setItem(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(next));
  };

  const addNotification = (notif: Omit<NotificationItem, 'id' | 'date' | 'read'>) => {
    const newNotif: NotificationItem = {
      ...notif,
      id: `notif_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      date: new Date().toISOString(),
      read: false
    };
    saveNotifications([newNotif, ...notifications]);
  };

  const markNotificationRead = (id: string) => {
    saveNotifications(notifications.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllNotificationsRead = () => {
    saveNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  // Add Project
  const addProject = (
    data: Omit<Project, 'id' | 'clientShareToken' | 'clientLinkActive' | 'createdAt' | 'updatedAt' | 'paidAmount' | 'revisionsUsed' | 'paidRevisionsAdded' | 'tasks' | 'activity' | 'mockupRounds' | 'files' | 'delivery'>
  ): Project => {
    const now = new Date().toISOString();
    const client = clients.find(c => c.id === data.clientId);
    const clientPrefix = client ? client.company.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4) : 'cli';
    const randToken = `${clientPrefix}-${Math.random().toString(36).substring(2, 9)}-${Math.random().toString(36).substring(2, 8)}`;
    
    const lines = Array.isArray(data.lines) ? data.lines : [];
    let calculatedBudget = data.budget ?? 0;
    let subtotalHT = data.subtotalHT ?? calculatedBudget;
    let vatAmount = data.vatAmount ?? 0;
    let totalTTC = data.totalTTC ?? calculatedBudget;
    let depositAmount = data.depositAmount ?? 0;

    if (lines.length > 0) {
      subtotalHT = lines.reduce((sum, l) => sum + (l.unitPrice * l.quantity), 0);
      const discount = Math.round(subtotalHT * ((data.discountPercent || 0) / 100));
      const netHT = subtotalHT - discount;
      vatAmount = Math.round(lines.reduce((sum, l) => sum + ((l.unitPrice * l.quantity) * (l.vatRate / 100)), 0) * (1 - ((data.discountPercent || 0) / 100)));
      totalTTC = netHT + vatAmount;
      calculatedBudget = totalTTC;
      const pct = data.depositPercent ?? 50;
      depositAmount = Math.round(totalTTC * (pct / 100));
    }

    const newProject: Project = {
      ...data,
      workspaceId: currentWorkspace.id,
      id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      clientShareToken: randToken,
      clientLinkActive: true,
      lines,
      budget: calculatedBudget,
      subtotalHT,
      vatAmount,
      totalTTC,
      depositAmount,
      paidAmount: depositAmount > 0 && (data as any).paidAmount ? (data as any).paidAmount : 0,
      revisionsUsed: 0,
      paidRevisionsAdded: 0,
      mockupRounds: [],
      files: [],
      delivery: {
        mode: 'auto',
        isUnlocked: false,
        thankYouMessage: 'Merci pour votre confiance ! Retrouvez ci-dessous l’ensemble de vos fichiers haute définition.',
        selectedDeliverableIds: []
      },
      tasks: [
        { id: `t_${Date.now()}_1`, title: 'Cadrage du besoin et validation du brief', completed: true, dueDate: data.deadline },
        { id: `t_${Date.now()}_2`, title: 'Recherches visuelles et moodboard', completed: false, dueDate: data.deadline },
        { id: `t_${Date.now()}_3`, title: 'Conception des premières maquettes', completed: false, dueDate: data.deadline },
        { id: `t_${Date.now()}_4`, title: 'Préparation des exports et livraison finale', completed: false, dueDate: data.deadline }
      ],
      activity: [
        {
          id: `act_${Date.now()}`,
          date: now,
          title: 'Projet initialisé',
          description: `Création du projet "${data.title}" pour le client ${client ? client.company : ''}`,
          type: 'brief',
          authorName: profile.name
        }
      ],
      createdAt: now,
      updatedAt: now
    };

    saveProjects([newProject, ...projects]);

    // Persistance asynchrone Firestore
    firestoreSetDoc(firestoreDoc(db, 'projects', newProject.id), {
      ...newProject,
      ownerId: auth.uid || currentWorkspace.ownerId,
      workspaceId: currentWorkspace.id
    }).catch(err => console.warn('[Firestore] Project write notice:', err));

    return newProject;
  };

  const updateProject = (id: string, updates: Partial<Project>) => {
    const updatedList = projects.map(p => {
      if (p.id !== id) return p;
      const merged = { ...p, ...updates, updatedAt: new Date().toISOString() };
      if (updates.lines && updates.lines.length > 0) {
        const subtotal = updates.lines.reduce((sum, l) => sum + (l.unitPrice * l.quantity), 0);
        const discountPct = updates.discountPercent ?? merged.discountPercent ?? 0;
        const discountAmt = Math.round(subtotal * (discountPct / 100));
        const net = subtotal - discountAmt;
        const vat = Math.round(updates.lines.reduce((sum, l) => sum + ((l.unitPrice * l.quantity) * (l.vatRate / 100)), 0) * (1 - discountPct / 100));
        const ttc = net + vat;
        merged.subtotalHT = subtotal;
        merged.vatAmount = vat;
        merged.totalTTC = ttc;
        merged.budget = ttc;
        const depPct = updates.depositPercent ?? merged.depositPercent ?? 50;
        merged.depositAmount = Math.round(ttc * (depPct / 100));
      }
      return merged;
    });
    saveProjects(updatedList);
    const updated = updatedList.find(p => p.id === id);
    if (updated) {
      firestoreSetDoc(firestoreDoc(db, 'projects', id), updated, { merge: true }).catch(() => {});
    }
  };

  const deleteProject = (id: string) => {
    const check = canDeleteProject(id);
    if (!check.allowed) {
      console.warn(`[Integrity] Suppression refusée pour le projet ${id}:`, check.reason);
      return false;
    }
    saveProjects(projects.filter(p => p.id !== id));
    firestoreDeleteDoc(firestoreDoc(db, 'projects', id)).catch(() => {});
    return true;
  };

  const updateProjectStep = (id: string, newStep: ProjectStepKey) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;
    if (project.currentStep === newStep) return;

    const now = new Date().toISOString();
    const newActivity: ActivityLog = {
      id: `act_${Date.now()}`,
      date: now,
      title: `Étape changée : ${newStep}`,
      description: `Transition vers "${newStep}"`,
      type: 'status_change',
      authorName: profile.name
    };

    saveProjects(
      projects.map(p =>
        p.id === id
          ? {
              ...p,
              currentStep: newStep,
              updatedAt: now,
              activity: [newActivity, ...p.activity]
            }
          : p
      )
    );
  };

  const getProjectById = (id: string) => projects.find(p => p.id === id);
  const getProjectByShareToken = (token: string) => projects.find(p => p.clientShareToken === token && p.clientLinkActive);

  const regenerateShareToken = (projectId: string): string => {
    const project = projects.find(p => p.id === projectId);
    const client = project ? clients.find(c => c.id === project.clientId) : undefined;
    const clientPrefix = client ? client.company.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 4) : 'cli';
    const newToken = `${clientPrefix}-${Math.random().toString(36).substring(2, 9)}-${Math.random().toString(36).substring(2, 8)}`;
    
    updateProject(projectId, { clientShareToken: newToken });
    return newToken;
  };

  const toggleShareLinkActive = (projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (project) {
      updateProject(projectId, { clientLinkActive: !project.clientLinkActive });
    }
  };

  const archiveProject = (projectId: string) => {
    updateProject(projectId, { isArchived: true });
    addActivity(projectId, {
      title: 'Projet archivé',
      description: 'Le dossier a été clôturé et placé dans les archives du studio.',
      type: 'status_change',
      authorName: profile.name
    });
  };

  // Task actions
  const addTask = (projectId: string, title: string, dueDate?: string) => {
    const newTask: ProjectTask = {
      id: `t_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      title,
      dueDate,
      completed: false
    };

    const now = new Date().toISOString();
    saveProjects(
      projects.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          tasks: [...p.tasks, newTask],
          updatedAt: now,
          activity: [
            {
              id: `act_${Date.now()}`,
              date: now,
              title: `Nouvelle tâche ajoutée`,
              description: `"${title}"`,
              type: 'task',
              authorName: profile.name
            },
            ...p.activity
          ]
        };
      })
    );
  };

  const toggleTask = (projectId: string, taskId: string) => {
    const now = new Date().toISOString();
    saveProjects(
      projects.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          tasks: p.tasks.map(t =>
            t.id === taskId
              ? { ...t, completed: !t.completed, completedAt: !t.completed ? now : undefined }
              : t
          ),
          updatedAt: now
        };
      })
    );
  };

  const deleteTask = (projectId: string, taskId: string) => {
    saveProjects(
      projects.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          tasks: p.tasks.filter(t => t.id !== taskId),
          updatedAt: new Date().toISOString()
        };
      })
    );
  };

  // Activity actions
  const addActivity = (projectId: string, act: Omit<ActivityLog, 'id' | 'date'>) => {
    const newLog: ActivityLog = {
      ...act,
      id: `act_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      date: new Date().toISOString(),
      authorName: act.authorName || profile.name
    };
    saveProjects(
      projects.map(p => {
        if (p.id !== projectId) return p;
        return {
          ...p,
          activity: [newLog, ...p.activity],
          updatedAt: new Date().toISOString()
        };
      })
    );
  };

  // =========================================================================
  // Mockup & Versioning Actions
  // =========================================================================

  const addMockupRound = (projectId: string, title: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const roundNumber = project.mockupRounds.length + 1;
    const newRound: MockupRound = {
      id: `round_${Date.now()}`,
      roundNumber,
      title: title || `Tour ${roundNumber}`,
      status: 'pending_client',
      versions: [],
      createdAt: new Date().toISOString()
    };

    updateProject(projectId, {
      mockupRounds: [...project.mockupRounds, newRound]
    });

    addActivity(projectId, {
      title: `Nouveau tour de validation (${newRound.title}) créé`,
      description: 'Préparation des pistes de maquettes pour soumission client',
      type: 'status_change',
      authorName: profile.name
    });
  };

  const addMockupVersion = (
    projectId: string, 
    roundId: string, 
    data: Omit<MockupVersion, 'id' | 'versionNumber' | 'createdAt' | 'pinComments' | 'generalComments'>
  ) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const targetRound = project.mockupRounds.find(r => r.id === roundId);
    const versionNumber = (targetRound ? targetRound.versions.length : 0) + 1;

    const newVersion: MockupVersion = {
      ...data,
      id: `ver_${Date.now()}`,
      versionNumber,
      createdAt: new Date().toISOString(),
      pinComments: [],
      generalComments: []
    };

    const updatedRounds = project.mockupRounds.map(r => {
      if (r.id !== roundId) return r;
      return {
        ...r,
        status: 'pending_client' as const,
        versions: [...r.versions, newVersion]
      };
    });

    updateProject(projectId, {
      mockupRounds: updatedRounds,
      coverImageUrl: data.fileUrl || project.coverImageUrl
    });

    addActivity(projectId, {
      title: `Nouvelle maquette V${versionNumber} téléversée`,
      description: `${data.title} (${data.fileName})`,
      type: 'file',
      authorName: profile.name
    });
  };

  const addPinComment = (
    projectId: string, 
    roundId: string, 
    versionId: string, 
    comment: Omit<MockupPinComment, 'id' | 'pinNumber' | 'createdAt'>
  ) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    let pinNumber = 1;
    const updatedRounds = project.mockupRounds.map(r => {
      if (r.id !== roundId) return r;
      return {
        ...r,
        versions: r.versions.map(v => {
          if (v.id !== versionId) return v;
          pinNumber = v.pinComments.length + 1;
          const newPin: MockupPinComment = {
            ...comment,
            id: `pin_${Date.now()}`,
            pinNumber,
            createdAt: new Date().toISOString()
          };
          return {
            ...v,
            pinComments: [...v.pinComments, newPin]
          };
        })
      };
    });

    updateProject(projectId, { mockupRounds: updatedRounds });

    addNotification({
      type: 'mockup_comment',
      title: 'Nouveau commentaire épinglé',
      message: `${comment.author} a annoté le point #${pinNumber} sur la maquette`,
      linkProjectId: projectId,
      linkTab: 'mockups'
    });

    addActivity(projectId, {
      title: `Annotation #${pinNumber} ajoutée sur la maquette`,
      description: `"${comment.content}"`,
      type: 'comment',
      authorName: comment.author
    });
  };

  const addGeneralComment = (projectId: string, roundId: string, versionId: string, author: string, content: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newComment = {
      id: `gc_${Date.now()}`,
      author,
      content,
      createdAt: new Date().toISOString()
    };

    const updatedRounds = project.mockupRounds.map(r => {
      if (r.id !== roundId) return r;
      return {
        ...r,
        versions: r.versions.map(v => {
          if (v.id !== versionId) return v;
          return {
            ...v,
            generalComments: [...v.generalComments, newComment]
          };
        })
      };
    });

    updateProject(projectId, { mockupRounds: updatedRounds });
  };

  const validateMockupRound = (projectId: string, roundId: string, clientName: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const now = new Date().toISOString();
    const updatedRounds = project.mockupRounds.map(r => {
      if (r.id !== roundId) return r;
      return {
        ...r,
        status: 'validated' as const,
        validatedAt: now
      };
    });

    updateProject(projectId, {
      mockupRounds: updatedRounds,
      currentStep: 'validation_finale'
    });

    addNotification({
      type: 'mockup_validated',
      title: 'Maquette validée par le client',
      message: `${clientName} a approuvé la version actuelle. Passage à la validation finale.`,
      linkProjectId: projectId,
      linkTab: 'mockups'
    });

    addActivity(projectId, {
      title: 'Validation de maquette approuvée',
      description: `${clientName} a définitivement approuvé le tour de validation.`,
      type: 'status_change',
      authorName: clientName
    });
  };

  const requestMockupChanges = (projectId: string, roundId: string, feedback: string, clientName: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const nextRevisionsUsed = project.revisionsUsed + 1;
    const updatedRounds = project.mockupRounds.map(r => {
      if (r.id !== roundId) return r;
      return {
        ...r,
        status: 'changes_requested' as const,
        feedbackMessage: feedback
      };
    });

    updateProject(projectId, {
      mockupRounds: updatedRounds,
      revisionsUsed: nextRevisionsUsed,
      currentStep: 'revisions'
    });

    addNotification({
      type: 'mockup_changes_requested',
      title: 'Modifications demandées sur la maquette',
      message: `${clientName} : "${feedback.slice(0, 80)}${feedback.length > 80 ? '...' : ''}"`,
      linkProjectId: projectId,
      linkTab: 'mockups'
    });

    addActivity(projectId, {
      title: `Retouches demandées (Cycle ${nextRevisionsUsed}/${project.revisionLimit})`,
      description: feedback,
      type: 'comment',
      authorName: clientName
    });
  };

  const addPaidRevision = (projectId: string, cost: number) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    updateProject(projectId, {
      revisionLimit: project.revisionLimit + 1,
      paidRevisionsAdded: project.paidRevisionsAdded + 1,
      budget: project.budget + cost
    });

    addActivity(projectId, {
      title: `Révision payante supplémentaire (+${cost} €) ajoutée`,
      description: `Nouvelle limite de retouches portée à ${project.revisionLimit + 1}`,
      type: 'quote',
      authorName: profile.name
    });
  };

  // =========================================================================
  // File Storage Actions
  // =========================================================================

  const uploadProjectFile = (projectId: string, fileData: Omit<ProjectFile, 'id' | 'uploadedAt'>) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newFile: ProjectFile = {
      ...fileData,
      id: `file_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      uploadedAt: new Date().toISOString()
    };

    updateProject(projectId, {
      files: [...project.files, newFile]
    });

    addActivity(projectId, {
      title: `Fichier déposé : ${fileData.name}`,
      description: `Catégorie : ${fileData.category} (${fileData.formattedSize})`,
      type: 'file',
      authorName: fileData.uploadedBy === 'client' ? 'Client' : profile.name
    });

    if (fileData.uploadedBy === 'client') {
      addNotification({
        type: 'client_file_uploaded',
        title: 'Fichier client reçu',
        message: `${fileData.name} (${fileData.formattedSize}) déposé sur l’espace projet.`,
        linkProjectId: projectId,
        linkTab: 'files'
      });
    }
  };

  const deleteProjectFile = (projectId: string, fileId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    updateProject(projectId, {
      files: project.files.filter(f => f.id !== fileId)
    });
  };

  // =========================================================================
  // Quotes Actions
  // =========================================================================

  const addQuote = (quoteData: Omit<Quote, 'id' | 'quoteNumber' | 'createdAt'>): Quote => {
    // Respecter la limite du plan (devis / mois)
    if (!entitlements.canCreateQuote) {
      console.warn(`[Quota Devis] ${entitlements.reasonBlocked || 'Limite mensuelle de devis atteinte.'}`);
    }

    const existingNumbers = quotes.map(q => q.quoteNumber);
    const quoteNumber = generateNextDocumentNumber(existingNumbers, 'DEV', new Date().getFullYear(), profile.quotePrefix);

    // Module financier unifié
    const totals = calculateDocumentTotals(quoteData.lines, {
      discountPercent: quoteData.discountPercent,
      defaultVatRate: quoteData.vatRate !== undefined ? quoteData.vatRate : profile.vatRate,
      depositPercent: quoteData.depositPercent,
      depositCalculation: profile.depositCalculation,
      currency: profile.currency
    });

    const projectQuotes = quotes.filter(q => q.projectId === quoteData.projectId);
    const version = quoteData.version || (projectQuotes.length + 1);
    const status = quoteData.status || 'draft'; // Statut Brouillon par défaut dès la création

    const newQuote: Quote = {
      ...quoteData,
      workspaceId: currentWorkspace.id,
      id: `quote_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      quoteNumber,
      version,
      status,
      isLocked: status === 'accepted',
      subtotal: totals.subtotalHT,
      discountPercent: totals.discountPercent,
      discountAmount: totals.discountAmount,
      netHT: totals.netHT,
      vatRate: totals.vatRate,
      vatAmount: totals.vatAmount,
      totalTTC: totals.totalTTC,
      depositPercent: totals.depositPercent,
      depositAmount: totals.depositAmount,
      createdAt: new Date().toISOString()
    };

    saveQuotes([newQuote, ...quotes]);
    firestoreSetDoc(firestoreDoc(db, 'quotes', newQuote.id), newQuote).catch(() => {});

    addActivity(quoteData.projectId, {
      title: `Devis ${quoteNumber} (${version > 1 ? `V${version} · ` : ''}${status === 'draft' ? 'Brouillon' : 'Émis'})`,
      description: `Montant : ${totals.totalTTC} ${profile.currency || '€'} TTC (${quoteData.lines.length} prestations)`,
      type: 'quote',
      authorName: profile.name
    });

    return newQuote;
  };

  const updateQuote = (id: string, updates: Partial<Quote>) => {
    const existing = quotes.find(q => q.id === id);
    if (!existing) return;

    if (existing.isLocked || existing.status === 'accepted') {
      console.warn("Un devis accepté est verrouillé. Pour apporter des modifications, veuillez créer une nouvelle version.");
      return;
    }

    let calculatedUpdates = { ...updates };
    if (updates.lines || updates.discountPercent !== undefined || updates.vatRate !== undefined || updates.depositPercent !== undefined) {
      const linesToCalc = updates.lines || existing.lines;
      const totals = calculateDocumentTotals(linesToCalc, {
        discountPercent: updates.discountPercent !== undefined ? updates.discountPercent : existing.discountPercent,
        defaultVatRate: updates.vatRate !== undefined ? updates.vatRate : existing.vatRate,
        depositPercent: updates.depositPercent !== undefined ? updates.depositPercent : existing.depositPercent,
        depositCalculation: profile.depositCalculation,
        currency: profile.currency
      });

      calculatedUpdates = {
        ...calculatedUpdates,
        subtotal: totals.subtotalHT,
        discountPercent: totals.discountPercent,
        discountAmount: totals.discountAmount,
        netHT: totals.netHT,
        vatRate: totals.vatRate,
        vatAmount: totals.vatAmount,
        totalTTC: totals.totalTTC,
        depositPercent: totals.depositPercent,
        depositAmount: totals.depositAmount
      };
    }

    const updatedQuote = { ...existing, ...calculatedUpdates };
    saveQuotes(quotes.map(q => (q.id === id ? updatedQuote : q)));
    firestoreSetDoc(firestoreDoc(db, 'quotes', id), updatedQuote).catch(() => {});
  };

  const deleteQuote = (id: string) => {
    const existing = quotes.find(q => q.id === id);
    if (existing && existing.status === 'accepted') {
      console.warn("Impossible de supprimer un devis accepté et validé.");
      return;
    }
    saveQuotes(quotes.filter(q => q.id !== id));
    firestoreDeleteDoc(firestoreDoc(db, 'quotes', id)).catch(() => {});
  };

  const duplicateQuote = (id: string): Quote => {
    const original = quotes.find(q => q.id === id);
    if (!original) throw new Error('Devis introuvable');

    return addQuote({
      ...original,
      status: 'draft',
      isLocked: false,
      acceptedAt: undefined,
      acceptedByName: undefined,
      refusedAt: undefined,
      refusalReason: undefined
    });
  };

  const createQuoteVersion = (quoteId: string): Quote => {
    const original = quotes.find(q => q.id === quoteId);
    if (!original) throw new Error('Devis introuvable');

    const projectQuotes = quotes.filter(q => q.projectId === original.projectId);
    const highestVer = Math.max(...projectQuotes.map(q => q.version || 1), 1);
    const nextVer = highestVer + 1;

    const existingNumbers = quotes.map(q => q.quoteNumber);
    const quoteNumber = generateNextDocumentNumber(existingNumbers, 'DEV', new Date().getFullYear(), profile.quotePrefix);

    const versionQuote: Quote = {
      ...original,
      id: `quote_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      quoteNumber,
      version: nextVer,
      parentQuoteId: original.id,
      status: 'draft',
      isLocked: false,
      acceptedAt: undefined,
      acceptedByName: undefined,
      refusedAt: undefined,
      refusalReason: undefined,
      createdAt: new Date().toISOString()
    };

    saveQuotes([versionQuote, ...quotes]);
    firestoreSetDoc(firestoreDoc(db, 'quotes', versionQuote.id), versionQuote).catch(() => {});

    addActivity(original.projectId, {
      title: `Nouvelle version devis : ${quoteNumber} (V${nextVer})`,
      description: `Créée à partir de la version précédente ${original.quoteNumber}`,
      type: 'quote',
      authorName: profile.name
    });

    return versionQuote;
  };

  const acceptQuote = (quoteId: string, acceptedByName: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) return;

    const now = new Date().toISOString();

    // Règle métier : pour un même projet, un seul devis peut être accepté.
    // Toute autre version pour ce projet est expirée ou neutralisée.
    const updatedQuotes = quotes.map(q => {
      if (q.id === quoteId) {
        return {
          ...q,
          status: 'accepted' as QuoteStatus,
          isLocked: true,
          acceptedAt: now,
          acceptedByName
        };
      }
      if (q.projectId === quote.projectId && q.status === 'accepted') {
        return {
          ...q,
          status: 'expired' as QuoteStatus,
          isLocked: true
        };
      }
      return q;
    });

    saveQuotes(updatedQuotes);
    firestoreSetDoc(firestoreDoc(db, 'quotes', quoteId), {
      status: 'accepted',
      isLocked: true,
      acceptedAt: now,
      acceptedByName
    }, { merge: true }).catch(() => {});

    // Synchronisation du projet : avance à "devis_accepte" et synchronise budget et lignes
    const project = projects.find(p => p.id === quote.projectId);
    if (project) {
      updateProject(project.id, {
        budget: quote.totalTTC,
        subtotalHT: quote.subtotal,
        vatAmount: quote.vatAmount,
        totalTTC: quote.totalTTC,
        depositAmount: quote.depositAmount,
        depositPercent: quote.depositPercent,
        discountPercent: quote.discountPercent
      });
      updateProjectStep(quote.projectId, 'devis_accepte');
    }

    addNotification({
      type: 'quote_accepted',
      title: `Devis ${quote.quoteNumber} accepté en ligne`,
      message: `${acceptedByName} a signé électroniquement le devis de ${quote.totalTTC} ${profile.currency || '€'} TTC. La facture d'acompte peut être émise.`,
      linkProjectId: quote.projectId,
      linkTab: 'quotes'
    });

    addActivity(quote.projectId, {
      title: `Devis ${quote.quoteNumber} accepté par ${acceptedByName}`,
      description: `Statut passé à "Devis accepté". Bouton facture d'acompte disponible.`,
      type: 'quote',
      authorName: acceptedByName
    });
  };

  const refuseQuote = (quoteId: string, reason: string) => {
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) return;

    const now = new Date().toISOString();
    updateQuote(quoteId, {
      status: 'refused',
      refusedAt: now,
      refusalReason: reason
    });

    addNotification({
      type: 'quote_refused',
      title: `Devis ${quote.quoteNumber} refusé`,
      message: `Motif : "${reason}"`,
      linkProjectId: quote.projectId,
      linkTab: 'quotes'
    });

    addActivity(quote.projectId, {
      title: `Devis ${quote.quoteNumber} refusé par le client`,
      description: `Motif : ${reason}`,
      type: 'quote',
      authorName: 'Client'
    });
  };

  const getQuotesByProjectId = (projectId: string) => quotes.filter(q => q.projectId === projectId);

  // =========================================================================
  // Invoices & Payments Actions (Conformité Fiscale & Immuabilité)
  // =========================================================================

  const addInvoice = (invoiceData: Omit<Invoice, 'id' | 'invoiceNumber' | 'createdAt' | 'paidAmount' | 'balanceDue' | 'payments'>): Invoice => {
    const existingNumbers = invoices.map(i => i.invoiceNumber);
    const invoiceNumber = generateNextDocumentNumber(existingNumbers, 'FAC', new Date().getFullYear(), profile.invoicePrefix);

    const totals = calculateDocumentTotals(invoiceData.lines, {
      discountPercent: invoiceData.discountPercent,
      defaultVatRate: invoiceData.vatRate !== undefined ? invoiceData.vatRate : profile.vatRate,
      depositPercent: 50,
      currency: profile.currency
    });

    const status = invoiceData.status || 'sent';
    // Règle fiscale : dès qu'une facture est émise (non draft), elle est scellée / inaltérable
    const isLocked = status !== 'draft';

    const newInvoice: Invoice = {
      ...invoiceData,
      workspaceId: currentWorkspace.id,
      id: `inv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      invoiceNumber,
      subtotal: totals.subtotalHT,
      discountPercent: totals.discountPercent,
      discountAmount: totals.discountAmount,
      netHT: totals.netHT,
      vatRate: totals.vatRate,
      vatAmount: totals.vatAmount,
      totalTTC: totals.totalTTC,
      paidAmount: 0,
      balanceDue: totals.totalTTC,
      payments: [],
      status,
      isLocked,
      devisId: invoiceData.devisId || invoiceData.quoteId,
      createdAt: new Date().toISOString()
    };

    saveInvoices([newInvoice, ...invoices]);
    firestoreSetDoc(firestoreDoc(db, 'invoices', newInvoice.id), newInvoice).catch(() => {});

    addActivity(invoiceData.projectId, {
      title: `Facture ${invoiceNumber} émise`,
      description: `Type : ${invoiceData.type === 'deposit' ? 'Acompte' : invoiceData.type === 'balance' ? 'Solde' : invoiceData.type === 'additional' ? 'Prestations sup.' : 'Complète'} · Total : ${totals.totalTTC} ${profile.currency || '€'} TTC`,
      type: 'invoice',
      authorName: profile.name
    });

    return newInvoice;
  };

  const createInvoiceFromQuote = (quoteId: string, type: 'deposit' | 'balance' | 'full'): Invoice => {
    const quote = quotes.find(q => q.id === quoteId);
    if (!quote) throw new Error('Devis introuvable');

    const projectInvoices = invoices.filter(i => (i.quoteId === quoteId || i.devisId === quoteId) && !i.isCancelled);
    let lines: QuoteLine[] = [];
    let subtotal = 0;
    let totalTTC = 0;
    const vatRate = quote.vatRate !== undefined ? quote.vatRate : (profile.vatRate ?? 20);

    if (type === 'deposit') {
      const depositPct = quote.depositPercent || 50;
      const isDepositOnHT = profile.depositCalculation === 'ht';

      if (isDepositOnHT) {
        subtotal = Math.round(quote.subtotal * (depositPct / 100));
        const vatAmt = Math.round(subtotal * (vatRate / 100));
        totalTTC = subtotal + vatAmt;
      } else {
        totalTTC = Math.round(quote.totalTTC * (depositPct / 100));
        subtotal = Math.round(totalTTC / (1 + (vatRate / 100)));
      }

      lines = [
        {
          id: `line_dep_${Date.now()}`,
          designation: `Facture d'acompte (${depositPct}%) — Devis ${quote.quoteNumber}`,
          description: `Règlement initial pour le démarrage des travaux créatifs.`,
          quantity: 1,
          unitPrice: subtotal,
          vatRate,
          total: subtotal
        }
      ];
    } else if (type === 'balance') {
      const alreadyInvoicedTTC = projectInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);
      totalTTC = Math.max(0, quote.totalTTC - alreadyInvoicedTTC);
      subtotal = Math.round(totalTTC / (1 + (vatRate / 100)));

      lines = [
        {
          id: `line_bal_${Date.now()}`,
          designation: `Facture de solde — Devis ${quote.quoteNumber}`,
          description: `Règlement final du solde pour la remise des livrables définitifs.`,
          quantity: 1,
          unitPrice: subtotal,
          vatRate,
          total: subtotal
        }
      ];
    } else {
      lines = quote.lines.map(l => ({
        ...l,
        id: `line_f_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`
      }));
      subtotal = quote.subtotal;
      totalTTC = quote.totalTTC;
    }

    const vatAmount = Math.max(0, totalTTC - subtotal);
    const d = new Date();
    d.setDate(d.getDate() + 15);
    const dueDate = d.toISOString();

    return addInvoice({
      type,
      quoteId: quote.id,
      devisId: quote.id,
      projectId: quote.projectId,
      clientId: quote.clientId,
      dueDate,
      lines,
      subtotal,
      vatRate,
      vatAmount,
      totalTTC,
      status: 'sent',
      legalNotice: profile.legalNotice || 'TVA non applicable, art. 293 B du CGI'
    });
  };

  const canModifyInvoice = (invoiceId: string): { allowed: boolean; reason?: string } => {
    const inv = invoices.find(i => i.id === invoiceId);
    if (!inv) return { allowed: false, reason: 'Facture introuvable' };
    if (inv.status === 'draft') return { allowed: true };
    return {
      allowed: false,
      reason: "Conformité fiscale : Une facture émise ne peut être ni modifiée ni supprimée. Vous devez procéder par annulation avec facture rectificative ou avoir."
    };
  };

  const updateInvoice = (id: string, updates: Partial<Invoice>) => {
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;
    if (inv.status !== 'draft' && inv.isLocked) {
      console.warn("Conformité fiscale : modification interdite sur une facture déjà émise.");
      return;
    }
    const updated = { ...inv, ...updates };
    saveInvoices(invoices.map(i => (i.id === id ? updated : i)));
    firestoreSetDoc(firestoreDoc(db, 'invoices', id), updated).catch(() => {});
  };

  const deleteInvoice = (id: string) => {
    const inv = invoices.find(i => i.id === id);
    if (!inv) return;
    if (inv.status !== 'draft') {
      console.warn("Conformité fiscale : suppression interdite sur une facture émise. Utilisez l'annulation avec avoir.");
      return;
    }
    saveInvoices(invoices.filter(i => i.id !== id));
    firestoreDeleteDoc(firestoreDoc(db, 'invoices', id)).catch(() => {});
  };

  const cancelInvoiceWithCreditNote = (invoiceId: string, reason?: string): { cancelledInvoice: Invoice; creditNote: Invoice } => {
    const invoice = invoices.find(i => i.id === invoiceId);
    if (!invoice) throw new Error('Facture introuvable');

    const now = new Date().toISOString();
    const cancellationReason = reason || 'Annulation légale & émission d’un avoir rectificatif';

    const cancelledInvoice: Invoice = {
      ...invoice,
      status: 'cancelled',
      isCancelled: true,
      cancelledAt: now,
      cancellationReason
    };

    const existingNumbers = invoices.map(i => i.invoiceNumber);
    const creditNoteNumber = generateNextDocumentNumber(existingNumbers, 'FAC', new Date().getFullYear(), profile.invoicePrefix);

    const creditNote: Invoice = {
      id: `inv_cn_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      workspaceId: currentWorkspace.id,
      invoiceNumber: creditNoteNumber,
      type: 'credit_note',
      quoteId: invoice.quoteId,
      devisId: invoice.devisId,
      projectId: invoice.projectId,
      clientId: invoice.clientId,
      createdAt: now,
      dueDate: now,
      lines: invoice.lines.map(l => ({
        ...l,
        id: `line_cn_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
        designation: `Avoir sur ${invoice.invoiceNumber} — ${l.designation}`,
        total: -Math.abs(l.total)
      })),
      subtotal: -Math.abs(invoice.subtotal),
      discountPercent: invoice.discountPercent,
      discountAmount: invoice.discountAmount ? -Math.abs(invoice.discountAmount) : 0,
      netHT: invoice.netHT ? -Math.abs(invoice.netHT) : -Math.abs(invoice.subtotal),
      vatRate: invoice.vatRate,
      vatAmount: -Math.abs(invoice.vatAmount),
      totalTTC: -Math.abs(invoice.totalTTC),
      paidAmount: 0,
      balanceDue: 0,
      status: 'paid',
      isLocked: true,
      isCreditNote: true,
      originalInvoiceNumber: invoice.invoiceNumber,
      legalNotice: profile.legalNotice,
      payments: []
    };

    const updatedInvoices = [creditNote, ...invoices.map(i => (i.id === invoiceId ? cancelledInvoice : i))];
    saveInvoices(updatedInvoices);

    firestoreSetDoc(firestoreDoc(db, 'invoices', cancelledInvoice.id), cancelledInvoice).catch(() => {});
    firestoreSetDoc(firestoreDoc(db, 'invoices', creditNote.id), creditNote).catch(() => {});

    addActivity(invoice.projectId, {
      title: `Facture ${invoice.invoiceNumber} annulée`,
      description: `Avoir ${creditNoteNumber} émis. Motif : ${cancellationReason}`,
      type: 'invoice',
      authorName: profile.name
    });

    addNotification({
      type: 'system',
      title: `Avoir ${creditNoteNumber} émis`,
      message: `La facture ${invoice.invoiceNumber} a été annulée conformément aux règles fiscales.`,
      linkProjectId: invoice.projectId,
      linkTab: 'invoices'
    });

    return { cancelledInvoice, creditNote };
  };

  const recordPayment = (invoiceId: string, paymentData: Omit<PaymentRecord, 'id' | 'invoiceId' | 'recordedBy'>) => {
    const invoice = invoices.find(inv => inv.id === invoiceId);
    if (!invoice) return;

    const newPayment: PaymentRecord = {
      ...paymentData,
      id: `pay_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      invoiceId,
      recordedBy: profile.name
    };

    const newPaidAmount = invoice.paidAmount + paymentData.amount;
    const newBalanceDue = Math.max(0, invoice.totalTTC - newPaidAmount);
    const newStatus: InvoiceStatus = newBalanceDue <= 0 ? 'paid' : 'partially_paid';

    const updatedInvoice: Invoice = {
      ...invoice,
      paidAmount: newPaidAmount,
      balanceDue: newBalanceDue,
      status: newStatus,
      payments: [...invoice.payments, newPayment]
    };

    saveInvoices(invoices.map(inv => (inv.id === invoiceId ? updatedInvoice : inv)));
    firestoreSetDoc(firestoreDoc(db, 'invoices', invoiceId), updatedInvoice).catch(() => {});

    // Mise à jour de l'avancement financier et livrables du projet
    const project = projects.find(p => p.id === invoice.projectId);
    if (project) {
      const updatedProjectPaid = project.paidAmount + paymentData.amount;
      updateProject(project.id, { paidAmount: updatedProjectPaid });

      // Si acompte payé => étape "acompte_recu"
      if (invoice.type === 'deposit' && newStatus === 'paid' && project.currentStep === 'devis_accepte') {
        updateProjectStep(project.id, 'acompte_recu');
      }

      // Si solde ou facture complète payée => solde reçu et déverrouillage livraison automatique si configuré
      const projectAllInvoices = invoices.map(i => i.id === invoiceId ? updatedInvoice : i).filter(i => i.projectId === project.id && !i.isCancelled);
      const totalInvoicedTTC = projectAllInvoices.reduce((sum, inv) => sum + inv.totalTTC, 0);
      const totalPaidTTC = projectAllInvoices.reduce((sum, inv) => sum + inv.paidAmount, 0);

      const isFullyPaid = totalPaidTTC >= project.budget || (totalInvoicedTTC >= project.budget && totalPaidTTC >= totalInvoicedTTC);
      if ((invoice.type === 'balance' || invoice.type === 'full') && isFullyPaid) {
        if (project.currentStep === 'validation_finale' || project.currentStep === 'devis_accepte' || project.currentStep === 'acompte_recu') {
          updateProjectStep(project.id, 'solde_recu');
        }
        // Déverrouillage automatique de la livraison selon réglage
        if (project.delivery.mode === 'auto') {
          updateDeliveryConfig(project.id, { isUnlocked: true, unlockedAt: new Date().toISOString() });
        }
      }
    }

    addNotification({
      type: 'invoice_paid',
      title: `Paiement enregistré sur ${invoice.invoiceNumber}`,
      message: `${paymentData.amount} ${profile.currency || '€'} reçus par ${paymentData.method}. Solde restant : ${newBalanceDue} ${profile.currency || '€'}.`,
      linkProjectId: invoice.projectId,
      linkTab: 'invoices'
    });

    addActivity(invoice.projectId, {
      title: `Paiement de ${paymentData.amount} ${profile.currency || '€'} enregistré`,
      description: `Règlement par ${paymentData.method} pour ${invoice.invoiceNumber}. Statut : ${newStatus === 'paid' ? 'Payée intégralement' : 'Partiel'}`,
      type: 'invoice',
      authorName: profile.name
    });
  };

  const getInvoicesByProjectId = (projectId: string) => invoices.filter(inv => inv.projectId === projectId);

  // =========================================================================
  // Delivery & Review Actions
  // =========================================================================

  const updateDeliveryConfig = (projectId: string, updates: Partial<DeliveryConfig>) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    updateProject(projectId, {
      delivery: { ...project.delivery, ...updates }
    });
  };

  const unlockDeliveryManually = (projectId: string) => {
    updateDeliveryConfig(projectId, {
      isUnlocked: true,
      unlockedAt: new Date().toISOString()
    });

    addActivity(projectId, {
      title: 'Livrables finaux débloqués manuellement',
      description: 'L’accès aux fichiers sources est à présent ouvert sur l’espace client.',
      type: 'delivery',
      authorName: profile.name
    });
  };

  const submitProjectReview = (projectId: string, reviewData: Omit<ProjectReview, 'id' | 'createdAt'>) => {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;

    const newReview: ProjectReview = {
      ...reviewData,
      id: `rev_${Date.now()}`,
      createdAt: new Date().toISOString()
    };

    const existingReviews = project.reviews || [];
    updateProject(projectId, {
      reviews: [...existingReviews, newReview],
      currentStep: 'livre'
    });

    addNotification({
      type: 'mockup_validated',
      title: `Nouvel avis client (${reviewData.rating}/5)`,
      message: `${reviewData.clientName} (${reviewData.clientCompany}) : "${reviewData.comment.slice(0, 80)}"`,
      linkProjectId: projectId,
      linkTab: 'delivery'
    });

    addActivity(projectId, {
      title: `Avis client ${reviewData.rating}/5 étoiles reçu`,
      description: `"${reviewData.comment}"`,
      type: 'delivery',
      authorName: reviewData.clientName
    });
  };

  // Client Portal link & preview mode
  const [activeClientPortalToken, setActiveClientPortalToken] = useState<string | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('clientToken') || null;
  });

  const [isClientPortalPreview, setIsClientPortalPreview] = useState<boolean>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('preview') === 'true';
  });

  const openClientPortal = (token: string, isPreview: boolean = false) => {
    setActiveClientPortalToken(token);
    setIsClientPortalPreview(isPreview);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.set('clientToken', token);
    if (isPreview) {
      newUrl.searchParams.set('preview', 'true');
    } else {
      newUrl.searchParams.delete('preview');
    }
    window.history.pushState({}, '', newUrl.toString());
  };

  const closeClientPortal = () => {
    setActiveClientPortalToken(null);
    setIsClientPortalPreview(false);
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('clientToken');
    newUrl.searchParams.delete('preview');
    window.history.pushState({}, '', newUrl.toString());
  };

  // Stage 3 State Implementations
  // 1. Appointments
  const [appointments, setAppointments] = useState<ClientAppointment[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.APPOINTMENTS);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_APPOINTMENTS;
  });

  const saveAppointments = (next: ClientAppointment[]) => {
    setAppointments(next);
    localStorage.setItem(STORAGE_KEYS.APPOINTMENTS, JSON.stringify(next));
  };

  const addAppointment = (aptData: Omit<ClientAppointment, 'id'>): ClientAppointment => {
    const newApt: ClientAppointment = {
      ...aptData,
      id: `apt_${Date.now()}`
    };
    saveAppointments([newApt, ...appointments]);
    return newApt;
  };

  const deleteAppointment = (id: string) => {
    saveAppointments(appointments.filter(a => a.id !== id));
  };

  // 2. Time Entries
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.TIME_ENTRIES);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_TIME_ENTRIES;
  });

  const saveTimeEntries = (next: TimeEntry[]) => {
    setTimeEntries(next);
    localStorage.setItem(STORAGE_KEYS.TIME_ENTRIES, JSON.stringify(next));
  };

  const addTimeEntry = (entryData: Omit<TimeEntry, 'id'>): TimeEntry => {
    const newEntry: TimeEntry = {
      ...entryData,
      id: `time_${Date.now()}`
    };
    saveTimeEntries([newEntry, ...timeEntries]);
    return newEntry;
  };

  const deleteTimeEntry = (id: string) => {
    saveTimeEntries(timeEntries.filter(t => t.id !== id));
  };

  // 3. Expenses
  const [expenses, setExpenses] = useState<ProjectExpense[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EXPENSES);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_EXPENSES;
  });

  const saveExpenses = (next: ProjectExpense[]) => {
    setExpenses(next);
    localStorage.setItem(STORAGE_KEYS.EXPENSES, JSON.stringify(next));
  };

  const addExpense = (expData: Omit<ProjectExpense, 'id'>): ProjectExpense => {
    const newExp: ProjectExpense = {
      ...expData,
      id: `exp_${Date.now()}`
    };
    saveExpenses([newExp, ...expenses]);
    return newExp;
  };

  const deleteExpense = (id: string) => {
    saveExpenses(expenses.filter(e => e.id !== id));
  };

  // 4. Leads
  const [leads, setLeads] = useState<PublicLeadSubmission[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.LEADS);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_LEADS;
  });

  const saveLeads = (next: PublicLeadSubmission[]) => {
    setLeads(next);
    localStorage.setItem(STORAGE_KEYS.LEADS, JSON.stringify(next));
  };

  const addLead = (leadData: Omit<PublicLeadSubmission, 'id' | 'createdAt' | 'status'>): PublicLeadSubmission => {
    const newLead: PublicLeadSubmission = {
      ...leadData,
      id: `lead_${Date.now()}`,
      status: 'new',
      createdAt: new Date().toISOString()
    };
    saveLeads([newLead, ...leads]);
    return newLead;
  };

  const updateLeadStatus = (id: string, status: 'new' | 'converted' | 'archived') => {
    saveLeads(leads.map(l => l.id === id ? { ...l, status } : l));
  };

  // 5. Reminders & Rules
  const [reminderRules, setReminderRules] = useState<ReminderRuleConfig[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.REMINDER_RULES);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_REMINDER_RULES;
  });

  const updateReminderRule = (id: string, updates: Partial<ReminderRuleConfig>) => {
    const next = reminderRules.map(r => r.id === id ? { ...r, ...updates } : r);
    setReminderRules(next);
    localStorage.setItem(STORAGE_KEYS.REMINDER_RULES, JSON.stringify(next));
  };

  const [reminderQueue, setReminderQueue] = useState<ReminderQueueItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.REMINDERS);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_REMINDERS;
  });

  const saveReminderQueue = (next: ReminderQueueItem[]) => {
    setReminderQueue(next);
    localStorage.setItem(STORAGE_KEYS.REMINDERS, JSON.stringify(next));
  };

  const sendReminder = (reminderId: string) => {
    saveReminderQueue(
      reminderQueue.map(r => r.id === reminderId ? { ...r, status: 'sent', sentAt: new Date().toISOString() } : r)
    );
  };

  const dismissReminder = (reminderId: string) => {
    saveReminderQueue(
      reminderQueue.map(r => r.id === reminderId ? { ...r, status: 'cancelled' } : r)
    );
  };

  // 6. Email Logs
  const [emailLogs, setEmailLogs] = useState<EmailLogItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EMAIL_LOGS);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_EMAIL_LOGS;
  });

  const addEmailLog = (logData: Omit<EmailLogItem, 'id' | 'sentAt'>) => {
    const newLog: EmailLogItem = {
      ...logData,
      id: `elog_${Date.now()}`,
      sentAt: new Date().toISOString()
    };
    const next = [newLog, ...emailLogs];
    setEmailLogs(next);
    localStorage.setItem(STORAGE_KEYS.EMAIL_LOGS, JSON.stringify(next));
  };

  // 7. Payments & Audit
  const [paymentTransactions, setPaymentTransactions] = useState<PaymentTransaction[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_PAYMENT_TRANSACTIONS;
  });

  const recordOnlinePayment = (txData: Omit<PaymentTransaction, 'id' | 'date'>) => {
    const newTx: PaymentTransaction = {
      ...txData,
      id: `tx_${Date.now()}`,
      date: new Date().toISOString()
    };
    const next = [newTx, ...paymentTransactions];
    setPaymentTransactions(next);
    localStorage.setItem(STORAGE_KEYS.PAYMENTS, JSON.stringify(next));
  };

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return INITIAL_AUDIT_LOGS;
  });

  const addAuditLog = (logData: Omit<AuditLogItem, 'id' | 'timestamp'>) => {
    const newLog: AuditLogItem = {
      ...logData,
      id: `audit_${Date.now()}`,
      timestamp: new Date().toISOString()
    };
    const next = [newLog, ...auditLogs];
    setAuditLogs(next);
    localStorage.setItem(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(next));
  };

  // 8. Catalogue des Prestations & Packs (Source unique des tarifs du studio)
  const [catalogServices, setCatalogServices] = useState<CatalogService[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CATALOG_SERVICES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return INITIAL_CATALOG_SERVICES;
  });

  const saveCatalogServices = (next: CatalogService[]) => {
    setCatalogServices(next);
    try {
      localStorage.setItem(STORAGE_KEYS.CATALOG_SERVICES, JSON.stringify(next));
    } catch {}
  };

  const [catalogPacks, setCatalogPacks] = useState<CatalogPack[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CATALOG_PACKS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return INITIAL_CATALOG_PACKS;
  });

  const saveCatalogPacks = (next: CatalogPack[]) => {
    setCatalogPacks(next);
    try {
      localStorage.setItem(STORAGE_KEYS.CATALOG_PACKS, JSON.stringify(next));
    } catch {}
  };

  const [projectTemplates, setProjectTemplates] = useState<ProjectTemplate[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.PROJECT_TEMPLATES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return INITIAL_TEMPLATES;
  });

  const saveProjectTemplates = (next: ProjectTemplate[]) => {
    setProjectTemplates(next);
    try {
      localStorage.setItem(STORAGE_KEYS.PROJECT_TEMPLATES, JSON.stringify(next));
    } catch {}
  };

  const [customCategories, setCustomCategories] = useState<string[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.CUSTOM_CATEGORIES);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    return [];
  });

  const saveCustomCategories = (next: string[]) => {
    setCustomCategories(next);
    try {
      localStorage.setItem(STORAGE_KEYS.CUSTOM_CATEGORIES, JSON.stringify(next));
    } catch {}
  };

  // Actions Prestations
  const addCatalogService = (data: Omit<CatalogService, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'priceHistory' | 'usageCount'>): CatalogService => {
    const now = new Date().toISOString();
    const newService: CatalogService = {
      ...data,
      id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      workspaceId: currentWorkspace.id,
      unitPriceCents: Math.max(0, Math.round(data.unitPriceCents || 0)),
      taxRate: data.taxRate !== undefined ? data.taxRate : null,
      status: data.status || 'active',
      priceHistory: [],
      usageCount: 0,
      createdAt: now,
      updatedAt: now
    };

    const next = [newService, ...catalogServices];
    saveCatalogServices(next);

    try {
      firestoreSetDoc(firestoreDoc(db, 'catalog_services', newService.id), {
        ...newService,
        ownerId: auth.uid || currentWorkspace.ownerId,
        workspaceId: currentWorkspace.id
      }, { merge: true }).catch(() => {});
    } catch {}

    return newService;
  };

  const updateCatalogService = (id: string, updates: Partial<CatalogService>, reason?: string) => {
    const existing = catalogServices.find(s => s.id === id);
    if (!existing) return;

    const now = new Date().toISOString();
    const newHistory = [...(existing.priceHistory || [])];

    // Traçabilité des prix si le tarif unitaire a changé
    if (updates.unitPriceCents !== undefined && updates.unitPriceCents !== existing.unitPriceCents) {
      newHistory.unshift({
        date: now,
        oldPriceCents: existing.unitPriceCents,
        newPriceCents: Math.max(0, Math.round(updates.unitPriceCents)),
        reason: reason || 'Mise à jour du tarif unitaire'
      });
    }

    const updatedService: CatalogService = {
      ...existing,
      ...updates,
      unitPriceCents: updates.unitPriceCents !== undefined ? Math.max(0, Math.round(updates.unitPriceCents)) : existing.unitPriceCents,
      priceHistory: newHistory,
      updatedAt: now
    };

    const next = catalogServices.map(s => s.id === id ? updatedService : s);
    saveCatalogServices(next);

    try {
      firestoreSetDoc(firestoreDoc(db, 'catalog_services', id), {
        ...updatedService,
        workspaceId: currentWorkspace.id
      }, { merge: true }).catch(() => {});
    } catch {}
  };

  const duplicateCatalogService = (id: string): CatalogService => {
    const existing = catalogServices.find(s => s.id === id);
    if (!existing) throw new Error('Prestation introuvable');

    return addCatalogService({
      name: `${existing.name} (Copie)`,
      category: existing.category,
      deliverableDescription: existing.deliverableDescription,
      unit: existing.unit,
      unitPriceCents: existing.unitPriceCents,
      taxRate: existing.taxRate,
      turnaroundDays: existing.turnaroundDays,
      revisionLimit: existing.revisionLimit,
      status: 'active'
    });
  };

  const archiveCatalogService = (id: string) => {
    updateCatalogService(id, { status: 'archived' }, 'Prestation archivée');
  };

  const reactivateCatalogService = (id: string) => {
    updateCatalogService(id, { status: 'active' }, 'Prestation réactivée');
  };

  const deleteCatalogService = (id: string): { success: boolean; error?: string } => {
    const existing = catalogServices.find(s => s.id === id);
    if (!existing) return { success: false, error: 'Prestation introuvable.' };

    // Vérifier si la prestation a été utilisée dans des devis, factures ou packs
    const isUsedInQuotes = quotes.some(q => q.lines?.some(l => l.designation?.toLowerCase().includes(existing.name.toLowerCase())));
    const isUsedInInvoices = invoices.some(i => i.lines?.some(l => l.designation?.toLowerCase().includes(existing.name.toLowerCase())));
    const isUsedInPacks = catalogPacks.some(p => p.items?.some(it => it.serviceId === id));
    const isUsed = (existing.usageCount && existing.usageCount > 0) || isUsedInQuotes || isUsedInInvoices || isUsedInPacks;

    if (isUsed) {
      return {
        success: false,
        error: "Cette prestation a déjà été utilisée dans des devis, factures ou packs créés. Pour préserver la conformité légale et comptable de vos documents, vous pouvez l'archiver mais pas la supprimer définitivement."
      };
    }

    const next = catalogServices.filter(s => s.id !== id);
    saveCatalogServices(next);

    try {
      firestoreDeleteDoc(firestoreDoc(db, 'catalog_services', id)).catch(() => {});
    } catch {}

    return { success: true };
  };

  const importCommonPrestations = (items: Array<{ suggestionId: string; customPriceCents: number }>) => {
    const newServices: CatalogService[] = [];
    const now = new Date().toISOString();

    for (const item of items) {
      const sug = COMMON_PRESTATION_SUGGESTIONS.find(s => s.id === item.suggestionId);
      if (!sug) continue;

      const newSrv: CatalogService = {
        id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        workspaceId: currentWorkspace.id,
        name: sug.name,
        category: sug.category,
        deliverableDescription: sug.deliverableDescription,
        unit: sug.unit,
        unitPriceCents: Math.max(0, Math.round(item.customPriceCents || 0)),
        taxRate: null,
        turnaroundDays: sug.turnaroundDays,
        revisionLimit: sug.revisionLimit,
        status: 'active',
        priceHistory: [],
        usageCount: 0,
        createdAt: now,
        updatedAt: now
      };
      newServices.push(newSrv);
    }

    if (newServices.length > 0) {
      const next = [...newServices, ...catalogServices];
      saveCatalogServices(next);
      newServices.forEach(s => {
        try {
          firestoreSetDoc(firestoreDoc(db, 'catalog_services', s.id), {
            ...s,
            ownerId: auth.uid || currentWorkspace.ownerId,
            workspaceId: currentWorkspace.id
          }, { merge: true }).catch(() => {});
        } catch {}
      });
    }
  };

  // Actions Packs
  const addCatalogPack = (data: Omit<CatalogPack, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'priceHistory' | 'usageCount'>): CatalogPack => {
    const now = new Date().toISOString();
    const newPack: CatalogPack = {
      ...data,
      id: `pack_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      workspaceId: currentWorkspace.id,
      packPriceCents: Math.max(0, Math.round(data.packPriceCents || 0)),
      taxRate: data.taxRate !== undefined ? data.taxRate : null,
      status: data.status || 'active',
      priceHistory: [],
      usageCount: 0,
      createdAt: now,
      updatedAt: now
    };

    const next = [newPack, ...catalogPacks];
    saveCatalogPacks(next);

    try {
      firestoreSetDoc(firestoreDoc(db, 'catalog_packs', newPack.id), {
        ...newPack,
        ownerId: auth.uid || currentWorkspace.ownerId,
        workspaceId: currentWorkspace.id
      }, { merge: true }).catch(() => {});
    } catch {}

    return newPack;
  };

  const updateCatalogPack = (id: string, updates: Partial<CatalogPack>, reason?: string) => {
    const existing = catalogPacks.find(p => p.id === id);
    if (!existing) return;

    const now = new Date().toISOString();
    const newHistory = [...(existing.priceHistory || [])];

    if (updates.packPriceCents !== undefined && updates.packPriceCents !== existing.packPriceCents) {
      newHistory.unshift({
        date: now,
        oldPriceCents: existing.packPriceCents,
        newPriceCents: Math.max(0, Math.round(updates.packPriceCents)),
        reason: reason || 'Mise à jour du tarif du pack'
      });
    }

    const updated: CatalogPack = {
      ...existing,
      ...updates,
      packPriceCents: updates.packPriceCents !== undefined ? Math.max(0, Math.round(updates.packPriceCents)) : existing.packPriceCents,
      priceHistory: newHistory,
      updatedAt: now
    };

    const next = catalogPacks.map(p => p.id === id ? updated : p);
    saveCatalogPacks(next);

    try {
      firestoreSetDoc(firestoreDoc(db, 'catalog_packs', id), {
        ...updated,
        workspaceId: currentWorkspace.id
      }, { merge: true }).catch(() => {});
    } catch {}
  };

  const duplicateCatalogPack = (id: string): CatalogPack => {
    const existing = catalogPacks.find(p => p.id === id);
    if (!existing) throw new Error('Pack introuvable');

    return addCatalogPack({
      name: `${existing.name} (Copie)`,
      category: existing.category,
      description: existing.description,
      deliverableDescription: existing.deliverableDescription,
      items: [...existing.items],
      pricingMode: existing.pricingMode,
      packPriceCents: existing.packPriceCents,
      taxRate: existing.taxRate,
      turnaroundDays: existing.turnaroundDays,
      revisionLimit: existing.revisionLimit,
      status: 'active'
    });
  };

  const archiveCatalogPack = (id: string) => {
    updateCatalogPack(id, { status: 'archived' }, 'Pack archivé');
  };

  const reactivateCatalogPack = (id: string) => {
    updateCatalogPack(id, { status: 'active' }, 'Pack réactivé');
  };

  const deleteCatalogPack = (id: string): { success: boolean; error?: string } => {
    const existing = catalogPacks.find(p => p.id === id);
    if (!existing) return { success: false, error: 'Pack introuvable.' };

    const isUsedInQuotes = quotes.some(q => q.lines?.some(l => l.designation?.toLowerCase().includes(existing.name.toLowerCase())));
    const isUsedInInvoices = invoices.some(i => i.lines?.some(l => l.designation?.toLowerCase().includes(existing.name.toLowerCase())));
    if ((existing.usageCount && existing.usageCount > 0) || isUsedInQuotes || isUsedInInvoices) {
      return {
        success: false,
        error: "Ce pack a déjà été utilisé dans vos devis ou factures. Pour préserver l'historique comptable, archivez-le plutôt que de le supprimer."
      };
    }

    const next = catalogPacks.filter(p => p.id !== id);
    saveCatalogPacks(next);

    try {
      firestoreDeleteDoc(firestoreDoc(db, 'catalog_packs', id)).catch(() => {});
    } catch {}

    return { success: true };
  };

  // Actions Modèles de projet
  const addProjectTemplate = (data: Omit<ProjectTemplate, 'id' | 'workspaceId' | 'createdAt' | 'updatedAt'>): ProjectTemplate => {
    const now = new Date().toISOString();
    const newTmpl: ProjectTemplate = {
      ...data,
      id: `tmpl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      workspaceId: currentWorkspace.id,
      name: data.name || data.title || 'Modèle de projet',
      title: data.name || data.title || 'Modèle de projet',
      createdAt: now,
      updatedAt: now
    };

    const next = [newTmpl, ...projectTemplates];
    saveProjectTemplates(next);

    try {
      firestoreSetDoc(firestoreDoc(db, 'project_templates', newTmpl.id), {
        ...newTmpl,
        ownerId: auth.uid || currentWorkspace.ownerId,
        workspaceId: currentWorkspace.id
      }, { merge: true }).catch(() => {});
    } catch {}

    return newTmpl;
  };

  const updateProjectTemplate = (id: string, updates: Partial<ProjectTemplate>) => {
    const existing = projectTemplates.find(t => t.id === id);
    if (!existing) return;

    const now = new Date().toISOString();
    const updated: ProjectTemplate = {
      ...existing,
      ...updates,
      name: updates.name || updates.title || existing.name || existing.title || 'Modèle',
      title: updates.name || updates.title || existing.title || existing.name || 'Modèle',
      updatedAt: now
    };

    const next = projectTemplates.map(t => t.id === id ? updated : t);
    saveProjectTemplates(next);

    try {
      firestoreSetDoc(firestoreDoc(db, 'project_templates', id), {
        ...updated,
        workspaceId: currentWorkspace.id
      }, { merge: true }).catch(() => {});
    } catch {}
  };

  const duplicateProjectTemplate = (id: string): ProjectTemplate => {
    const existing = projectTemplates.find(t => t.id === id);
    if (!existing) throw new Error('Modèle introuvable');

    return addProjectTemplate({
      name: `${existing.name || existing.title} (Copie)`,
      title: `${existing.title || existing.name} (Copie)`,
      description: existing.description,
      projectType: existing.projectType,
      defaultServiceIds: existing.defaultServiceIds ? [...existing.defaultServiceIds] : [],
      defaultSteps: existing.defaultSteps ? [...existing.defaultSteps] : [],
      defaultTasks: existing.defaultTasks ? [...existing.defaultTasks] : [],
      briefQuestions: existing.briefQuestions ? [...existing.briefQuestions] : [],
      requiredClientAssets: existing.requiredClientAssets ? [...existing.requiredClientAssets] : [],
      revisionLimit: existing.revisionLimit || 3,
      turnaroundDays: existing.turnaroundDays || 14
    });
  };

  const deleteProjectTemplate = (id: string) => {
    const next = projectTemplates.filter(t => t.id !== id);
    saveProjectTemplates(next);

    try {
      firestoreDeleteDoc(firestoreDoc(db, 'project_templates', id)).catch(() => {});
    } catch {}
  };

  const addCustomCategory = (cat: string) => {
    const clean = cat.trim();
    if (!clean || customCategories.includes(clean)) return;
    const next = [...customCategories, clean];
    saveCustomCategories(next);
  };

  // Synchronization with Cloud Firestore (Multi-tenant persistence)
  useEffect(() => {
    if (!auth.isAuthenticated || !auth.workspaceId) return;

    let isMounted = true;
    async function syncFirestoreWorkspace() {
      try {
        const wsId = auth.workspaceId;
        // 1. Clients
        const qClients = firestoreQuery(firestoreCol(db, 'clients'), firestoreWhere('workspaceId', '==', wsId));
        const snapClients = await firestoreGetDocs(qClients);
        if (!snapClients.empty && isMounted) {
          const cloudClients: Client[] = [];
          snapClients.forEach(docSnap => cloudClients.push(docSnap.data() as Client));
          if (cloudClients.length > 0) {
            setClients(prev => {
              const prevOther = prev.filter(c => c.workspaceId !== wsId);
              return [...cloudClients, ...prevOther];
            });
          }
        }

        // 2. Projects
        const qProjects = firestoreQuery(firestoreCol(db, 'projects'), firestoreWhere('workspaceId', '==', wsId));
        const snapProjects = await firestoreGetDocs(qProjects);
        if (!snapProjects.empty && isMounted) {
          const cloudProjects: Project[] = [];
          snapProjects.forEach(docSnap => cloudProjects.push(normalizeProject(docSnap.data())));
          if (cloudProjects.length > 0) {
            setProjects(prev => {
              const prevOther = prev.filter(p => p.workspaceId !== wsId);
              return [...cloudProjects, ...prevOther];
            });
          }
        }

        // 3. Catalog Services
        const qServices = firestoreQuery(firestoreCol(db, 'catalog_services'), firestoreWhere('workspaceId', '==', wsId));
        const snapServices = await firestoreGetDocs(qServices);
        if (!snapServices.empty && isMounted) {
          const cloudServices: CatalogService[] = [];
          snapServices.forEach(docSnap => cloudServices.push(docSnap.data() as CatalogService));
          if (cloudServices.length > 0) {
            setCatalogServices(prev => {
              const prevOther = prev.filter(s => s.workspaceId !== wsId);
              return [...cloudServices, ...prevOther];
            });
          }
        }

        // 4. Catalog Packs
        const qPacks = firestoreQuery(firestoreCol(db, 'catalog_packs'), firestoreWhere('workspaceId', '==', wsId));
        const snapPacks = await firestoreGetDocs(qPacks);
        if (!snapPacks.empty && isMounted) {
          const cloudPacks: CatalogPack[] = [];
          snapPacks.forEach(docSnap => cloudPacks.push(docSnap.data() as CatalogPack));
          if (cloudPacks.length > 0) {
            setCatalogPacks(prev => {
              const prevOther = prev.filter(p => p.workspaceId !== wsId);
              return [...cloudPacks, ...prevOther];
            });
          }
        }

        // 5. Project Templates
        const qTemplates = firestoreQuery(firestoreCol(db, 'project_templates'), firestoreWhere('workspaceId', '==', wsId));
        const snapTemplates = await firestoreGetDocs(qTemplates);
        if (!snapTemplates.empty && isMounted) {
          const cloudTemplates: ProjectTemplate[] = [];
          snapTemplates.forEach(docSnap => cloudTemplates.push(docSnap.data() as ProjectTemplate));
          if (cloudTemplates.length > 0) {
            setProjectTemplates(prev => {
              const prevOther = prev.filter(t => t.workspaceId !== wsId);
              return [...cloudTemplates, ...prevOther];
            });
          }
        }

        // 6. Quotes
        const qQuotes = firestoreQuery(firestoreCol(db, 'quotes'), firestoreWhere('workspaceId', '==', wsId));
        const snapQuotes = await firestoreGetDocs(qQuotes);
        if (!snapQuotes.empty && isMounted) {
          const cloudQuotes: Quote[] = [];
          snapQuotes.forEach(docSnap => cloudQuotes.push(docSnap.data() as Quote));
          if (cloudQuotes.length > 0) {
            setQuotes(prev => {
              const prevOther = prev.filter(q => q.workspaceId !== wsId);
              return [...cloudQuotes, ...prevOther];
            });
          }
        }

        // 7. Invoices
        const qInvoices = firestoreQuery(firestoreCol(db, 'invoices'), firestoreWhere('workspaceId', '==', wsId));
        const snapInvoices = await firestoreGetDocs(qInvoices);
        if (!snapInvoices.empty && isMounted) {
          const cloudInvoices: Invoice[] = [];
          snapInvoices.forEach(docSnap => cloudInvoices.push(docSnap.data() as Invoice));
          if (cloudInvoices.length > 0) {
            setInvoices(prev => {
              const prevOther = prev.filter(i => i.workspaceId !== wsId);
              return [...cloudInvoices, ...prevOther];
            });
          }
        }

        // Auto-sanitize any catalog services in zero-decimal currencies stored with extra * 100
        setCatalogServices(prev => {
          let modified = false;
          const sanitized = prev.map(item => {
            const cur = (profile.currency || 'EUR').toUpperCase();
            const isZeroDec = ['FCFA', 'XOF', 'XAF', 'FR', 'FR.', 'CFA', 'JPY'].includes(cur);
            if (isZeroDec && item.unitPriceCents >= 100000 && item.unitPriceCents % 100 === 0) {
              modified = true;
              return { ...item, unitPriceCents: Math.round(item.unitPriceCents / 100) };
            }
            return item;
          });
          if (modified) {
            localStorage.setItem(STORAGE_KEYS.CATALOG_SERVICES, JSON.stringify(sanitized));
            return sanitized;
          }
          return prev;
        });
      } catch (err) {
        console.warn('[Firestore] Sync notice:', err);
      }
    }

    syncFirestoreWorkspace();
    return () => { isMounted = false; };
  }, [auth.isAuthenticated, auth.workspaceId]);


  // Multi-tenant Workspace Scoped Business Collections
  const workspaceClients = useMemo(() => {
    return clients.filter(c => c.workspaceId === currentWorkspace.id || (!c.workspaceId && currentWorkspace.id === 'ws_abdoulaye'));
  }, [clients, currentWorkspace.id]);

  const workspaceProjects = useMemo(() => {
    return projects.filter(p => p.workspaceId === currentWorkspace.id || (!p.workspaceId && currentWorkspace.id === 'ws_abdoulaye'));
  }, [projects, currentWorkspace.id]);

  const workspaceQuotes = useMemo(() => {
    return quotes.filter(q => q.workspaceId === currentWorkspace.id || (!q.workspaceId && currentWorkspace.id === 'ws_abdoulaye'));
  }, [quotes, currentWorkspace.id]);

  const workspaceInvoices = useMemo(() => {
    return invoices.filter(i => i.workspaceId === currentWorkspace.id || (!i.workspaceId && currentWorkspace.id === 'ws_abdoulaye'));
  }, [invoices, currentWorkspace.id]);

  const workspaceAppointments = useMemo(() => {
    return appointments.filter(a => a.workspaceId === currentWorkspace.id || (!a.workspaceId && currentWorkspace.id === 'ws_abdoulaye'));
  }, [appointments, currentWorkspace.id]);

  const workspaceTimeEntries = useMemo(() => {
    return timeEntries.filter(t => t.workspaceId === currentWorkspace.id || (!t.workspaceId && currentWorkspace.id === 'ws_abdoulaye'));
  }, [timeEntries, currentWorkspace.id]);

  const workspaceExpenses = useMemo(() => {
    return expenses.filter(e => e.workspaceId === currentWorkspace.id || (!e.workspaceId && currentWorkspace.id === 'ws_abdoulaye'));
  }, [expenses, currentWorkspace.id]);

  const workspaceReminders = useMemo(() => {
    return reminderQueue.filter(r => r.workspaceId === currentWorkspace.id || (!r.workspaceId && currentWorkspace.id === 'ws_abdoulaye'));
  }, [reminderQueue, currentWorkspace.id]);

  const workspaceLeads = useMemo(() => {
    return leads.filter(l => l.workspaceId === currentWorkspace.id || (!l.workspaceId && currentWorkspace.id === 'ws_abdoulaye'));
  }, [leads, currentWorkspace.id]);

  const workspaceNotifications = useMemo(() => {
    return notifications.filter(n => n.workspaceId === currentWorkspace.id || (!n.workspaceId && currentWorkspace.id === 'ws_abdoulaye'));
  }, [notifications, currentWorkspace.id]);

  const workspaceCatalogServices = useMemo(() => {
    return catalogServices.filter(s => s.workspaceId === currentWorkspace.id || (!s.workspaceId && currentWorkspace.id === 'ws_abdoulaye'));
  }, [catalogServices, currentWorkspace.id]);

  const workspaceCatalogPacks = useMemo(() => {
    return catalogPacks.filter(p => p.workspaceId === currentWorkspace.id || (!p.workspaceId && currentWorkspace.id === 'ws_abdoulaye'));
  }, [catalogPacks, currentWorkspace.id]);

  const workspaceProjectTemplates = useMemo(() => {
    return projectTemplates.filter(t => t.workspaceId === currentWorkspace.id || (!t.workspaceId && currentWorkspace.id === 'ws_abdoulaye'));
  }, [projectTemplates, currentWorkspace.id]);

  const hasDemoData = useMemo(() => {
    return workspaceClients.some(c => c.isDemo || c.company === 'Maison Solène' || c.company === 'Café Nuance') ||
           workspaceProjects.some(p => p.isDemo || p.title?.includes('Maison Solène') || p.title?.includes('Café Nuance')) ||
           workspaceQuotes.some(q => q.isDemo) ||
           workspaceInvoices.some(i => i.isDemo);
  }, [workspaceClients, workspaceProjects, workspaceQuotes, workspaceInvoices]);

  const loadSampleDemoData = () => {
    const sample = generateSampleDemoData(currentWorkspace.id);
    saveClients([...sample.clients, ...clients]);
    saveProjects([...sample.projects.map(normalizeProject), ...projects]);
    saveQuotes([...sample.quotes, ...quotes]);
    saveInvoices([...sample.invoices, ...invoices]);
    saveAppointments([...sample.appointments, ...appointments]);
    saveNotifications([...sample.notifications, ...notifications]);
  };

  const deleteDemoData = () => {
    saveClients(clients.filter(c => {
      const isInWs = c.workspaceId === currentWorkspace.id || (!c.workspaceId && currentWorkspace.id === 'ws_abdoulaye');
      if (isInWs) {
        return !c.isDemo && c.company !== 'Maison Solène' && c.company !== 'Café Nuance';
      }
      return true;
    }));
    saveProjects(projects.filter(p => {
      const isInWs = p.workspaceId === currentWorkspace.id || (!p.workspaceId && currentWorkspace.id === 'ws_abdoulaye');
      if (isInWs) {
        return !p.isDemo && !p.title?.includes('Maison Solène') && !p.title?.includes('Café Nuance');
      }
      return true;
    }));
    saveQuotes(quotes.filter(q => {
      const isInWs = q.workspaceId === currentWorkspace.id || (!q.workspaceId && currentWorkspace.id === 'ws_abdoulaye');
      if (isInWs) {
        return !q.isDemo && !q.quoteNumber?.includes('DEV-2026-001') && !q.quoteNumber?.includes('DEV-2026-002');
      }
      return true;
    }));
    saveInvoices(invoices.filter(i => {
      const isInWs = i.workspaceId === currentWorkspace.id || (!i.workspaceId && currentWorkspace.id === 'ws_abdoulaye');
      if (isInWs) {
        return !i.isDemo && !i.invoiceNumber?.includes('FAC-2026-001') && !i.invoiceNumber?.includes('FAC-2026-002');
      }
      return true;
    }));
    saveAppointments(appointments.filter(a => {
      const isInWs = a.workspaceId === currentWorkspace.id || (!a.workspaceId && currentWorkspace.id === 'ws_abdoulaye');
      if (isInWs) {
        return !a.isDemo;
      }
      return true;
    }));
    saveNotifications(notifications.filter(n => {
      const isInWs = n.workspaceId === currentWorkspace.id || (!n.workspaceId && currentWorkspace.id === 'ws_abdoulaye');
      if (isInWs) {
        return !n.isDemo;
      }
      return true;
    }));
  };

  const resetWorkspaceData = (confirmWord: string): boolean => {
    if (confirmWord.trim().toUpperCase() !== 'REINITIALISER') {
      return false;
    }
    const currentWsId = currentWorkspace.id;
    saveClients(clients.filter(c => c.workspaceId ? c.workspaceId !== currentWsId : currentWsId !== 'ws_abdoulaye'));
    saveProjects(projects.filter(p => p.workspaceId ? p.workspaceId !== currentWsId : currentWsId !== 'ws_abdoulaye'));
    saveQuotes(quotes.filter(q => q.workspaceId ? q.workspaceId !== currentWsId : currentWsId !== 'ws_abdoulaye'));
    saveInvoices(invoices.filter(i => i.workspaceId ? i.workspaceId !== currentWsId : currentWsId !== 'ws_abdoulaye'));
    saveAppointments(appointments.filter(a => a.workspaceId ? a.workspaceId !== currentWsId : currentWsId !== 'ws_abdoulaye'));
    saveTimeEntries(timeEntries.filter(t => t.workspaceId ? t.workspaceId !== currentWsId : currentWsId !== 'ws_abdoulaye'));
    saveExpenses(expenses.filter(e => e.workspaceId ? e.workspaceId !== currentWsId : currentWsId !== 'ws_abdoulaye'));
    saveReminderQueue(reminderQueue.filter(r => r.workspaceId ? r.workspaceId !== currentWsId : currentWsId !== 'ws_abdoulaye'));
    saveLeads(leads.filter(l => l.workspaceId ? l.workspaceId !== currentWsId : currentWsId !== 'ws_abdoulaye'));
    saveNotifications(notifications.filter(n => n.workspaceId ? n.workspaceId !== currentWsId : currentWsId !== 'ws_abdoulaye'));
    return true;
  };

  const resetDemoData = () => {
    deleteDemoData();
  };

  // Entitlements calculation for the active workspace
  const entitlements: WorkspaceEntitlements = useMemo(() => {
    return calculateEntitlements({
      workspace: currentWorkspace,
      projects: workspaceProjects,
      clients: workspaceClients,
      quotes: workspaceQuotes,
      plans
    });
  }, [currentWorkspace, workspaceProjects, workspaceClients, workspaceQuotes, plans]);

  // Export full workspace data (portability & GDPR)
  const exportFullWorkspaceData = () => {
    const data = {
      workspace: currentWorkspace,
      profile,
      clients: clients.filter(c => !c.workspaceId || c.workspaceId === currentWorkspace.id),
      projects: projects.filter(p => !p.workspaceId || p.workspaceId === currentWorkspace.id),
      quotes: quotes.filter(q => !q.workspaceId || q.workspaceId === currentWorkspace.id),
      invoices: invoices.filter(i => !i.workspaceId || i.workspaceId === currentWorkspace.id),
      exportedAt: new Date().toISOString()
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `eyesonwork-export-${currentWorkspace.name.toLowerCase().replace(/\s+/g, '-')}-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <AppContext.Provider
      value={{
        auth,
        loginAsDemo,
        loginWithEmail,
        logout,
        theme,
        toggleTheme,

        // Workspaces & Subscriptions (Multi-tenant)
        allWorkspaces,
        currentWorkspace,
        plans,
        promoCodes,
        platformEmailTemplates,
        entitlements,
        isUpgradeModalOpen,
        openUpgradeModal,
        closeUpgradeModal,
        changePlan,
        superAdminUpdateWorkspacePlan,
        superAdminToggleWorkspaceStatus,
        updatePlansConfig,
        addPromoCode,
        togglePromoCode,
        exportFullWorkspaceData,

        // Auth additions
        registerWithEmail,
        loginWithGoogle,
        sendVerificationCode,
        verifyEmailCode,
        acceptCurrentTerms,
        linkGoogleAccount,
        reauthenticate,
        isAuthLoading,
        authError,
        clearAuthError,

        clients: workspaceClients,
        projects: workspaceProjects,
        quotes: workspaceQuotes,
        invoices: workspaceInvoices,
        notifications: workspaceNotifications,
        profile,
        addClient,
        updateClient,
        deleteClient,
        archiveClient,
        canDeleteClient,
        getClientById,
        addProject,
        updateProject,
        deleteProject,
        canDeleteProject,
        updateProjectStep,
        getProjectById,
        getProjectByShareToken,
        regenerateShareToken,
        toggleShareLinkActive,
        archiveProject,
        addTask,
        toggleTask,
        deleteTask,
        addActivity,
        addMockupRound,
        addMockupVersion,
        addPinComment,
        addGeneralComment,
        validateMockupRound,
        requestMockupChanges,
        addPaidRevision,
        uploadProjectFile,
        deleteProjectFile,
        addQuote,
        updateQuote,
        deleteQuote,
        duplicateQuote,
        createQuoteVersion,
        acceptQuote,
        refuseQuote,
        getQuotesByProjectId,
        addInvoice,
        createInvoiceFromQuote,
        updateInvoice,
        deleteInvoice,
        canModifyInvoice,
        cancelInvoiceWithCreditNote,
        recordPayment,
        getInvoicesByProjectId,
        updateDeliveryConfig,
        unlockDeliveryManually,
        submitProjectReview,
        addNotification,
        markNotificationRead,
        markAllNotificationsRead,
        updateProfile,
        resetDemoData,
        completeOnboarding,
        loadSampleDemoData,
        deleteDemoData,
        resetWorkspaceData,
        hasDemoData,
        activeClientPortalToken,
        isClientPortalPreview,
        openClientPortal,
        closeClientPortal,
        appointments: workspaceAppointments,
        addAppointment,
        deleteAppointment,
        timeEntries: workspaceTimeEntries,
        addTimeEntry,
        deleteTimeEntry,
        expenses: workspaceExpenses,
        addExpense,
        deleteExpense,
        leads: workspaceLeads,
        addLead,
        updateLeadStatus,
        reminderRules,
        updateReminderRule,
        reminderQueue: workspaceReminders,
        sendReminder,
        dismissReminder,
        emailLogs,
        addEmailLog,
        paymentTransactions,
        recordOnlinePayment,
        auditLogs,
        addAuditLog,

        // Catalogue des Prestations & Packs (Source unique des tarifs du studio)
        catalogServices: workspaceCatalogServices,
        catalogPacks: workspaceCatalogPacks,
        projectTemplates: workspaceProjectTemplates,
        customCategories,
        addCatalogService,
        updateCatalogService,
        duplicateCatalogService,
        archiveCatalogService,
        reactivateCatalogService,
        deleteCatalogService,
        importCommonPrestations,
        addCatalogPack,
        updateCatalogPack,
        duplicateCatalogPack,
        archiveCatalogPack,
        reactivateCatalogPack,
        deleteCatalogPack,
        addProjectTemplate,
        updateProjectTemplate,
        duplicateProjectTemplate,
        deleteProjectTemplate,
        addCustomCategory,
        workspace: currentWorkspace,
        upgradeModalOpen: isUpgradeModalOpen,
        upgradeReason: entitlements.blockReasonProject || entitlements.blockReasonClient || entitlements.blockReasonQuote || '',
        setPlan: (planId: PlanId) => changePlan(planId, 'monthly'),
        markNotificationAsRead: (id: string) => markNotificationRead(id)
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
