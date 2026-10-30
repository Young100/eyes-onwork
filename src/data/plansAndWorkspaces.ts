import { Client, Project, Quote, Workspace, WorkspaceEntitlements } from '../types';

export interface PlanConfig {
  id: 'free' | 'pro' | 'studio';
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

export const DEFAULT_PLANS: Record<'free' | 'pro' | 'studio', PlanConfig> = {
  free: {
    id: 'free',
    name: 'Découverte',
    priceMonthly: 0,
    maxActiveProjects: 2,
    maxClients: 3,
    maxQuotesPerMonth: 3,
    customBranding: false,
    multiVersionsAllowed: true,
    prioritySupport: false
  },
  pro: {
    id: 'pro',
    name: 'Professionnel',
    priceMonthly: 29,
    maxActiveProjects: 25,
    maxClients: 50,
    maxQuotesPerMonth: 100,
    customBranding: true,
    multiVersionsAllowed: true,
    prioritySupport: true
  },
  studio: {
    id: 'studio',
    name: 'Studio Agence',
    priceMonthly: 79,
    maxActiveProjects: 999,
    maxClients: 999,
    maxQuotesPerMonth: 999,
    customBranding: true,
    multiVersionsAllowed: true,
    prioritySupport: true
  }
};

export const INITIAL_DEMO_WORKSPACES: Workspace[] = [
  {
    id: 'ws_default',
    name: 'Atelier Graphique Paris',
    ownerId: 'designer_solene',
    planId: 'free',
    createdAt: '2026-01-01T00:00:00Z'
  }
];

export function calculateEntitlements(
  workspaceOrOptions: Workspace | { workspace: Workspace; projects?: Project[]; clients?: Client[]; quotes?: Quote[]; plans?: any },
  projectsArg: Project[] = [],
  clientsArg: Client[] = [],
  quotesArg: Quote[] = []
): WorkspaceEntitlements {
  let workspace: Workspace;
  let projects: Project[];
  let clients: Client[];
  let quotes: Quote[];

  if (workspaceOrOptions && 'workspace' in workspaceOrOptions) {
    workspace = workspaceOrOptions.workspace;
    projects = workspaceOrOptions.projects || [];
    clients = workspaceOrOptions.clients || [];
    quotes = workspaceOrOptions.quotes || [];
  } else {
    workspace = workspaceOrOptions as Workspace;
    projects = projectsArg;
    clients = clientsArg;
    quotes = quotesArg;
  }

  const plan = DEFAULT_PLANS[workspace?.planId] || DEFAULT_PLANS.free;

  const activeProjects = projects.filter(p => !p.archived && p.currentStep !== 'projet_cloture');
  const activeClients = clients.filter(c => c.status !== 'archived');

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const quotesThisMonth = quotes.filter(q => {
    const qDate = new Date(q.createdAt);
    return qDate.getMonth() === currentMonth && qDate.getFullYear() === currentYear;
  });

  const activeProjectsCount = activeProjects.length;
  const clientsCount = activeClients.length;
  const quotesThisMonthCount = quotesThisMonth.length;

  const canCreateProject = activeProjectsCount < plan.maxActiveProjects;
  const canCreateClient = clientsCount < plan.maxClients;
  const canCreateQuote = quotesThisMonthCount < plan.maxQuotesPerMonth;

  let blockReasonProject: string | undefined;
  if (!canCreateProject) {
    blockReasonProject = `Limite de projets actifs atteinte (${plan.maxActiveProjects} max sur le plan ${plan.name}). Passez au plan Pro pour gérer jusqu'à 25 projets.`;
  }

  let blockReasonClient: string | undefined;
  if (!canCreateClient) {
    blockReasonClient = `Limite de clients atteinte (${plan.maxClients} max sur le plan ${plan.name}). Passez au plan Pro pour un carnet d'adresses étendu.`;
  }

  let blockReasonQuote: string | undefined;
  if (!canCreateQuote) {
    blockReasonQuote = `Limite mensuelle de devis atteinte (${plan.maxQuotesPerMonth} devis max ce mois-ci sur le plan ${plan.name}). Passez au plan Pro pour créer des devis illimités.`;
  }

  const hasWatermarkOnPdf = !plan.customBranding;
  const hasAutoReminders = plan.id === 'pro' || plan.id === 'studio';
  const isGracePeriod = workspace?.planStatus === 'grace_period';
  let daysLeftInGrace: number | undefined;
  if (isGracePeriod) {
    const endsAt = (workspace as any)?.gracePeriodEndsAt;
    if (endsAt) {
      const diffMs = new Date(endsAt).getTime() - Date.now();
      daysLeftInGrace = Math.max(0, Math.ceil(diffMs / (24 * 60 * 60 * 1000)));
    } else {
      daysLeftInGrace = 7;
    }
  }

  return {
    maxActiveProjects: plan.maxActiveProjects,
    maxClients: plan.maxClients,
    maxQuotesPerMonth: plan.maxQuotesPerMonth,
    customBranding: plan.customBranding,
    multiVersionsAllowed: plan.multiVersionsAllowed,
    prioritySupport: plan.prioritySupport,
    canCreateProject,
    canCreateClient,
    canCreateQuote,
    activeProjectsCount,
    clientsCount,
    quotesThisMonthCount,
    hasWatermarkOnPdf,
    hasAutoReminders,
    isGracePeriod,
    daysLeftInGrace,
    blockReasonProject,
    blockReasonClient,
    blockReasonQuote
  };
}

export const SUPER_ADMIN_EMAIL = 'admin@eyesonwork.fr';

export function isSuperAdminUser(email?: string): boolean {
  if (!email) return false;
  return email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
}

export function migrateLegacyDataToWorkspace(workspaceId: string, items: any[]): any[] {
  return (items || []).map(item => ({
    ...item,
    workspaceId: item.workspaceId || workspaceId
  }));
}

export const INITIAL_PROMO_CODES: any[] = [];
export const DEFAULT_PLATFORM_EMAIL_TEMPLATES: any[] = [];

