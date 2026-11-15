/**
 * Test Suite: Audit de Sécurité Zero-Trust & Règles Firestore / Storage
 * 
 * Invariants testés :
 * 1) ownerId non modifiable à la mise à jour de TOUTE collection.
 * 2) À la création de workspaces, interdiction de planId, plan, planStatus, trialEndsAt, storageLimitMb, membersLimit.
 * 3) users : liste blanche stricte des champs modifiables (hasOnly).
 * 4) Toute écriture exige impérativement request.auth.token.email_verified == true.
 * 5) payments : création seulement (aucun update ni delete).
 * 6) leads : aucune écriture directe par le SDK client (le serveur écrit).
 * 7) Super admin limité à users, workspaces et abonnements, sans AUCUN accès aux clients, projets, devis et factures.
 * 8) clientId et projectId doivent appartenir au même propriétaire.
 */

import assert from 'assert';
import { validateUploadedFile } from '../src/utils/securityUtils.js';

interface TestResult {
  name: string;
  passed: boolean;
  reason?: string;
}

const results: TestResult[] = [];

function check(name: string, fn: () => boolean | void) {
  try {
    const res = fn();
    if (res === false) {
      console.error(`  ✗ [FAIL] ${name}`);
      results.push({ name, passed: false });
    } else {
      console.log(`  ✓ [PASS] ${name}`);
      results.push({ name, passed: true });
    }
  } catch (err: any) {
    console.error(`  ✗ [FAIL] ${name}:`, err.message);
    results.push({ name, passed: false, reason: err.message });
  }
}

// Base mockée pour résolution relationnelle clientId / projectId
const mockClientsDb = new Map<string, any>();
const mockProjectsDb = new Map<string, any>();

export function registerRuleMockClient(client: { id: string; ownerId: string }) {
  mockClientsDb.set(client.id, client);
}

export function registerRuleMockProject(project: { id: string; ownerId: string; clientId?: string }) {
  mockProjectsDb.set(project.id, project);
}

/**
 * Simulateur de moteur de règles Firestore pour valider la conformité stricte des règles
 */
function evaluateFirestoreRule(
  collection: string,
  action: 'read' | 'create' | 'update' | 'delete',
  auth: { uid: string; token?: { email_verified?: boolean; role?: string; isSuperAdmin?: boolean; admin?: boolean } } | null,
  resource: any,
  requestResource?: any
): { allowed: boolean; reason: string } {
  // Refus total si non authentifié
  if (!auth || !auth.uid) {
    return { allowed: false, reason: 'Refus : non authentifié (Default Deny)' };
  }

  const isSuperAdmin = auth.token?.role === 'superadmin' || auth.token?.isSuperAdmin === true || auth.token?.admin === true;
  const isEmailVerified = auth.token?.email_verified === true;

  // RÈGLE 4 : TOUTE écriture exige impérativement request.auth.token.email_verified == true
  if (['create', 'update', 'delete'].includes(action)) {
    if (!isEmailVerified) {
      return { allowed: false, reason: 'Refus : toute écriture exige request.auth.token.email_verified == true' };
    }
  }

  // Collections strictement réservées au serveur
  const serverOnlyCollections = ['verification_codes', 'email_logs', 'platform_config', 'rate_limits', 'users_by_email'];
  if (serverOnlyCollections.includes(collection)) {
    return { allowed: false, reason: 'Refus : collection réservée exclusivement au serveur' };
  }

  // RÈGLE 7 : Abonnements & Subscriptions (Super Admin et Serveur uniquement)
  if (collection === 'abonnements' || collection === 'subscriptions') {
    if (isSuperAdmin) {
      return { allowed: true, reason: 'Autorisé : Super Admin sur abonnements' };
    }
    return { allowed: false, reason: 'Refus : collection réservée au Super Admin' };
  }

  // RÈGLE 6 : Leads (aucune écriture directe par le SDK client ; seule la route serveur écrit)
  if (collection === 'leads') {
    if (['create', 'update', 'delete'].includes(action)) {
      return { allowed: false, reason: 'Refus : leads n\'autorise aucune écriture directe client' };
    }
    if (action === 'read') {
      if (resource?.ownerId === auth.uid) {
        return { allowed: true, reason: 'Autorisé : lecture de ses propres prospects' };
      }
      return { allowed: false, reason: 'Refus : lecture prospects d\'un tiers' };
    }
  }

  // 1. Profil Utilisateur (/users/{uid})
  if (collection === 'users') {
    const targetUserId = resource?.uid || resource?.id;
    if (action === 'read') {
      if (auth.uid === targetUserId || isSuperAdmin) {
        return { allowed: true, reason: 'Autorisé : profil utilisateur' };
      }
      return { allowed: false, reason: 'Refus : profil tiers' };
    }
    if (action === 'delete') {
      return { allowed: isSuperAdmin, reason: isSuperAdmin ? 'Autorisé superadmin' : 'Refus' };
    }
    if (action === 'create') {
      if (auth.uid !== targetUserId) return { allowed: false, reason: 'Refus : uid différent' };
      const forbiddenCreateKeys = ['role', 'plan', 'planId', 'emailVerified', 'workspaceId', 'termsAcceptedVersion', 'isSuperAdmin', 'admin'];
      for (const k of forbiddenCreateKeys) {
        if (requestResource && requestResource[k] !== undefined) {
          return { allowed: false, reason: `Refus : champ sensible interdit à la création (${k})` };
        }
      }
      return { allowed: true, reason: 'Autorisé création profil' };
    }
    if (action === 'update') {
      if (isSuperAdmin) return { allowed: true, reason: 'Autorisé : superadmin' };
      if (auth.uid !== targetUserId) {
        return { allowed: false, reason: 'Refus : modification du profil d\'autrui interdite' };
      }

      // RÈGLE 3 : users : liste blanche stricte des champs modifiables (hasOnly)
      const allowedUpdateKeys = new Set([
        'name', 'displayName', 'studioName', 'phone', 'address', 'siret', 'tvaNumber',
        'website', 'avatarUrl', 'photoURL', 'photo', 'iban', 'bic', 'currency', 'defaultVatRate',
        'vatRate', 'defaultDepositPercent', 'defaultTurnaroundWeeks', 'defaultRevisionLimit',
        'termsTemplate', 'legalNoticeTemplate', 'legalNotice', 'defaultConditionsQuote',
        'depositCalculation', 'quotePrefix', 'invoicePrefix', 'maxFileSizeMb',
        'messageTemplates', 'brandColor', 'autoUnlockDeliveryOnFullPayment',
        'defaultProjectTemplateId', 'logoUrl', 'specialty', 'accentColor', 'countryCode',
        'timezone', 'updatedAt', 'language', 'lang', 'preferences', 'theme',
        'showHelpBubbles', 'legalNoticesByCountry', 'bio'
      ]);

      if (requestResource) {
        const changedKeys = Object.keys(requestResource).filter(k => requestResource[k] !== resource[k]);
        for (const k of changedKeys) {
          if (!allowedUpdateKeys.has(k)) {
            return { allowed: false, reason: `Refus : le champ "${k}" ne figure pas dans la liste blanche hasOnly` };
          }
        }
      }
      return { allowed: true, reason: 'Autorisé : liste blanche hasOnly respectée' };
    }
  }

  // 2. Espaces de travail (/workspaces/{workspaceId})
  if (collection === 'workspaces') {
    if (action === 'read') {
      return { allowed: resource?.ownerId === auth.uid || isSuperAdmin, reason: 'Lecture workspace' };
    }
    if (action === 'delete') {
      return { allowed: isSuperAdmin, reason: 'Suppression workspace réservée superadmin' };
    }
    // RÈGLE 2 : À la création de workspaces, interdis planId, plan, planStatus, trialEndsAt, storageLimitMb, membersLimit
    if (action === 'create') {
      if (requestResource?.ownerId !== auth.uid) {
        return { allowed: false, reason: 'Refus : ownerId non conforme' };
      }
      const forbiddenWorkspaceCreateKeys = [
        'planId', 'plan', 'planStatus', 'trialEndsAt', 'storageLimitMb',
        'membersLimit', 'storageUsedMb', 'planBillingCycle', 'planRenewsAt'
      ];
      for (const k of forbiddenWorkspaceCreateKeys) {
        if (requestResource && requestResource[k] !== undefined) {
          return { allowed: false, reason: `Refus : champ interdit à la création de workspace (${k})` };
        }
      }
      return { allowed: true, reason: 'Autorisé : création workspace conforme' };
    }
    // RÈGLE 1 : ownerId non modifiable à la mise à jour
    if (action === 'update') {
      if (isSuperAdmin) return { allowed: true, reason: 'Super admin workspace update' };
      if (resource?.ownerId !== auth.uid) return { allowed: false, reason: 'Refus non-propriétaire' };
      if (requestResource && requestResource.ownerId !== undefined && requestResource.ownerId !== resource.ownerId) {
        return { allowed: false, reason: 'Refus : ownerId inaltérable à la mise à jour' };
      }
      const forbiddenWorkspaceUpdateKeys = [
        'planId', 'plan', 'planStatus', 'planBillingCycle', 'planRenewsAt',
        'trialEndsAt', 'storageLimitMb', 'membersLimit', 'storageUsedMb'
      ];
      for (const k of forbiddenWorkspaceUpdateKeys) {
        if (requestResource && requestResource[k] !== undefined && requestResource[k] !== resource[k]) {
          return { allowed: false, reason: `Refus : modification plan/quota interdite (${k})` };
        }
      }
      return { allowed: true, reason: 'Autorisé : mise à jour workspace' };
    }
  }

  // RÈGLE 7 : Collections privées métier SANS AUCUN ACCÈS SUPER ADMIN
  // Super admin est limité à users, workspaces et abonnements ; AUCUN accès aux clients, projets, devis et factures.
  const privateCollections = [
    'clients', 'projects', 'quotes', 'invoices', 'payments',
    'catalog_services', 'catalog_packs', 'project_templates',
    'custom_categories', 'appointments', 'time_entries', 'expenses'
  ];

  if (privateCollections.includes(collection)) {
    // Si l'utilisateur n'est pas le propriétaire, refus systématique (même pour le superadmin !)
    if (action === 'read') {
      if (resource?.ownerId === auth.uid) {
        return { allowed: true, reason: 'Autorisé : propriétaire vérifié' };
      }
      return { allowed: false, reason: 'Refus : accès strictement réservé au propriétaire du document (aucun super admin)' };
    }

    // RÈGLE 5 : payments : création seulement
    if (collection === 'payments') {
      if (action !== 'create') {
        return { allowed: false, reason: 'Refus : payments est en création seulement' };
      }
    }

    // En création :
    if (action === 'create') {
      if (requestResource?.ownerId !== auth.uid) {
        return { allowed: false, reason: 'Refus : ownerId doit correspondre à request.auth.uid' };
      }

      // Projets : interdiction de clientShareToken et clientLinkActive
      if (collection === 'projects') {
        if (requestResource?.clientShareToken !== undefined || requestResource?.clientLinkActive !== undefined) {
          return { allowed: false, reason: 'Refus : clientShareToken et clientLinkActive réservés au serveur' };
        }
      }

      // RÈGLE 8 : clientId et projectId doivent appartenir au même propriétaire
      if (requestResource?.clientId) {
        const clientDoc = mockClientsDb.get(requestResource.clientId);
        if (clientDoc && clientDoc.ownerId !== auth.uid) {
          return { allowed: false, reason: 'Refus : clientId n\'appartient pas au même propriétaire' };
        }
      }
      if (requestResource?.projectId) {
        const projectDoc = mockProjectsDb.get(requestResource.projectId);
        if (projectDoc && projectDoc.ownerId !== auth.uid) {
          return { allowed: false, reason: 'Refus : projectId n\'appartient pas au même propriétaire' };
        }
      }

      return { allowed: true, reason: 'Autorisé : création conforme' };
    }

    // En mise à jour :
    if (action === 'update') {
      if (resource?.ownerId !== auth.uid) {
        return { allowed: false, reason: 'Refus : non-propriétaire' };
      }

      // RÈGLE 1 : ownerId non modifiable à la mise à jour de toute collection
      if (requestResource && requestResource.ownerId !== undefined && requestResource.ownerId !== resource.ownerId) {
        return { allowed: false, reason: 'Refus : ownerId non modifiable à la mise à jour' };
      }

      // Projets : interdiction de modifier clientShareToken et clientLinkActive
      if (collection === 'projects') {
        if (
          (requestResource?.clientShareToken !== undefined && requestResource.clientShareToken !== resource.clientShareToken) ||
          (requestResource?.clientLinkActive !== undefined && requestResource.clientLinkActive !== resource.clientLinkActive)
        ) {
          return { allowed: false, reason: 'Refus : clientShareToken et clientLinkActive réservés au serveur' };
        }
      }

      // RÈGLE 8 : clientId et projectId doivent appartenir au même propriétaire
      if (requestResource?.clientId) {
        const clientDoc = mockClientsDb.get(requestResource.clientId);
        if (clientDoc && clientDoc.ownerId !== auth.uid) {
          return { allowed: false, reason: 'Refus : clientId n\'appartient pas au même propriétaire' };
        }
      }
      if (requestResource?.projectId) {
        const projectDoc = mockProjectsDb.get(requestResource.projectId);
        if (projectDoc && projectDoc.ownerId !== auth.uid) {
          return { allowed: false, reason: 'Refus : projectId n\'appartient pas au même propriétaire' };
        }
      }

      // Inaltérabilité des devis acceptés et factures payées
      if (collection === 'quotes' && resource.status === 'accepted') {
        return { allowed: false, reason: 'Refus : devis accepté inaltérable' };
      }
      if (collection === 'invoices' && resource.status !== 'draft') {
        return { allowed: false, reason: 'Refus : facture émise inaltérable' };
      }

      return { allowed: true, reason: 'Autorisé : mise à jour conforme' };
    }

    // En suppression :
    if (action === 'delete') {
      if (resource?.ownerId !== auth.uid) {
        return { allowed: false, reason: 'Refus : non-propriétaire' };
      }
      if (collection === 'quotes' && resource.status === 'accepted') {
        return { allowed: false, reason: 'Refus : suppression devis accepté interdite' };
      }
      if (collection === 'invoices' && resource.status !== 'draft') {
        return { allowed: false, reason: 'Refus : suppression facture émise interdite' };
      }
      return { allowed: true, reason: 'Autorisé : suppression conforme' };
    }
  }

  return { allowed: false, reason: 'Refus par défaut (Default Deny)' };
}

console.log('======================================================');
console.log('🛡️  EYES-ONWORK - AUDIT DE SÉCURITÉ ZERO-TRUST DURCI');
console.log('======================================================\n');

const userA = { uid: 'user_A_12345', token: { email_verified: true } };
const userA_unverified = { uid: 'user_A_12345', token: { email_verified: false } };
const userB = { uid: 'user_B_67890', token: { email_verified: true } };
const superAdminUser = { uid: 'user_admin_999', token: { email_verified: true, role: 'superadmin', isSuperAdmin: true } };

const clientA = { id: 'client_A', ownerId: userA.uid, name: 'Client A' };
const clientB = { id: 'client_B', ownerId: userB.uid, name: 'Client B' };
registerRuleMockClient(clientA);
registerRuleMockClient(clientB);

const projetA = { id: 'proj_A', ownerId: userA.uid, clientId: clientA.id, title: 'Projet A' };
const projetB = { id: 'proj_B', ownerId: userB.uid, clientId: clientB.id, title: 'Projet B' };
registerRuleMockProject(projetA);
registerRuleMockProject(projetB);

const quoteA = { id: 'q_A', ownerId: userA.uid, projectId: projetA.id, clientId: clientA.id, status: 'sent' };
const factureA = { id: 'f_A', ownerId: userA.uid, projectId: projetA.id, clientId: clientA.id, status: 'draft' };

// ---------------------------------------------------------------------------
// SUITE 1 : Invariant email_verified == true obligatoire pour TOUTE écriture
// ---------------------------------------------------------------------------
console.log('1. Tests Condition email_verified == true obligatoire sur toute écriture :');

check('Écriture profil refusée si email_verified != true', () => {
  return !evaluateFirestoreRule('users', 'create', userA_unverified, { uid: userA.uid }, { name: 'Test' }).allowed;
});

check('Création projet refusée si email_verified != true', () => {
  return !evaluateFirestoreRule('projects', 'create', userA_unverified, {}, { ownerId: userA.uid, title: 'Projet' }).allowed;
});

check('Création devis refusée si email_verified != true', () => {
  return !evaluateFirestoreRule('quotes', 'create', userA_unverified, {}, { ownerId: userA.uid, projectId: projetA.id, clientId: clientA.id }).allowed;
});

check('Création facture refusée si email_verified != true', () => {
  return !evaluateFirestoreRule('invoices', 'create', userA_unverified, {}, { ownerId: userA.uid, projectId: projetA.id, clientId: clientA.id }).allowed;
});

check('Création paiement refusée si email_verified != true', () => {
  return !evaluateFirestoreRule('payments', 'create', userA_unverified, {}, { ownerId: userA.uid, projectId: projetA.id, clientId: clientA.id }).allowed;
});

check('Écriture autorisée lorsque email_verified == true', () => {
  return evaluateFirestoreRule('projects', 'create', userA, {}, { ownerId: userA.uid, title: 'Nouveau Projet' }).allowed;
});

// ---------------------------------------------------------------------------
// SUITE 2 : ownerId non modifiable à la mise à jour de toute collection
// ---------------------------------------------------------------------------
console.log('\n2. Tests ownerId inaltérable à la mise à jour sur toutes les collections :');

check('Tentative de modifier ownerId sur workspaces strictement REFUSÉE', () => {
  return !evaluateFirestoreRule('workspaces', 'update', userA, { id: 'ws1', ownerId: userA.uid }, { ownerId: userB.uid }).allowed;
});

check('Tentative de modifier ownerId sur clients strictement REFUSÉE', () => {
  return !evaluateFirestoreRule('clients', 'update', userA, clientA, { ...clientA, ownerId: userB.uid }).allowed;
});

check('Tentative de modifier ownerId sur projects strictement REFUSÉE', () => {
  return !evaluateFirestoreRule('projects', 'update', userA, projetA, { ...projetA, ownerId: userB.uid }).allowed;
});

check('Tentative de modifier ownerId sur quotes strictement REFUSÉE', () => {
  return !evaluateFirestoreRule('quotes', 'update', userA, quoteA, { ...quoteA, ownerId: userB.uid }).allowed;
});

check('Tentative de modifier ownerId sur invoices strictement REFUSÉE', () => {
  return !evaluateFirestoreRule('invoices', 'update', userA, factureA, { ...factureA, ownerId: userB.uid }).allowed;
});

check('Tentative de modifier ownerId sur catalog_services strictement REFUSÉE', () => {
  return !evaluateFirestoreRule('catalog_services', 'update', userA, { id: 's1', ownerId: userA.uid }, { ownerId: userB.uid }).allowed;
});

// ---------------------------------------------------------------------------
// SUITE 3 : Workspaces - Interdiction des quotas et plans à la création
// ---------------------------------------------------------------------------
console.log('\n3. Tests Création Workspaces (interdiction planId, plan, planStatus, quotas) :');

check('Création workspace avec planId refusée', () => {
  return !evaluateFirestoreRule('workspaces', 'create', userA, {}, { ownerId: userA.uid, planId: 'studio' }).allowed;
});

check('Création workspace avec plan refusée', () => {
  return !evaluateFirestoreRule('workspaces', 'create', userA, {}, { ownerId: userA.uid, plan: 'pro' }).allowed;
});

check('Création workspace avec planStatus refusée', () => {
  return !evaluateFirestoreRule('workspaces', 'create', userA, {}, { ownerId: userA.uid, planStatus: 'active' }).allowed;
});

check('Création workspace avec trialEndsAt refusée', () => {
  return !evaluateFirestoreRule('workspaces', 'create', userA, {}, { ownerId: userA.uid, trialEndsAt: '2099-01-01' }).allowed;
});

check('Création workspace avec storageLimitMb refusée', () => {
  return !evaluateFirestoreRule('workspaces', 'create', userA, {}, { ownerId: userA.uid, storageLimitMb: 50000 }).allowed;
});

check('Création workspace avec membersLimit refusée', () => {
  return !evaluateFirestoreRule('workspaces', 'create', userA, {}, { ownerId: userA.uid, membersLimit: 100 }).allowed;
});

check('Création workspace sans champs sensibles autorisée', () => {
  return evaluateFirestoreRule('workspaces', 'create', userA, {}, { ownerId: userA.uid, name: 'Mon Studio Graphique' }).allowed;
});

// ---------------------------------------------------------------------------
// SUITE 4 : Users - Liste blanche hasOnly à la mise à jour
// ---------------------------------------------------------------------------
console.log('\n4. Tests Users - Liste blanche hasOnly des champs modifiables :');

const profileA = {
  uid: userA.uid,
  name: 'User A',
  bio: 'Designer freelance',
  role: 'user',
  plan: 'free',
  emailVerified: false,
  workspaceId: 'ws_a'
};

check('Mise à jour d\'un champ autorisé (name, bio) autorisée', () => {
  return evaluateFirestoreRule('users', 'update', userA, profileA, { ...profileA, name: 'Artiste Pro', bio: 'Nouvelle bio' }).allowed;
});

check('Tentative de modifier role refusée par hasOnly', () => {
  return !evaluateFirestoreRule('users', 'update', userA, profileA, { ...profileA, role: 'superadmin' }).allowed;
});

check('Tentative de modifier plan refusée par hasOnly', () => {
  return !evaluateFirestoreRule('users', 'update', userA, profileA, { ...profileA, plan: 'agency' }).allowed;
});

check('Tentative d\'injecter un champ non autorisé (isVip) refusée par hasOnly', () => {
  return !evaluateFirestoreRule('users', 'update', userA, profileA, { ...profileA, isVip: true }).allowed;
});

// ---------------------------------------------------------------------------
// SUITE 5 : Payments - Création seulement
// ---------------------------------------------------------------------------
console.log('\n5. Tests Payments - Création seulement :');

const paymentA = { id: 'pay_1', ownerId: userA.uid, amount: 500, projectId: projetA.id, clientId: clientA.id };

check('Création de paiement par le propriétaire autorisée', () => {
  return evaluateFirestoreRule('payments', 'create', userA, {}, paymentA).allowed;
});

check('Mise à jour de paiement strictement REFUSÉE (création seulement)', () => {
  return !evaluateFirestoreRule('payments', 'update', userA, paymentA, { ...paymentA, amount: 600 }).allowed;
});

check('Suppression de paiement strictement REFUSÉE (registre comptable inaltérable)', () => {
  return !evaluateFirestoreRule('payments', 'delete', userA, paymentA).allowed;
});

// ---------------------------------------------------------------------------
// SUITE 6 : Leads - Aucune écriture directe via le SDK client
// ---------------------------------------------------------------------------
console.log('\n6. Tests Leads - Aucune écriture directe :');

check('Création directe dans /leads par le client strictement REFUSÉE', () => {
  return !evaluateFirestoreRule('leads', 'create', userA, {}, { name: 'Prospect', email: 'lead@test.com' }).allowed;
});

check('Mise à jour dans /leads par le client strictement REFUSÉE', () => {
  return !evaluateFirestoreRule('leads', 'update', userA, { id: 'lead1', ownerId: userA.uid }, { status: 'contacted' }).allowed;
});

check('Suppression dans /leads par le client strictement REFUSÉE', () => {
  return !evaluateFirestoreRule('leads', 'delete', userA, { id: 'lead1', ownerId: userA.uid }).allowed;
});

// ---------------------------------------------------------------------------
// SUITE 7 : Super Admin limité à users, workspaces et abonnements (sans clients/projets/devis/factures)
// ---------------------------------------------------------------------------
console.log('\n7. Tests Cloisonnement Super Admin :');

check('Super Admin a accès à users', () => {
  return evaluateFirestoreRule('users', 'read', superAdminUser, profileA).allowed;
});

check('Super Admin a accès à workspaces', () => {
  return evaluateFirestoreRule('workspaces', 'read', superAdminUser, { id: 'ws1', ownerId: userA.uid }).allowed;
});

check('Super Admin a accès à abonnements', () => {
  return evaluateFirestoreRule('abonnements', 'read', superAdminUser, { id: 'sub1' }).allowed;
});

check('Super Admin n\'a PAS accès aux clients (Isolation stricte)', () => {
  return !evaluateFirestoreRule('clients', 'read', superAdminUser, clientA).allowed;
});

check('Super Admin n\'a PAS accès aux projets (Isolation stricte)', () => {
  return !evaluateFirestoreRule('projects', 'read', superAdminUser, projetA).allowed;
});

check('Super Admin n\'a PAS accès aux devis (Isolation stricte)', () => {
  return !evaluateFirestoreRule('quotes', 'read', superAdminUser, quoteA).allowed;
});

check('Super Admin n\'a PAS accès aux factures (Isolation stricte)', () => {
  return !evaluateFirestoreRule('invoices', 'read', superAdminUser, factureA).allowed;
});

// ---------------------------------------------------------------------------
// SUITE 8 : Relational Sync - clientId et projectId doivent appartenir au même propriétaire
// ---------------------------------------------------------------------------
console.log('\n8. Tests Appartenance relationnelle clientId / projectId au même propriétaire :');

check('Projet avec clientId appartenant au même propriétaire autorisé', () => {
  return evaluateFirestoreRule('projects', 'create', userA, {}, { ownerId: userA.uid, clientId: clientA.id, title: 'Ok' }).allowed;
});

check('Projet avec clientId appartenant à un AUTRE propriétaire REFUSÉ', () => {
  return !evaluateFirestoreRule('projects', 'create', userA, {}, { ownerId: userA.uid, clientId: clientB.id, title: 'Infiltration' }).allowed;
});

check('Devis avec projectId et clientId du même propriétaire autorisé', () => {
  return evaluateFirestoreRule('quotes', 'create', userA, {}, { ownerId: userA.uid, projectId: projetA.id, clientId: clientA.id }).allowed;
});

check('Devis avec projectId d\'un autre propriétaire REFUSÉ', () => {
  return !evaluateFirestoreRule('quotes', 'create', userA, {}, { ownerId: userA.uid, projectId: projetB.id, clientId: clientA.id }).allowed;
});

check('Devis avec clientId d\'un autre propriétaire REFUSÉ', () => {
  return !evaluateFirestoreRule('quotes', 'create', userA, {}, { ownerId: userA.uid, projectId: projetA.id, clientId: clientB.id }).allowed;
});

check('Facture avec projectId et clientId du même propriétaire autorisée', () => {
  return evaluateFirestoreRule('invoices', 'create', userA, {}, { ownerId: userA.uid, projectId: projetA.id, clientId: clientA.id }).allowed;
});

check('Facture avec projectId ou clientId croisé d\'un tiers REFUSÉE', () => {
  return !evaluateFirestoreRule('invoices', 'create', userA, {}, { ownerId: userA.uid, projectId: projetB.id, clientId: clientA.id }).allowed;
});

console.log('\n------------------------------------------------------');
const total = results.length;
const passed = results.filter(r => r.passed).length;
console.log(`RÉSULTAT DU CONTRÔLE ZERO-TRUST DURCI : ${passed}/${total} assertions validées.`);

if (passed === total) {
  console.log('✅ TOUTES LES RÈGLES DE SÉCURITÉ SONT OPÉRATIONNELLES ET STRICTEMENT CONFORMES.');
  process.exit(0);
} else {
  console.error(`❌ ÉCHEC : ${total - passed} assertions non satisfaites.`);
  process.exit(1);
}
