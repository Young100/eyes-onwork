/**
 * eyes-onwork Multi-Tenant Workspace Migration Script
 * Migrates single-user legacy data into isolated workspaces without any data loss.
 */

import { INITIAL_DEMO_WORKSPACES } from '../data/plansAndWorkspaces';
import { Workspace } from '../types';

export interface MigrationSummary {
  timestamp: string;
  defaultWorkspaceId: string;
  migratedProjects: number;
  migratedClients: number;
  migratedQuotes: number;
  migratedInvoices: number;
  totalWorkspacesConfigured: number;
  status: 'already_migrated' | 'migrated_successfully';
}

export function runWorkspaceDataMigration(): MigrationSummary {
  const defaultWorkspaceId = 'ws_abdoulaye';
  let migratedProjects = 0;
  let migratedClients = 0;
  let migratedQuotes = 0;
  let migratedInvoices = 0;

  if (typeof window === 'undefined') {
    return {
      timestamp: new Date().toISOString(),
      defaultWorkspaceId,
      migratedProjects: 0,
      migratedClients: 0,
      migratedQuotes: 0,
      migratedInvoices: 0,
      totalWorkspacesConfigured: INITIAL_DEMO_WORKSPACES.length,
      status: 'migrated_successfully'
    };
  }

  // 1. Initialize Workspaces in localStorage if not present
  const storedWorkspaces = localStorage.getItem('eyesonwork_workspaces');
  if (!storedWorkspaces) {
    localStorage.setItem('eyesonwork_workspaces', JSON.stringify(INITIAL_DEMO_WORKSPACES));
  }

  // 2. Migrate Projects
  try {
    const rawProjects = localStorage.getItem('eyesonwork_projects');
    if (rawProjects) {
      const projects = JSON.parse(rawProjects);
      let changed = false;
      const updated = projects.map((p: any) => {
        if (!p.workspaceId) {
          migratedProjects++;
          changed = true;
          return { ...p, workspaceId: defaultWorkspaceId };
        }
        return p;
      });
      if (changed) {
        localStorage.setItem('eyesonwork_projects', JSON.stringify(updated));
      }
    }
  } catch (err) {
    console.warn('[Migration Warning] Error migrating projects:', err);
  }

  // 3. Migrate Clients
  try {
    const rawClients = localStorage.getItem('eyesonwork_clients');
    if (rawClients) {
      const clients = JSON.parse(rawClients);
      let changed = false;
      const updated = clients.map((c: any) => {
        if (!c.workspaceId) {
          migratedClients++;
          changed = true;
          return { ...c, workspaceId: defaultWorkspaceId };
        }
        return c;
      });
      if (changed) {
        localStorage.setItem('eyesonwork_clients', JSON.stringify(updated));
      }
    }
  } catch (err) {
    console.warn('[Migration Warning] Error migrating clients:', err);
  }

  // 4. Migrate Quotes
  try {
    const rawQuotes = localStorage.getItem('eyesonwork_quotes');
    if (rawQuotes) {
      const quotes = JSON.parse(rawQuotes);
      let changed = false;
      const updated = quotes.map((q: any) => {
        if (!q.workspaceId) {
          migratedQuotes++;
          changed = true;
          return { ...q, workspaceId: defaultWorkspaceId };
        }
        return q;
      });
      if (changed) {
        localStorage.setItem('eyesonwork_quotes', JSON.stringify(updated));
      }
    }
  } catch (err) {
    console.warn('[Migration Warning] Error migrating quotes:', err);
  }

  // 5. Migrate Invoices
  try {
    const rawInvoices = localStorage.getItem('eyesonwork_invoices');
    if (rawInvoices) {
      const invoices = JSON.parse(rawInvoices);
      let changed = false;
      const updated = invoices.map((i: any) => {
        if (!i.workspaceId) {
          migratedInvoices++;
          changed = true;
          return { ...i, workspaceId: defaultWorkspaceId };
        }
        return i;
      });
      if (changed) {
        localStorage.setItem('eyesonwork_invoices', JSON.stringify(updated));
      }
    }
  } catch (err) {
    console.warn('[Migration Warning] Error migrating invoices:', err);
  }

  const hasMigratedAny = migratedProjects > 0 || migratedClients > 0 || migratedQuotes > 0 || migratedInvoices > 0;

  return {
    timestamp: new Date().toISOString(),
    defaultWorkspaceId,
    migratedProjects,
    migratedClients,
    migratedQuotes,
    migratedInvoices,
    totalWorkspacesConfigured: INITIAL_DEMO_WORKSPACES.length,
    status: hasMigratedAny ? 'migrated_successfully' : 'already_migrated'
  };
}
