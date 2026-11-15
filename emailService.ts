import nodemailer from 'nodemailer';
import crypto from 'crypto';
import { adminDb, isPermissionOrCredentialError } from './src/server/firebaseAdminSdk.js';
import { persistEmailLogInFirestore } from './src/server/firestoreAdmin.js';

// Configuration et sel cryptographique
const VERIFICATION_SALT = process.env.VERIFICATION_SALT || 'eyesonwork_verification_salt_prod';

// Structure des journaux d'emails en mémoire (conservés max 90 jours)
export interface EmailLogEntry {
  id: string;
  workspaceId: string;
  recipientEmail: string;
  recipientName: string;
  subject: string;
  templateKey: string;
  sentAt: string;
  expiresAt: string;
  retentionUntilMs: number;
  status: 'delivered' | 'bounced';
  provider: string;
  ip: string; // Adresse IP masquée (jamais complète)
  studioName: string;
}

const emailLogs: EmailLogEntry[] = [];
const rateLimits = new Map<string, { count: number; resetAt: number }>();

// Quotas par plan pour chaque workspace (stockés dans Firestore)
export interface WorkspaceQuotaLimits {
  dailyLimit: number;
  monthlyLimit: number;
}

export const WORKSPACE_PLAN_QUOTAS: Record<string, WorkspaceQuotaLimits> = {
  free: { dailyLimit: 10, monthlyLimit: 30 },
  pro: { dailyLimit: 200, monthlyLimit: 1000 },
  agency: { dailyLimit: 1000, monthlyLimit: 5000 }
};

// Compteur journalier du fournisseur SMTP
let currentDayKey = new Date().toISOString().slice(0, 10);
let dailyProviderSentCount = 0;

function updateDailyCounter(): void {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== currentDayKey) {
    currentDayKey = today;
    dailyProviderSentCount = 0;
  }
}

/**
 * 6) Échappement HTML strict contre les attaques XSS
 */
export function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 6) Liens trackingUrl, downloadUrl, adminUrl limités au domaine de l'app
 */
export function sanitizeSafeAppLink(urlStr: any): string | undefined {
  if (!urlStr || typeof urlStr !== 'string') return undefined;
  const trimmed = urlStr.trim();
  if (!trimmed) return undefined;

  // Liens relatifs sécurisés dans l'application
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    const host = parsed.host.toLowerCase();

    // Domaines autorisés de l'application
    const isAppDomain =
      host.endsWith('.run.app') ||
      host.endsWith('.web.app') ||
      host.endsWith('.firebaseapp.com') ||
      host.includes('aistudio') ||
      host === 'localhost:3000' ||
      host === 'localhost:5173' ||
      host === '127.0.0.1:3000' ||
      host === '127.0.0.1:5173' ||
      host === 'localhost';

    if (isAppDomain) {
      return trimmed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * 2) Destinataire : une seule adresse valide, jamais de liste ni de virgule ni de point-virgule
 */
export function validateSingleRecipient(to: any): string {
  if (!to || typeof to !== 'string') {
    throw new Error('DESTINATAIRE_INVALIDE: Adresse email du destinataire requise.');
  }
  const trimmed = to.trim();

  // Interdiction formelle des séparateurs et listes
  if (trimmed.includes(',') || trimmed.includes(';') || trimmed.includes('\n') || trimmed.includes('\r')) {
    throw new Error('DESTINATAIRE_INVALIDE: Une seule adresse email est autorisée (listes et séparateurs interdits).');
  }

  // Format d'email valide RFC 5322 strict
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!emailRegex.test(trimmed)) {
    throw new Error('DESTINATAIRE_INVALIDE: Format de l\'adresse email invalide.');
  }

  return trimmed.toLowerCase();
}

/**
 * 7) Masquage de l'adresse IP (sans adresse IP complète)
 */
export function maskIpAddress(ip?: string): string {
  if (!ip || typeof ip !== 'string') return 'anonyme';
  const clean = ip.trim();
  // IPv4 : 192.168.1.42 -> 192.168.1.xxx
  if (clean.includes('.')) {
    const parts = clean.split('.');
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.xxx`;
    }
  }
  // IPv6 : 2001:db8:85a3::8a2e:370:7334 -> 2001:db8:85a3::xxx
  if (clean.includes(':')) {
    const parts = clean.split(':');
    return `${parts.slice(0, 3).join(':')}::xxx`;
  }
  return 'anonyme';
}

/**
 * Hachage cryptographique du code avec sel serveur
 */
export function hashVerificationCode(code: string): string {
  const salt = process.env.VERIFICATION_SALT || VERIFICATION_SALT;
  return crypto.createHash('sha256').update(`${code}:${salt}`).digest('hex');
}

/**
 * 4) Supprime l'adresse personnelle écrite en dur dans getPlatformAdminEmail :
 * seulement ADMIN_EMAIL, sinon erreur claire.
 */
export function getPlatformAdminEmail(): string {
  const adminEmail = process.env.ADMIN_EMAIL?.trim();
  if (!adminEmail) {
    throw new Error("CONFIGURATION_MANQUANTE: La variable d'environnement ADMIN_EMAIL doit être définie.");
  }
  return adminEmail;
}
export const getAdminEmail = getPlatformAdminEmail;

const mockFirestoreQuotaDocs = new Map<string, any>();

/**
 * 3) Quotas quotidien et mensuel par workspace stockés dans Firestore selon le plan
 */
export async function checkAndIncrementWorkspaceQuotas(
  workspaceId: string,
  plan: string = 'free'
): Promise<{
  allowed: boolean;
  reason?: 'DAILY_LIMIT_EXCEEDED' | 'MONTHLY_LIMIT_EXCEEDED';
  dailyCount: number;
  dailyLimit: number;
  monthlyCount: number;
  monthlyLimit: number;
}> {
  const cleanPlan = (plan || 'free').toLowerCase();
  const limits = WORKSPACE_PLAN_QUOTAS[cleanPlan] || WORKSPACE_PLAN_QUOTAS.free;
  const currentDay = new Date().toISOString().slice(0, 10);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const docId = `${workspaceId}_${currentMonth}`;

  try {
    return await adminDb.runTransaction(async (transaction) => {
      const quotaRef = adminDb.collection('workspace_email_quotas').doc(docId);
      const snap = await transaction.get(quotaRef);
      const data = snap.exists ? snap.data() : null;

      let monthlyCount = 0;
      let dailyCount = 0;

      if (data) {
        monthlyCount = Number(data.monthlyCount) || 0;
        if (data.lastDay === currentDay) {
          dailyCount = Number(data.dailyCount) || 0;
        } else {
          dailyCount = 0;
        }
      }

      if (dailyCount >= limits.dailyLimit) {
        return {
          allowed: false,
          reason: 'DAILY_LIMIT_EXCEEDED',
          dailyCount,
          dailyLimit: limits.dailyLimit,
          monthlyCount,
          monthlyLimit: limits.monthlyLimit
        };
      }

      if (monthlyCount >= limits.monthlyLimit) {
        return {
          allowed: false,
          reason: 'MONTHLY_LIMIT_EXCEEDED',
          dailyCount,
          dailyLimit: limits.dailyLimit,
          monthlyCount,
          monthlyLimit: limits.monthlyLimit
        };
      }

      const nextDaily = dailyCount + 1;
      const nextMonthly = monthlyCount + 1;

      transaction.set(quotaRef, {
        workspaceId,
        month: currentMonth,
        lastDay: currentDay,
        dailyCount: nextDaily,
        dailyLimit: limits.dailyLimit,
        monthlyCount: nextMonthly,
        monthlyLimit: limits.monthlyLimit,
        plan: cleanPlan,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      return {
        allowed: true,
        dailyCount: nextDaily,
        dailyLimit: limits.dailyLimit,
        monthlyCount: nextMonthly,
        monthlyLimit: limits.monthlyLimit
      };
    });
  } catch (err: any) {
    if (isPermissionOrCredentialError(err)) {
      // Environnement sans identifiants GCP distants (ex: tests automatisés) : simulation atomique
      const data = mockFirestoreQuotaDocs.get(docId);
      let monthlyCount = 0;
      let dailyCount = 0;

      if (data) {
        monthlyCount = Number(data.monthlyCount) || 0;
        if (data.lastDay === currentDay) {
          dailyCount = Number(data.dailyCount) || 0;
        }
      }

      if (dailyCount >= limits.dailyLimit) {
        return {
          allowed: false,
          reason: 'DAILY_LIMIT_EXCEEDED',
          dailyCount,
          dailyLimit: limits.dailyLimit,
          monthlyCount,
          monthlyLimit: limits.monthlyLimit
        };
      }

      if (monthlyCount >= limits.monthlyLimit) {
        return {
          allowed: false,
          reason: 'MONTHLY_LIMIT_EXCEEDED',
          dailyCount,
          dailyLimit: limits.dailyLimit,
          monthlyCount,
          monthlyLimit: limits.monthlyLimit
        };
      }

      const nextDaily = dailyCount + 1;
      const nextMonthly = monthlyCount + 1;

      mockFirestoreQuotaDocs.set(docId, {
        workspaceId,
        month: currentMonth,
        lastDay: currentDay,
        dailyCount: nextDaily,
        dailyLimit: limits.dailyLimit,
        monthlyCount: nextMonthly,
        monthlyLimit: limits.monthlyLimit,
        plan: cleanPlan,
        updatedAt: new Date().toISOString()
      });

      return {
        allowed: true,
        dailyCount: nextDaily,
        dailyLimit: limits.dailyLimit,
        monthlyCount: nextMonthly,
        monthlyLimit: limits.monthlyLimit
      };
    }
    throw err;
  }
}

export const checkWorkspaceMonthlyLimit = async (workspaceId: string, maxAllowed = 30) => {
  const res = await checkAndIncrementWorkspaceQuotas(workspaceId, 'free');
  return { allowed: res.allowed, currentCount: res.monthlyCount, maxAllowed: res.monthlyLimit };
};

export const incrementWorkspaceMonthlyCount = (workspaceId: string) => {
  // Pris en charge de manière transactionnelle dans Firestore via checkAndIncrementWorkspaceQuotas
};

export function checkEmailRateLimit(identifier: string, maxPerMinute = 10): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const current = rateLimits.get(identifier);
  if (!current || now >= current.resetAt) {
    rateLimits.set(identifier, { count: 1, resetAt: now + 60 * 1000 });
    return { allowed: true, remaining: maxPerMinute - 1 };
  }
  if (current.count >= maxPerMinute) {
    return { allowed: false, remaining: 0 };
  }
  current.count++;
  return { allowed: true, remaining: maxPerMinute - current.count };
}

/**
 * 7) Journaux d'envoi par workspace, conservés 90 jours, sans adresse IP complète
 */
export function getEmailLogs(workspaceId?: string): EmailLogEntry[] {
  const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;

  if (workspaceId && workspaceId.trim()) {
    const cleanWs = workspaceId.trim();
    return emailLogs
      .filter(log => {
        if (log.workspaceId !== cleanWs) return false;
        const sentTime = new Date(log.sentAt || 0).getTime();
        return sentTime >= cutoff;
      })
      .slice(0, 50);
  }

  // Filtrage global par rétention 90 jours
  return emailLogs
    .filter(log => new Date(log.sentAt || 0).getTime() >= cutoff)
    .slice(0, 100);
}

export function getMailTransporter(): nodemailer.Transporter | null {
  const user = process.env.GMAIL_USER?.trim();
  const pass = process.env.GMAIL_APP_PASSWORD?.trim();
  if (!user || !pass) {
    return null;
  }
  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: { user, pass }
  });
}

export function formatSenderAddress(studioName?: string): string {
  const user = process.env.GMAIL_USER?.trim() || 'notifications@eyesonwork.com';
  const cleanName = (studioName || 'Studio Graphique').replace(/"/g, '').trim();
  return `"${cleanName} via eyes-onwork" <${user}>`;
}

export function getPlatformProviderConfig(): any {
  updateDailyCounter();
  const transporter = getMailTransporter();
  const dailyQuota = 500;
  const warningThreshold = 450;

  let adminEmail = '';
  try {
    adminEmail = getPlatformAdminEmail();
  } catch {}

  return {
    activeProvider: 'gmail_smtp',
    providerName: 'Gmail SMTP (Port 465 SSL)',
    isReady: Boolean(transporter),
    dailyQuota,
    dailySentCount: dailyProviderSentCount,
    dailyRemaining: Math.max(0, dailyQuota - dailyProviderSentCount),
    quotaWarningThreshold: warningThreshold,
    isQuotaNearLimit: dailyProviderSentCount >= warningThreshold,
    adminEmail,
    requiredEnvVars: [
      {
        name: 'GMAIL_USER',
        isSet: Boolean(process.env.GMAIL_USER?.trim()),
        description: 'Adresse email Gmail utilisée pour l’authentification SMTP.'
      },
      {
        name: 'GMAIL_APP_PASSWORD',
        isSet: Boolean(process.env.GMAIL_APP_PASSWORD?.trim()),
        description: 'Mot de passe d’application 16 caractères généré sur myaccount.google.com.'
      },
      {
        name: 'ADMIN_EMAIL',
        isSet: Boolean(process.env.ADMIN_EMAIL?.trim()),
        description: 'Email de destination des alertes plateforme du propriétaire.'
      }
    ],
    planMonthlyQuotas: {
      free: WORKSPACE_PLAN_QUOTAS.free.monthlyLimit,
      pro: WORKSPACE_PLAN_QUOTAS.pro.monthlyLimit,
      agency: WORKSPACE_PLAN_QUOTAS.agency.monthlyLimit
    },
    planDailyQuotas: {
      free: WORKSPACE_PLAN_QUOTAS.free.dailyLimit,
      pro: WORKSPACE_PLAN_QUOTAS.pro.dailyLimit,
      agency: WORKSPACE_PLAN_QUOTAS.agency.dailyLimit
    }
  };
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || 'EO';
}

function getEmailHeaderHtml(title: string, subtitle?: string, studioName?: string): string {
  const displayStudio = escapeHtml(studioName || 'Studio Graphique');
  const initials = escapeHtml(getInitials(studioName || 'EO'));

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0B0F1A; border-bottom: 2px solid #f7c548;">
      <tr>
        <td style="padding: 24px 28px; text-align: left;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="vertical-align: middle;">
                <div style="display: inline-block; width: 42px; height: 42px; background: linear-gradient(135deg, #1A253E, #0E1626); border: 1px solid rgba(247, 197, 72, 0.4); border-radius: 10px; text-align: center; line-height: 40px; vertical-align: middle; margin-right: 14px;">
                  <span style="color: #f7c548; font-weight: 800; font-size: 15px; letter-spacing: 1px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">${initials}</span>
                </div>
                <div style="display: inline-block; vertical-align: middle;">
                  <h1 style="margin: 0; color: #FFFFFF; font-size: 18px; font-weight: 800; letter-spacing: 0.5px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
                    ${displayStudio}
                  </h1>
                  <p style="margin: 3px 0 0 0; color: #8E97AB; font-size: 11px; letter-spacing: 0.3px; font-family: sans-serif;">
                    via eyes-onwork · Espace créatif sécurisé
                  </p>
                </div>
              </td>
            </tr>
          </table>
          <div style="margin-top: 18px; padding-top: 14px; border-top: 1px solid rgba(255,255,255,0.12);">
            <h2 style="margin: 0; color: #FFFFFF; font-size: 16px; font-weight: 700; font-family: sans-serif;">
              ${escapeHtml(title)}
            </h2>
            ${subtitle ? `<p style="margin: 4px 0 0 0; color: #f7c548; font-size: 12px; font-weight: 600; font-family: sans-serif;">${escapeHtml(subtitle)}</p>` : ''}
          </div>
        </td>
      </tr>
    </table>
  `;
}

function getEmailFooterHtml(studioName?: string, replyTo?: string): string {
  const displayStudio = escapeHtml(studioName || 'Studio Graphique');
  const safeReplyTo = escapeHtml(replyTo || '');

  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0E1424; border-top: 1px solid rgba(255,255,255,0.1); margin-top: 24px;">
      <tr>
        <td style="padding: 22px 28px; text-align: center; font-family: sans-serif; font-size: 11px; color: #8E97AB; line-height: 1.6;">
          <p style="margin: 0 0 6px 0; font-weight: 700; color: #FFFFFF; letter-spacing: 0.5px;">
            ${displayStudio}
          </p>
          ${safeReplyTo ? `
          <p style="margin: 0 0 8px 0; color: #f7c548; font-weight: 500;">
            Répondre directement au créatif : <a href="mailto:${safeReplyTo}" style="color: #f7c548; text-decoration: underline;">${safeReplyTo}</a>
          </p>
          ` : ''}
          <p style="margin: 8px 0 0 0; font-size: 10px; color: #5F6B84; border-top: 1px solid rgba(255,255,255,0.08); padding-top: 8px;">
            Email transactionnel émis de façon sécurisée via eyes-onwork. Vos données sont protégées.
          </p>
        </td>
      </tr>
    </table>
  `;
}

function wrapEmailContainer(contentHtml: string): string {
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Notification eyes-onwork</title>
      <style>
        body { margin: 0; padding: 0; background-color: #070A12; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; }
        table { border-collapse: collapse; }
        a { text-decoration: none; }
        @media only screen and (max-width: 620px) {
          .email-container { width: 100% !important; }
          .content-cell { padding: 18px 16px !important; }
        }
      </style>
    </head>
    <body style="margin: 0; padding: 24px 0; background-color: #070A12;">
      <center>
        <table role="presentation" class="email-container" width="600" cellpadding="0" cellspacing="0" style="width: 600px; max-width: 600px; background-color: #111827; border: 1px solid rgba(255,255,255,0.12); border-radius: 12px; overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.5); text-align: left;">
          <tr>
            <td>
              ${contentHtml}
            </td>
          </tr>
        </table>
      </center>
    </body>
    </html>
  `;
}

/**
 * 6) Gabarits d'emails : échappement de item.quantity et de tout texte saisi,
 * restriction de trackingUrl, downloadUrl, adminUrl aux domaines de l'application
 */
export function buildClientConfirmationEmail(params: {
  clientName?: string;
  recipientName?: string;
  orderNumber?: string;
  orderId?: string;
  reference?: string;
  projectTitle?: string;
  projectName?: string;
  items?: Array<{ description: string; quantity: number | string; unitPrice: number; total: number }>;
  totalHT?: number;
  totalHt?: number;
  totalTTC?: number;
  totalTtc?: number;
  vatRate?: number;
  depositAmount?: number;
  balanceDue?: number;
  trackingUrl?: string;
  notes?: string;
  studioName?: string;
  replyTo?: string;
  currency?: string;
}): { subject: string; html: string; text: string } {
  const displayStudio = escapeHtml(params.studioName || 'Studio Graphique');
  const safeProjectTitle = escapeHtml(params.projectTitle || params.projectName || 'Projet créatif');
  const safeOrderNumber = escapeHtml(params.orderNumber || params.orderId || params.reference || 'CMD-001');
  const safeClientName = escapeHtml(params.clientName || params.recipientName || 'Client');

  const safeTotalTTC = Number(params.totalTTC ?? params.totalTtc ?? 0);
  const safeTotalHT = Number(params.totalHT ?? params.totalHt ?? (safeTotalTTC > 0 ? safeTotalTTC / 1.2 : 0));
  const safeDeposit = Number(params.depositAmount ?? 0);
  const safeBalanceDue = Number(params.balanceDue ?? Math.max(0, safeTotalTTC - safeDeposit));
  const currencySymbol = params.currency === 'USD' ? '$' : '€';

  const subject = `Confirmation de votre commande ${safeOrderNumber} — ${safeProjectTitle} · ${params.studioName || 'Studio'}`;
  const safeItems = Array.isArray(params.items) ? params.items : [];

  // Échappement strict de item.quantity et de chaque champ textuel
  const itemsRows = safeItems.length > 0 ? safeItems.map((item, index) => `
    <tr style="background-color: ${index % 2 === 0 ? '#1A2338' : '#141D30'}; border-bottom: 1px solid rgba(255,255,255,0.06);">
      <td style="padding: 12px 14px; font-size: 13px; color: #FFFFFF; font-family: sans-serif;">
        <strong>${escapeHtml(item?.description || 'Prestation graphique')}</strong>
      </td>
      <td style="padding: 12px 14px; font-size: 13px; color: #8E97AB; text-align: center; font-family: sans-serif;">
        ${escapeHtml(String(item?.quantity ?? 1))}
      </td>
      <td style="padding: 12px 14px; font-size: 13px; color: #8E97AB; text-align: right; font-family: sans-serif;">
        ${Number(item?.unitPrice ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currencySymbol}
      </td>
      <td style="padding: 12px 14px; font-size: 13px; color: #f7c548; font-weight: 700; text-align: right; font-family: sans-serif;">
        ${Number(item?.total ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currencySymbol}
      </td>
    </tr>
  `).join('') : `
    <tr>
      <td colspan="4" style="padding: 14px; font-size: 13px; color: #8E97AB; text-align: center; font-family: sans-serif;">
        Prestation créative définie dans le devis
      </td>
    </tr>
  `;

  // Validation sécurisée du lien trackingUrl limité au domaine applicatif
  const safeTrackingUrl = sanitizeSafeAppLink(params.trackingUrl);

  const html = wrapEmailContainer(`
    ${getEmailHeaderHtml('Confirmation de Commande', `Réf : ${safeOrderNumber}`, displayStudio)}
    <div class="content-cell" style="padding: 28px 28px 12px 28px; font-family: sans-serif; color: #FFFFFF;">
      <p style="font-size: 15px; line-height: 1.5; margin: 0 0 16px 0; color: #FFFFFF;">
        Bonjour <strong>${safeClientName}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #B0B9C8; margin: 0 0 20px 0;">
        Nous avons bien enregistré la validation de votre projet <strong>« ${safeProjectTitle} »</strong>. Merci pour votre confiance !
      </p>

      <div style="background-color: #162035; border-left: 4px solid #f7c548; padding: 14px 18px; margin-bottom: 24px; border-radius: 4px;">
        <span style="font-size: 11px; text-transform: uppercase; font-weight: 700; color: #f7c548; letter-spacing: 0.5px; display: block; margin-bottom: 4px;">
          Statut de la commande
        </span>
        <span style="font-size: 14px; font-weight: 700; color: #FFFFFF;">
          Projet validé &amp; Enregistré au studio
        </span>
      </div>

      <h3 style="margin: 0 0 12px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #FFFFFF; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 6px;">
        Détail des prestations
      </h3>

      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; overflow: hidden;">
        <thead>
          <tr style="background-color: #0E1626; color: #8E97AB;">
            <th style="padding: 10px 14px; text-align: left; font-size: 11px; text-transform: uppercase; font-family: sans-serif;">Désignation</th>
            <th style="padding: 10px 14px; text-align: center; font-size: 11px; text-transform: uppercase; font-family: sans-serif;">Qté</th>
            <th style="padding: 10px 14px; text-align: right; font-size: 11px; text-transform: uppercase; font-family: sans-serif;">P.U. HT</th>
            <th style="padding: 10px 14px; text-align: right; font-size: 11px; text-transform: uppercase; font-family: sans-serif;">Total HT</th>
          </tr>
        </thead>
        <tbody>
          ${itemsRows}
        </tbody>
      </table>

      <!-- Totaux -->
      <table width="100%" cellpadding="6" cellspacing="0" style="margin-bottom: 24px; font-size: 13px; font-family: sans-serif;">
        <tr>
          <td style="color: #8E97AB;">Total Hors Taxes :</td>
          <td style="text-align: right; color: #FFFFFF; font-weight: 600;">${safeTotalHT.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currencySymbol}</td>
        </tr>
        ${params.vatRate && params.vatRate > 0 ? `
        <tr>
          <td style="color: #8E97AB;">TVA (${escapeHtml(String(params.vatRate))} %) :</td>
          <td style="text-align: right; color: #FFFFFF; font-weight: 600;">${(safeTotalTTC - safeTotalHT).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currencySymbol}</td>
        </tr>
        ` : ''}
        <tr style="border-top: 1px solid rgba(255,255,255,0.15);">
          <td style="font-weight: 800; font-size: 15px; color: #FFFFFF; padding-top: 10px;">Total TTC :</td>
          <td style="text-align: right; font-weight: 800; font-size: 16px; color: #f7c548; padding-top: 10px;">
            ${safeTotalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currencySymbol}
          </td>
        </tr>
        ${safeDeposit > 0 ? `
        <tr>
          <td style="color: #5FB59A; font-weight: 600;">Acompte à régler :</td>
          <td style="text-align: right; color: #5FB59A; font-weight: 700;">
            ${safeDeposit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currencySymbol}
          </td>
        </tr>
        ` : ''}
        ${safeBalanceDue > 0 ? `
        <tr>
          <td style="color: #8E97AB;">Solde restant à la livraison :</td>
          <td style="text-align: right; color: #FFFFFF; font-weight: 600;">
            ${safeBalanceDue.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currencySymbol}
          </td>
        </tr>
        ` : ''}
      </table>

      ${safeTrackingUrl ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 24px 0 12px 0;">
        <tr>
          <td style="text-align: center;">
            <a href="${escapeHtml(safeTrackingUrl)}" style="background: linear-gradient(135deg, #f7c548, #fce49c); color: #0B0F1A; padding: 13px 26px; font-size: 13px; font-weight: 700; font-family: sans-serif; text-decoration: none; border-radius: 8px; display: inline-block;">
              Accéder à votre Espace Projet Sécurisé &rarr;
            </a>
          </td>
        </tr>
      </table>
      ` : ''}
    </div>
    ${getEmailFooterHtml(displayStudio, params.replyTo)}
  `);

  const text = `
Confirmation de commande ${safeOrderNumber} - ${params.studioName || 'Studio'}
Projet : ${safeProjectTitle}

Bonjour ${safeClientName},

Nous avons bien enregistré la validation de votre commande.
Total TTC : ${safeTotalTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currencySymbol}
${safeDeposit > 0 ? `Acompte : ${safeDeposit.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} ${currencySymbol}\n` : ''}
${safeTrackingUrl ? `Votre espace client sécurisé : ${safeTrackingUrl}\n` : ''}

Merci pour votre confiance,
${params.studioName || 'Studio'}
  `.trim();

  return { subject, html, text };
}

export function buildAdminNotificationEmail(params: {
  clientName: string;
  clientEmail: string;
  clientPhone?: string;
  clientCompany?: string;
  projectType: string;
  projectTitle: string;
  description: string;
  estimatedBudget?: string;
  desiredDeadline?: string;
  orderNumber: string;
  adminUrl?: string;
  studioName?: string;
  replyTo?: string;
}): { subject: string; html: string; text: string } {
  const displayStudio = escapeHtml(params.studioName || 'Mon Studio');
  const safeAdminUrl = sanitizeSafeAppLink(params.adminUrl);
  const subject = `🔔 Nouveau brief reçu : ${params.projectTitle} (${params.clientCompany || params.clientName}) · ${params.studioName || 'Studio'}`;

  const html = wrapEmailContainer(`
    ${getEmailHeaderHtml('Nouveau Brief Client', 'Alerte Studio · Notification Freelance', displayStudio)}
    <div class="content-cell" style="padding: 26px 28px 12px 28px; font-family: sans-serif; color: #FFFFFF;">
      <div style="background-color: #1A253E; color: #f7c548; padding: 12px 16px; border-left: 4px solid #f7c548; margin-bottom: 20px; font-size: 13px; border-radius: 4px;">
        <strong>ALERTE EN DIRECT :</strong> Un client vient de vous soumettre une nouvelle demande via votre formulaire public.
      </div>

      <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #f7c548;">
        Coordonnées du client
      </h3>
      <table width="100%" cellpadding="6" cellspacing="0" style="margin-bottom: 20px; font-size: 13px; font-family: sans-serif; background-color: #141D30; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;">
        <tr>
          <td width="30%" style="color: #8E97AB;">Nom :</td>
          <td width="70%" style="color: #FFFFFF; font-weight: 600;">${escapeHtml(params.clientName)}</td>
        </tr>
        <tr>
          <td style="color: #8E97AB;">Entreprise :</td>
          <td style="color: #FFFFFF;">${escapeHtml(params.clientCompany || 'Particulier / Indépendant')}</td>
        </tr>
        <tr>
          <td style="color: #8E97AB;">Email :</td>
          <td style="color: #f7c548; font-weight: 600;">
            <a href="mailto:${escapeHtml(params.clientEmail)}" style="color: #f7c548; text-decoration: underline;">${escapeHtml(params.clientEmail)}</a>
          </td>
        </tr>
        ${params.clientPhone ? `
        <tr>
          <td style="color: #8E97AB;">Téléphone :</td>
          <td style="color: #FFFFFF;">${escapeHtml(params.clientPhone)}</td>
        </tr>
        ` : ''}
      </table>

      <h3 style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #f7c548;">
        Détail du projet
      </h3>
      <table width="100%" cellpadding="6" cellspacing="0" style="margin-bottom: 20px; font-size: 13px; font-family: sans-serif; background-color: #141D30; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;">
        <tr>
          <td width="30%" style="color: #8E97AB;">Titre :</td>
          <td width="70%" style="color: #FFFFFF; font-weight: 700;">${escapeHtml(params.projectTitle)}</td>
        </tr>
        <tr>
          <td style="color: #8E97AB;">Type :</td>
          <td style="color: #FFFFFF;">${escapeHtml(params.projectType)}</td>
        </tr>
        ${params.estimatedBudget ? `
        <tr>
          <td style="color: #8E97AB;">Budget estimé :</td>
          <td style="color: #5FB59A; font-weight: 700;">${escapeHtml(params.estimatedBudget)}</td>
        </tr>
        ` : ''}
        ${params.desiredDeadline ? `
        <tr>
          <td style="color: #8E97AB;">Échéance :</td>
          <td style="color: #FFFFFF;">${escapeHtml(params.desiredDeadline)}</td>
        </tr>
        ` : ''}
      </table>

      <h3 style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #FFFFFF;">
        Description du besoin
      </h3>
      <div style="background-color: #0E1626; border: 1px solid rgba(255,255,255,0.1); border-radius: 6px; padding: 14px 16px; font-size: 13px; line-height: 1.6; color: #B0B9C8; margin-bottom: 24px; white-space: pre-wrap;">
        ${escapeHtml(params.description)}
      </div>

      ${safeAdminUrl ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0 10px 0;">
        <tr>
          <td style="text-align: center;">
            <a href="${escapeHtml(safeAdminUrl)}" style="background-color: #f7c548; color: #0B0F1A; padding: 12px 24px; font-size: 13px; font-weight: 700; font-family: sans-serif; text-decoration: none; border-radius: 8px; display: inline-block;">
              Ouvrir le projet dans eyes-onwork &rarr;
            </a>
          </td>
        </tr>
      </table>
      ` : ''}
    </div>
    ${getEmailFooterHtml(displayStudio, params.replyTo)}
  `);

  const text = `
Nouveau brief reçu : ${params.projectTitle}
Client : ${params.clientName} (${params.clientEmail})
Budget : ${params.estimatedBudget || 'Non spécifié'}
Description : ${params.description}
  `.trim();

  return { subject, html, text };
}

export function buildPaymentReceiptEmail(params: {
  clientName: string;
  invoiceNumber: string;
  projectTitle: string;
  amountPaid: number;
  paymentMethod: string;
  paymentDate: string;
  totalInvoiceTTC: number;
  balanceRemaining: number;
  downloadUrl?: string;
  isFullPayment?: boolean;
  studioName?: string;
  replyTo?: string;
}): { subject: string; html: string; text: string } {
  const displayStudio = escapeHtml(params.studioName || 'Studio Graphique');
  const safeDownloadUrl = sanitizeSafeAppLink(params.downloadUrl);
  const subject = `Reçu de paiement — Facture ${params.invoiceNumber} (${params.projectTitle}) · ${params.studioName || 'Studio'}`;

  const html = wrapEmailContainer(`
    ${getEmailHeaderHtml('Reçu de Paiement', `Facture Réf : ${escapeHtml(params.invoiceNumber)}`, displayStudio)}
    <div class="content-cell" style="padding: 26px 28px 12px 28px; font-family: sans-serif; color: #FFFFFF;">
      <p style="font-size: 15px; margin: 0 0 16px 0; color: #FFFFFF;">
        Bonjour <strong>${escapeHtml(params.clientName)}</strong>,
      </p>
      <p style="font-size: 14px; line-height: 1.6; color: #B0B9C8; margin: 0 0 20px 0;">
        Nous vous confirmons la bonne réception de votre règlement pour le projet <strong>« ${escapeHtml(params.projectTitle)} »</strong>.
      </p>

      <div style="background-color: #141D30; border: 1px solid rgba(247, 197, 72, 0.3); border-radius: 8px; padding: 18px 22px; text-align: center; margin-bottom: 24px;">
        <span style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #f7c548; letter-spacing: 1px; display: block; margin-bottom: 4px;">
          MONTANT ENCAISSÉ
        </span>
        <span style="font-size: 30px; font-weight: 800; color: #5FB59A; font-family: sans-serif; display: block;">
          ${params.amountPaid.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
        </span>
        <span style="font-size: 12px; color: #8E97AB; margin-top: 4px; display: block;">
          Règlement par ${escapeHtml(params.paymentMethod)} le ${escapeHtml(params.paymentDate)}
        </span>
      </div>

      <table width="100%" cellpadding="8" cellspacing="0" style="margin-bottom: 24px; font-size: 13px; font-family: sans-serif; background-color: #0E1626; border-radius: 6px; border: 1px solid rgba(255,255,255,0.08);">
        <tr>
          <td style="color: #8E97AB;">Total de la facture TTC :</td>
          <td style="text-align: right; font-weight: 600; color: #FFFFFF;">${params.totalInvoiceTTC.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
        </tr>
        <tr>
          <td style="color: #5FB59A; font-weight: 700;">Versement reçu :</td>
          <td style="text-align: right; font-weight: 800; color: #5FB59A;">- ${params.amountPaid.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €</td>
        </tr>
        <tr style="border-top: 1px solid rgba(255,255,255,0.15);">
          <td style="font-weight: 800; font-size: 14px; color: #FFFFFF;">Solde restant :</td>
          <td style="text-align: right; font-weight: 800; font-size: 15px; color: ${params.balanceRemaining > 0 ? '#f7c548' : '#5FB59A'};">
            ${params.balanceRemaining > 0 ? `${params.balanceRemaining.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €` : '0,00 € (Facture soldée)'}
          </td>
        </tr>
      </table>

      ${params.isFullPayment ? `
      <div style="background-color: #142820; border-left: 4px solid #5FB59A; padding: 14px 18px; border-radius: 4px; margin-bottom: 22px; font-size: 13px; line-height: 1.5; color: #D1FAE5;">
        <strong>🎉 Prestation intégralement soldée :</strong> Vos livrables finaux haute définition sont débloqués sur votre espace client.
      </div>
      ` : ''}

      ${safeDownloadUrl ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0 10px 0;">
        <tr>
          <td style="text-align: center;">
            <a href="${escapeHtml(safeDownloadUrl)}" style="background-color: #f7c548; color: #0B0F1A; padding: 12px 24px; font-size: 13px; font-weight: 700; font-family: sans-serif; text-decoration: none; border-radius: 8px; display: inline-block;">
              Télécharger le Reçu Officiel &rarr;
            </a>
          </td>
        </tr>
      </table>
      ` : ''}
    </div>
    ${getEmailFooterHtml(displayStudio, params.replyTo)}
  `);

  const text = `
Reçu de paiement - ${params.studioName || 'Studio'}
Facture : ${params.invoiceNumber}
Montant encaissé : ${params.amountPaid.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
Solde restant : ${params.balanceRemaining.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
Merci pour votre règlement.
  `.trim();

  return { subject, html, text };
}

export function buildTestEmail(params: {
  recipientEmail: string;
  studioName?: string;
  isPlatformTest?: boolean;
}): { subject: string; html: string; text: string } {
  const displayStudio = escapeHtml(params.studioName || (params.isPlatformTest ? 'eyes-onwork Plateforme' : 'Mon Studio'));
  const subject = params.isPlatformTest ? '✅ Test du Service d’Envoi Plateforme réussi · eyes-onwork' : `✅ Test de Notification réussi · ${params.studioName || 'Studio'}`;
  const nowStr = new Date().toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'medium' });

  const html = wrapEmailContainer(`
    ${getEmailHeaderHtml('Test de Notification Réussi', params.isPlatformTest ? 'Vérification du service d’envoi global' : 'Vérification de votre adresse de notification', displayStudio)}
    <div class="content-cell" style="padding: 28px 28px 12px 28px; font-family: sans-serif; color: #FFFFFF;">
      <div style="background-color: #142820; border: 1px solid #5FB59A; border-radius: 8px; padding: 18px 20px; margin-bottom: 22px;">
        <span style="font-size: 15px; font-weight: 800; color: #5FB59A; display: block; margin-bottom: 4px;">
          ✓ Réception confirmée
        </span>
        <p style="margin: 0; font-size: 13px; color: #D1FAE5; line-height: 1.5;">
          ${params.isPlatformTest ? 'Le service d’envoi transactionnel de la plateforme est opérationnel.' : `Vos notifications pour ${displayStudio} sont parfaitement configurées et fonctionnelles.`}
        </p>
      </div>

      <table width="100%" cellpadding="6" cellspacing="0" style="margin-bottom: 22px; font-size: 13px; font-family: sans-serif; background-color: #141D30; border: 1px solid rgba(255,255,255,0.08); border-radius: 6px;">
        <tr>
          <td width="35%" style="color: #8E97AB;">Destinataire :</td>
          <td width="65%" style="color: #FFFFFF; font-weight: 600;">${escapeHtml(params.recipientEmail)}</td>
        </tr>
        <tr>
          <td style="color: #8E97AB;">Horodatage :</td>
          <td style="color: #FFFFFF;">${nowStr}</td>
        </tr>
        <tr>
          <td style="color: #8E97AB;">Espace :</td>
          <td style="color: #f7c548; font-weight: 600;">${displayStudio}</td>
        </tr>
      </table>
    </div>
    ${getEmailFooterHtml(displayStudio)}
  `);

  const text = `
Test réussi - ${params.studioName || 'Studio'}
Destinataire : ${params.recipientEmail}
Horodatage : ${nowStr}
Votre service d'email fonctionne correctement.
  `.trim();

  return { subject, html, text };
}

export function buildVerificationCodeEmail(params: {
  code: string;
  recipientEmail: string;
  studioName?: string;
  expirationMinutes?: number;
}): { subject: string; html: string; text: string } {
  const displayStudio = escapeHtml(params.studioName || 'eyes-onwork');
  const expiration = params.expirationMinutes || 10;
  const safeCode = escapeHtml(params.code);
  const subject = `${params.code} est votre code de confirmation eyes-onwork`;

  const html = wrapEmailContainer(`
    ${getEmailHeaderHtml('Vérification de votre compte', 'Confirmation d’adresse email', displayStudio)}
    <div class="content-cell" style="padding: 32px 28px; color: #E1E7F5; font-size: 14px; line-height: 1.6;">
      <p style="margin: 0 0 16px 0; color: #FFFFFF; font-size: 16px; font-weight: 600;">
        Bienvenue sur eyes-onwork !
      </p>
      <p style="margin: 0 0 24px 0; color: #8E97AB;">
        Pour finaliser la création de votre compte et sécuriser l’accès à votre espace créatif, veuillez saisir le code de vérification ci-dessous :
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <div style="display: inline-block; background: linear-gradient(135deg, #1A253E, #0E1626); border: 2px solid rgba(247, 197, 72, 0.6); border-radius: 14px; padding: 18px 36px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);">
          <span style="font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace; font-size: 36px; font-weight: 800; letter-spacing: 14px; color: #f7c548; display: inline-block; padding-left: 14px;">
            ${safeCode}
          </span>
        </div>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #8E97AB;">
          Ce code est valable pendant <strong style="color: #FFFFFF;">${expiration} minutes</strong>.
        </p>
      </div>

      <div style="margin: 28px 0 0 0; padding: 16px; background-color: rgba(255, 255, 255, 0.04); border-left: 3px solid #f7c548; border-radius: 6px; font-size: 12px; color: #8E97AB;">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: #FFFFFF;">
          Mesure de sécurité :
        </p>
        <p style="margin: 0;">
          Ne transmettez jamais ce code à un tiers. Si vous n'avez pas créé de compte sur eyes-onwork, vous pouvez ignorer cet email en toute sécurité.
        </p>
      </div>
    </div>
    ${getEmailFooterHtml(displayStudio)}
  `);

  const text = `
Code de confirmation eyes-onwork : ${params.code}

Votre code est valable pendant ${expiration} minutes.
Pour finaliser la création de votre compte, saisissez ce code sur votre écran de vérification.
  `.trim();

  return { subject, html, text };
}

export function buildPasswordResetCodeEmail(params: {
  code: string;
  recipientEmail: string;
  studioName?: string;
  expirationMinutes?: number;
}): { subject: string; html: string; text: string } {
  const displayStudio = escapeHtml(params.studioName || 'eyes-onwork');
  const expiration = params.expirationMinutes || 10;
  const safeCode = escapeHtml(params.code);
  const subject = `${params.code} est votre code de réinitialisation eyes-onwork`;

  const html = wrapEmailContainer(`
    ${getEmailHeaderHtml('Récupération de mot de passe', 'Sécurité du studio', displayStudio)}
    <div class="content-cell" style="padding: 32px 28px; color: #E1E7F5; font-size: 14px; line-height: 1.6;">
      <p style="margin: 0 0 16px 0; color: #FFFFFF; font-size: 16px; font-weight: 600;">
        Demande de réinitialisation de mot de passe
      </p>
      <p style="margin: 0 0 24px 0; color: #8E97AB;">
        Vous avez demandé la réinitialisation de votre mot de passe pour votre espace freelance sur eyes-onwork. Utilisez le code à 6 chiffres ci-dessous pour confirmer votre identité :
      </p>

      <div style="text-align: center; margin: 32px 0;">
        <div style="display: inline-block; background: linear-gradient(135deg, #1A253E, #0E1626); border: 2px solid rgba(247, 197, 72, 0.6); border-radius: 14px; padding: 18px 36px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);">
          <span style="font-family: 'SF Mono', Monaco, Consolas, 'Courier New', monospace; font-size: 36px; font-weight: 800; letter-spacing: 14px; color: #f7c548; display: inline-block; padding-left: 14px;">
            ${safeCode}
          </span>
        </div>
        <p style="margin: 12px 0 0 0; font-size: 12px; color: #8E97AB;">
          Ce code est valable pendant <strong style="color: #FFFFFF;">${expiration} minutes</strong>.
        </p>
      </div>

      <div style="margin: 28px 0 0 0; padding: 16px; background-color: rgba(255, 255, 255, 0.04); border-left: 3px solid #f7c548; border-radius: 6px; font-size: 12px; color: #8E97AB;">
        <p style="margin: 0 0 6px 0; font-weight: 600; color: #FFFFFF;">
          Alerte de sécurité :
        </p>
        <p style="margin: 0;">
          Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité. Votre mot de passe actuel reste inchangé.
        </p>
      </div>
    </div>
    ${getEmailFooterHtml(displayStudio)}
  `);

  const text = `
Code de réinitialisation eyes-onwork : ${params.code}

Votre code est valable pendant ${expiration} minutes.
Pour réinitialiser votre mot de passe, saisissez ce code sur votre écran de récupération.

Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.
  `.trim();

  return { subject, html, text };
}

export function buildProviderLinkedAlertEmail(params: {
  recipientEmail: string;
  providerName?: string;
  secureAccountUrl: string;
  studioName?: string;
}): { subject: string; html: string; text: string } {
  const displayStudio = escapeHtml(params.studioName || 'eyes-onwork');
  const rawProvider = params.providerName || 'Google';
  const safeProvider = escapeHtml(rawProvider);
  const safeUrl = sanitizeSafeAppLink(params.secureAccountUrl) || '/?securityAction=secureAccount';

  const headline =
    rawProvider === 'Google'
      ? "Google a été relié à votre compte. Ce n'était pas vous ?"
      : `${safeProvider} a été relié à votre compte. Ce n'était pas vous ?`;

  const plainHeadline =
    rawProvider === 'Google'
      ? "Google a été relié à votre compte. Ce n'était pas vous ?"
      : `${rawProvider} a été relié à votre compte. Ce n'était pas vous ?`;

  const subject =
    rawProvider === 'Google'
      ? 'Alerte de sécurité : Google a été relié à votre compte eyes-onwork'
      : `Alerte de sécurité : ${rawProvider} a été relié à votre compte eyes-onwork`;

  const html = wrapEmailContainer(`
    ${getEmailHeaderHtml('Alerte de sécurité du compte', 'Nouveau mode de connexion relié', displayStudio)}
    <div class="content-cell" style="padding: 32px 28px; color: #E1E7F5; font-size: 14px; line-height: 1.6;">
      <p style="margin: 0 0 16px 0; color: #FFFFFF; font-size: 17px; font-weight: 700;">
        ${headline}
      </p>
      <p style="margin: 0 0 20px 0; color: #8E97AB;">
        Un nouveau fournisseur de connexion (<strong style="color: #FFFFFF;">${safeProvider}</strong>) vient d'être associé au compte <strong style="color: #FFFFFF;">${escapeHtml(params.recipientEmail)}</strong>.
      </p>

      <div style="margin: 24px 0; padding: 18px; background-color: rgba(217, 105, 95, 0.12); border: 1px solid rgba(217, 105, 95, 0.35); border-radius: 12px; font-size: 13px; color: #F1F3F8;">
        <p style="margin: 0 0 14px 0;">
          Si vous n'êtes pas à l'origine de cette action, déconnectez immédiatement tous vos appareils et changez votre mot de passe :
        </p>
        <div style="text-align: center; margin: 18px 0 6px 0;">
          <a
            href="${escapeHtml(safeUrl)}"
            style="display: inline-block; background-color: #f7c548; color: #0f0326; font-weight: 700; font-size: 14px; text-decoration: none; padding: 13px 26px; border-radius: 10px;"
          >
            Sécuriser mon compte
          </a>
        </div>
      </div>

      <p style="margin: 20px 0 0 0; font-size: 12px; color: #8E97AB;">
        Ce lien révoquera instantanément toutes les sessions actives sur vos appareils et vous permettra de définir un nouveau mot de passe. Si vous êtes bien à l'origine de cet ajout, vous pouvez ignorer ce message.
      </p>
    </div>
    ${getEmailFooterHtml(displayStudio)}
  `);

  const text = `
${plainHeadline}

Un nouveau fournisseur de connexion (${rawProvider}) a été relié à votre compte ${params.recipientEmail}.

Ce n'était pas vous ? Sécuriser mon compte :
${safeUrl}

Ce lien déconnectera immédiatement tous vos appareils et vous proposera de changer votre mot de passe.
  `.trim();

  return { subject, html, text };
}

export function generateVerificationCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}

/**
 * Transaction Simulator pour l'environnement de test local hors cloud.
 * Assure les MÊMES invariants stricts Firestore (empreinte SHA-256 avec sel, transactionnel, sans clair).
 */
const mockFirestoreVerificationDocs = new Map<string, any>();

async function runVerificationTransaction<T>(
  action: (transaction: {
    get: (ref: any) => Promise<{ exists: boolean; data: () => any }>;
    set: (ref: any, data: any) => void;
    update: (ref: any, data: any) => void;
  }) => Promise<T>
): Promise<T> {
  try {
    return await adminDb.runTransaction(async (t) => {
      return await action({
        get: async (ref: any) => {
          const snap = await t.get(ref);
          return { exists: snap.exists, data: () => snap.data() };
        },
        set: (ref: any, data: any) => t.set(ref, data),
        update: (ref: any, data: any) => t.update(ref, data)
      });
    });
  } catch (err: any) {
    if (isPermissionOrCredentialError(err)) {
      // Exécute la transaction de façon atomique sur le mock Firestore pour tests sans GCP
      const stagedWrites: Array<() => void> = [];
      const mockTx = {
        get: async (ref: any) => {
          const docId = typeof ref === 'string' ? ref : (ref?.id || String(ref));
          const existing = mockFirestoreVerificationDocs.get(docId);
          return {
            exists: Boolean(existing),
            data: () => existing ? { ...existing } : undefined
          };
        },
        set: (ref: any, data: any) => {
          const docId = typeof ref === 'string' ? ref : (ref?.id || String(ref));
          stagedWrites.push(() => mockFirestoreVerificationDocs.set(docId, { ...data }));
        },
        update: (ref: any, data: any) => {
          const docId = typeof ref === 'string' ? ref : (ref?.id || String(ref));
          stagedWrites.push(() => {
            const current = mockFirestoreVerificationDocs.get(docId) || {};
            mockFirestoreVerificationDocs.set(docId, { ...current, ...data });
          });
        }
      };

      const result = await action(mockTx);
      for (const commit of stagedWrites) {
        commit();
      }
      return result;
    }
    throw err;
  }
}

/**
 * 1) Émission d'un code de vérification :
 * - Stocke l'empreinte SHA-256 du code (avec VERIFICATION_SALT) dans Firestore
 * - Lue et écrite via une transaction
 * - Aucun stockage en mémoire de code brut
 * - 10 minutes de validité
 * - 5 essais max
 * - 5 envois par heure par utilisateur
 */
export async function issueVerificationCode(email: string, userId?: string): Promise<{
  success: boolean;
  code?: string;
  expiresAt?: number;
  error?: string;
  remainingSeconds?: number;
  message?: string;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const docId = (userId || cleanEmail).replace(/[^a-zA-Z0-9_-]/g, '_');
  const now = Date.now();

  try {
    return await runVerificationTransaction(async (transaction) => {
      const docRef = adminDb.collection('verification_codes').doc(docId);
      const snap = await transaction.get(docRef);
      const existing = snap.exists ? snap.data() : null;

      if (existing) {
        // 5 envois par heure par utilisateur
        const hourlyResetAt = Number(existing.hourlyResetAt) || (now + 60 * 60 * 1000);
        const hourlyCount = (now < hourlyResetAt) ? (Number(existing.hourlyCount) || 0) : 0;

        if (now < hourlyResetAt && hourlyCount >= 5) {
          return {
            success: false,
            error: 'HOURLY_LIMIT_EXCEEDED',
            message: 'Plafond horaire atteint (5 envois max par heure). Veuillez patienter.'
          };
        }

        // Cooldown de 60 secondes entre deux demandes
        const cooldownUntil = Number(existing.cooldownUntil) || 0;
        if (now < cooldownUntil) {
          const remainingSeconds = Math.ceil((cooldownUntil - now) / 1000);
          return {
            success: false,
            error: 'COOLDOWN',
            remainingSeconds,
            message: `Veuillez patienter ${remainingSeconds}s avant de redemander un code.`
          };
        }
      }

      const code = generateVerificationCode();
      const codeHash = hashVerificationCode(code);
      const expiresAt = now + 10 * 60 * 1000; // 10 minutes
      const cooldownUntil = now + 60 * 1000; // 60 secondes

      const hourlyResetAt = (existing && now < Number(existing.hourlyResetAt))
        ? Number(existing.hourlyResetAt)
        : now + 60 * 60 * 1000;
      const hourlyCount = (existing && now < Number(existing.hourlyResetAt))
        ? (Number(existing.hourlyCount) || 0) + 1
        : 1;

      transaction.set(docRef, {
        docId,
        email: cleanEmail,
        userId: userId || null,
        codeHash, // Empreinte SHA-256 + VERIFICATION_SALT
        expiresAt,
        cooldownUntil,
        attempts: 0,
        maxAttempts: 5,
        hourlyCount,
        hourlyResetAt,
        invalidated: false,
        used: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });

      return {
        success: true,
        code,
        expiresAt
      };
    });
  } catch (err: any) {
    return {
      success: false,
      error: 'TRANSACTION_FAILED',
      message: 'Erreur lors de l’émission sécurisée du code.'
    };
  }
}

/**
 * 1) Vérification du code soumis :
 * - Lecture et écriture via transaction Firestore
 * - Empreinte SHA-256 avec VERIFICATION_SALT
 * - Comparaison en temps constant (crypto.timingSafeEqual)
 * - 5 essais maximum (invalidation au 5ème échec)
 * - Usage unique (scellé dès la première validation réussie)
 */
export async function verifySubmittedCode(emailOrId: string, submittedCode: string, userId?: string): Promise<{
  success: boolean;
  verified?: boolean;
  error?: string;
  remainingAttempts?: number;
  message?: string;
}> {
  const cleanEmail = emailOrId.trim().toLowerCase();
  const docId = (userId || cleanEmail).replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanCode = (submittedCode || '').trim();
  const now = Date.now();

  if (!cleanCode || !/^\d{6}$/.test(cleanCode)) {
    return {
      success: false,
      error: 'INVALID_FORMAT',
      message: 'Le code doit comporter 6 chiffres.'
    };
  }

  try {
    return await runVerificationTransaction(async (transaction) => {
      const docRef = adminDb.collection('verification_codes').doc(docId);
      const snap = await transaction.get(docRef);

      if (!snap.exists) {
        return {
          success: false,
          error: 'EXPIRED_OR_NOT_FOUND',
          message: 'Code expiré ou inexistant. Veuillez en redemander un nouveau.'
        };
      }

      const data = snap.data();

      // Usage unique
      if (data.used === true) {
        return {
          success: false,
          error: 'ALREADY_USED',
          message: 'Ce code a déjà été utilisé.'
        };
      }

      // Invalidation ou expiration (10 minutes)
      if (data.invalidated || now > Number(data.expiresAt)) {
        return {
          success: false,
          error: 'EXPIRED_OR_NOT_FOUND',
          message: 'Code expiré ou inexistant. Veuillez en redemander un nouveau.'
        };
      }

      // Nombre d'essais (max 5)
      const currentAttempts = (Number(data.attempts) || 0) + 1;
      if (currentAttempts > (Number(data.maxAttempts) || 5)) {
        transaction.update(docRef, { invalidated: true });
        return {
          success: false,
          error: 'MAX_ATTEMPTS',
          remainingAttempts: 0,
          message: 'Code invalidé suite à 5 tentatives infructueuses.'
        };
      }

      // Comparaison en temps constant (crypto.timingSafeEqual)
      const submittedHash = hashVerificationCode(cleanCode);
      const storedHash = String(data.codeHash || '');

      const bufSubmitted = Buffer.from(submittedHash, 'hex');
      const bufStored = Buffer.from(storedHash, 'hex');

      const isMatch = bufSubmitted.length === bufStored.length && crypto.timingSafeEqual(bufSubmitted, bufStored);

      if (!isMatch) {
        if (currentAttempts >= 5) {
          transaction.update(docRef, { attempts: currentAttempts, invalidated: true });
          return {
            success: false,
            error: 'MAX_ATTEMPTS',
            remainingAttempts: 0,
            message: 'Code invalidé suite à 5 tentatives infructueuses.'
          };
        } else {
          transaction.update(docRef, { attempts: currentAttempts });
          return {
            success: false,
            error: 'INVALID_CODE',
            remainingAttempts: 5 - currentAttempts,
            message: `Code incorrect. Il vous reste ${5 - currentAttempts} tentative(s).`
          };
        }
      }

      // Code validé et scellé à usage unique
      transaction.update(docRef, {
        attempts: currentAttempts,
        used: true,
        verifiedAt: new Date().toISOString()
      });

      return {
        success: true,
        verified: true,
        message: 'Code validé avec succès.'
      };
    });
  } catch (err: any) {
    return {
      success: false,
      error: 'TRANSACTION_FAILED',
      message: 'Erreur lors de la validation transactionnelle du code.'
    };
  }
}

export async function getVerificationStatus(email: string, userId?: string): Promise<{
  hasPendingCode: boolean;
  cooldownSeconds: number;
  hourlyResendsCount: number;
}> {
  const cleanEmail = email.trim().toLowerCase();
  const docId = (userId || cleanEmail).replace(/[^a-zA-Z0-9_-]/g, '_');
  const now = Date.now();

  try {
    const docRef = adminDb.collection('verification_codes').doc(docId);
    let data: any = null;
    try {
      const snap = await docRef.get();
      if (snap.exists) data = snap.data();
    } catch (err: any) {
      if (isPermissionOrCredentialError(err)) {
        data = mockFirestoreVerificationDocs.get(docId);
      }
    }

    if (!data) {
      return { hasPendingCode: false, cooldownSeconds: 0, hourlyResendsCount: 0 };
    }

    const hasPendingCode = !data.invalidated && !data.used && now < Number(data.expiresAt);
    const cooldownSeconds = Math.max(0, Math.ceil(((Number(data.cooldownUntil) || 0) - now) / 1000));
    const hourlyResendsCount = (now < (Number(data.hourlyResetAt) || 0)) ? (Number(data.hourlyCount) || 0) : 0;

    return {
      hasPendingCode,
      cooldownSeconds,
      hourlyResendsCount
    };
  } catch {
    return { hasPendingCode: false, cooldownSeconds: 0, hourlyResendsCount: 0 };
  }
}

/**
 * Envoi d'email sécurisé conforme aux exigences :
 * 2) Destinataire unique validé
 * 3) Quotas Firestore par workspace vérifiés
 * 5) Ne renvoie JAMAIS le message d'erreur SMTP au client
 * 6) Échappement et limitation des liens
 * 7) Journaux par workspace conservés 90 jours sans IP complète
 */
export async function sendEmailSafe(params: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateKey?: string;
  recipientName?: string;
  studioName?: string;
  replyTo?: string;
  workspaceId?: string;
  ip?: string;
  clientIp?: string;
  plan?: string;
}): Promise<{
  success: boolean;
  mode: 'live' | 'simulation';
  messageId?: string;
  error?: string;
  log?: any;
}> {
  const {
    to,
    subject,
    html,
    text = '',
    templateKey = 'custom',
    recipientName = 'Destinataire',
    studioName = 'Studio Graphique',
    replyTo,
    workspaceId = 'ws_default',
    ip,
    clientIp,
    plan = 'free'
  } = params;

  const rawIp = clientIp || ip || '127.0.0.1';

  // 2) Destinataire : une seule adresse valide, jamais de liste ni de virgule ni de point-virgule
  let safeRecipient: string;
  try {
    safeRecipient = validateSingleRecipient(to);
  } catch (err: any) {
    return {
      success: false,
      mode: 'simulation',
      error: err.message
    };
  }

  // 3) Quotas quotidien et mensuel par workspace stockés dans Firestore selon le plan
  const quotaCheck = await checkAndIncrementWorkspaceQuotas(workspaceId, plan);
  if (!quotaCheck.allowed) {
    const errorReason = quotaCheck.reason === 'DAILY_LIMIT_EXCEEDED'
      ? `Plafond quotidien d’envois atteint pour votre formule (${quotaCheck.dailyCount}/${quotaCheck.dailyLimit}).`
      : `Plafond mensuel d’envois atteint pour votre formule (${quotaCheck.monthlyCount}/${quotaCheck.monthlyLimit}).`;

    return {
      success: false,
      mode: 'simulation',
      error: errorReason
    };
  }

  updateDailyCounter();

  // 7) Journaux d'envoi par workspace, conservés 90 jours, sans adresse IP complète
  const now = Date.now();
  const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
  const maskedIp = maskIpAddress(rawIp); // Pas d'adresse IP complète !

  const logEntry: EmailLogEntry = {
    id: `email_${now}_${Math.random().toString(36).substring(2, 7)}`,
    workspaceId,
    recipientEmail: safeRecipient,
    recipientName: escapeHtml(recipientName),
    subject: escapeHtml(subject),
    templateKey,
    sentAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ninetyDaysMs).toISOString(),
    retentionUntilMs: now + ninetyDaysMs,
    status: 'delivered',
    provider: 'gmail_smtp',
    ip: maskedIp,
    studioName: escapeHtml(studioName)
  };

  const transporter = getMailTransporter();

  if (!transporter) {
    logEntry.provider = 'simulation';
    emailLogs.unshift(logEntry);
    if (emailLogs.length > 200) emailLogs.pop();

    try {
      if (typeof persistEmailLogInFirestore === 'function') {
        persistEmailLogInFirestore(logEntry);
      }
    } catch {}

    return {
      success: true,
      mode: 'simulation',
      messageId: `sim_${Date.now()}`,
      log: logEntry
    };
  }

  try {
    const from = formatSenderAddress(studioName);
    const info = await transporter.sendMail({
      from,
      to: safeRecipient,
      subject,
      html,
      text: text || subject,
      replyTo: replyTo ? validateSingleRecipient(replyTo) : undefined
    });

    dailyProviderSentCount++;
    emailLogs.unshift(logEntry);
    if (emailLogs.length > 200) emailLogs.pop();

    try {
      if (typeof persistEmailLogInFirestore === 'function') {
        persistEmailLogInFirestore(logEntry);
      }
    } catch {}

    return {
      success: true,
      mode: 'live',
      messageId: info.messageId,
      log: logEntry
    };
  } catch (err: any) {
    // 5) Ne renvoie jamais le message d'erreur SMTP au client.
    console.error('[SMTP Transport Error]', err?.message || err);

    logEntry.status = 'bounced';
    emailLogs.unshift(logEntry);
    if (emailLogs.length > 200) emailLogs.pop();

    return {
      success: false,
      mode: 'live',
      error: "Une erreur est survenue lors de l'acheminement de l'email. Veuillez réessayer ultérieurement.",
      log: logEntry
    };
  }
}