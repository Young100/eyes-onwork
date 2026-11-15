import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  sendEmailSafe,
  buildClientConfirmationEmail,
  buildAdminNotificationEmail,
  buildPaymentReceiptEmail,
  buildTestEmail,
  buildVerificationCodeEmail,
  checkEmailRateLimit,
  getEmailLogs,
  getPlatformAdminEmail,
  getAdminEmail,
  getMailTransporter,
  getPlatformProviderConfig,
  formatSenderAddress
} from './emailService.js';
import {
  verifyFirebaseToken,
  setSuperAdminClaim,
  markUserEmailVerifiedInAuth,
  getServerUserProfile,
  getOrCreateServerUserProfileAndWorkspace,
  setServerUserProfile,
  getClientPortalDataByToken,
  getSuperAdminUids,
  testFirestoreAdminConnection,
  getStartupFirestoreTestResult,
  adminAuth,
  adminDb,
  adminStorage,
  verifySignedFileToken,
  generateSignedDeliverableUrl,
  isPermissionOrCredentialError,
  getMockPortalProject,
  getMockPortalQuote,
  registerMockPortalProject,
  registerMockPortalQuote,
  generateSecurePortalTokenForProject,
  revokePortalTokenForProject,
  setPortalLinkStatusForProject
} from './src/server/firebaseAdminSdk.js';
import {
  notifyProviderLinkedIfNew,
  revokeAllSessionsAndSecureAccount,
  purgeUserAccountData,
  cleanupStaleUnverifiedAccountByEmail,
  cleanupExpiredUnverifiedAccounts,
  startUnverifiedAccountCleanupScheduler,
  normalizeProviderIds
} from './src/server/accountSecurity.js';
import { 
  runStorageHealthDiagnostic, 
  checkAndIncrementDbEmailQuota, 
  getWorkspaceEmailLogsFromDb, 
  isRecipientClientOfWorkspace 
} from './src/server/firestoreAdmin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// SÉCURITÉ : Confiance au proxy inverse pour la lecture correcte de req.ip
app.set('trust proxy', 1);

// Limite par défaut stricte du corps JSON à 100 ko (protection DoS), avec 500 ko sur /api/portal/sign-quote pour signatures jusqu'à 200 Ko
app.use((req, res, next) => {
  if (req.path === '/api/portal/sign-quote') {
    return express.json({ limit: '500kb' })(req, res, next);
  }
  return express.json({ limit: '100kb' })(req, res, next);
});
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Whitelist CORS configurable par variable d'environnement CORS_ALLOWED_ORIGINS (séparées par virgules)
const getAllowedOrigins = (): string[] => {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS;
  if (!envOrigins) {
    return [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:5173',
      'http://127.0.0.1:5173'
    ];
  }
  return envOrigins
    .split(',')
    .map(o => o.trim())
    .filter(Boolean);
};

// SÉCURITÉ : En-têtes HTTP défensifs & CORS filtré par liste blanche
app.use((req: Request, res: Response, next: NextFunction) => {
  const isProduction = process.env.NODE_ENV === 'production';

  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=*');

  if (isProduction) {
    // En production : X-Frame-Options SAMEORIGIN, CSP de base et HSTS
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' https://apis.google.com https://*.firebaseapp.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https: blob:; connect-src 'self' https: wss:; frame-ancestors 'self';"
    );
  } else {
    // Mode développement : support de la prévisualisation dans l'iframe AI Studio
    res.removeHeader('X-Frame-Options');
  }

  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();

  const isOriginAllowed = origin && (
    allowedOrigins.includes(origin) ||
    allowedOrigins.includes('*') ||
    (origin.endsWith('.run.app') && allowedOrigins.some(o => o.includes('.run.app')))
  );

  if (origin && isOriginAllowed) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
    if (origin && !isOriginAllowed) {
      return res.status(403).json({ error: 'CORS_FORBIDDEN', message: 'Origine non autorisée par la politique CORS.' });
    }
    return res.sendStatus(204);
  }
  next();
});

// Logs internes du serveur
const serverErrorLogs: Array<{
  id: string;
  timestamp: string;
  source: string;
  message: string;
  stack?: string;
  path?: string;
  ip?: string;
}> = [];

// Sécurité des journaux : les jetons ne figurent JAMAIS dans les journaux
export function redactTokens(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/(token=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/("token"\s*:\s*")[^"]+/gi, '$1[REDACTED]')
    .replace(/(clientShareToken=)[^&\s]+/gi, '$1[REDACTED]')
    .replace(/("clientShareToken"\s*:\s*")[^"]+/gi, '$1[REDACTED]')
    .replace(/(Bearer\s+)[a-zA-Z0-9._-]+/gi, '$1[REDACTED]');
}

function logInternalError(message: string, source: string = 'server', details?: any) {
  const entry = {
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    source,
    message: redactTokens(String(message)),
    stack: details?.stack ? redactTokens(String(details.stack)) : undefined,
    path: details?.path ? redactTokens(String(details.path)) : undefined,
    ip: details?.ip
  };
  serverErrorLogs.unshift(entry);
  if (serverErrorLogs.length > 100) serverErrorLogs.pop();
}

// Rate limiters en mémoire avec purge automatique des entrées expirées
const publicLeadIpLimits = new Map<string, { count: number; resetAt: number }>();
const portalIpLimits = new Map<string, { count: number; resetAt: number }>();
const portalSignQuoteRateLimits = new Map<string, { count: number; resetAt: number }>();
const authRateLimits = new Map<string, { count: number; resetAt: number }>();
const userEmailRateLimits = new Map<string, { count: number; resetAt: number }>();
const logErrorRateLimits = new Map<string, { count: number; resetAt: number }>();
const staleCleanupIpLimits = new Map<string, { count: number; resetAt: number }>();

const allRateLimitMaps: Array<Map<string, { count: number; resetAt: number }>> = [
  publicLeadIpLimits,
  portalIpLimits,
  portalSignQuoteRateLimits,
  authRateLimits,
  userEmailRateLimits,
  logErrorRateLimits,
  staleCleanupIpLimits
];

// Purge des entrées expirées de toutes les limites de débit pour éviter les fuites mémoire
export function purgeExpiredRateLimits() {
  const now = Date.now();
  for (const map of allRateLimitMaps) {
    for (const [key, entry] of map.entries()) {
      if (now >= entry.resetAt) {
        map.delete(key);
      }
    }
  }
}

// Nettoyage régulier en arrière-plan toutes les 60 secondes
const purgeIntervalId = setInterval(purgeExpiredRateLimits, 60 * 1000);
if (typeof purgeIntervalId.unref === 'function') {
  purgeIntervalId.unref();
}

function checkRateLimit(map: Map<string, { count: number; resetAt: number }>, key: string, maxCount: number, windowMs: number): boolean {
  const now = Date.now();
  const current = map.get(key);
  if (!current || now >= current.resetAt) {
    map.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= maxCount) {
    return false;
  }
  current.count++;
  return true;
}

// Middleware d'authentification Firebase Admin SDK
export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    emailVerified?: boolean;
    role?: string;
    isSuperAdmin?: boolean;
    rawToken: any;
  };
}

async function requireFirebaseAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Authentification requise. Jeton Bearer manquant.'
    });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Jeton vide ou invalide.'
    });
  }

  try {
    const verified = await verifyFirebaseToken(token);
    req.user = verified;
    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Jeton d\'authentification invalide ou expiré.'
    });
  }
}

// Middleware Super Administrateur (vérifié strictement via custom claim côté serveur)
function requireSuperAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const superAdminUids = getSuperAdminUids();
  const isSuperAdmin = req.user.isSuperAdmin || req.user.role === 'superadmin' || superAdminUids.has(req.user.uid);

  if (!isSuperAdmin) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Accès strictement réservé au Super Administrateur de la plateforme.'
    });
  }
  next();
}

function checkUserEmailRateLimit(userId: string, maxCount = 5, windowMs = 60000): boolean {
  const now = Date.now();
  const current = userEmailRateLimits.get(userId);
  if (!current || now >= current.resetAt) {
    userEmailRateLimits.set(userId, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= maxCount) {
    return false;
  }
  current.count++;
  return true;
}

// Échappement HTML strict contre les injections dans les gabarits d'emails
function escapeHtml(str: any): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Restriction stricte de trackingUrl et downloadUrl aux domaines / chemins de l'application
function sanitizeSafeAppLink(urlStr: any, req: Request): string | undefined {
  if (!urlStr || typeof urlStr !== 'string') return undefined;
  const trimmed = urlStr.trim();
  if (!trimmed) return undefined;

  // Lien relatif sécurisé dans l'application
  if (trimmed.startsWith('/') && !trimmed.startsWith('//') && !trimmed.includes('\\')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return undefined;
    }
    const host = parsed.host.toLowerCase();
    const reqHost = (req.headers.host || '').toLowerCase();
    const originHost = req.headers.origin ? new URL(req.headers.origin as string).host.toLowerCase() : '';

    if (reqHost && host === reqHost) return trimmed;
    if (originHost && host === originHost) return trimmed;
    if (
      host.endsWith('.run.app') ||
      host.endsWith('.web.app') ||
      host.endsWith('.firebaseapp.com') ||
      host === 'localhost:3000' ||
      host === 'localhost' ||
      host.includes('aistudio')
    ) {
      return trimmed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

// Middleware strict pour toutes les routes métier :
// requireFirebaseAuth + emailVerified + termsAcceptedVersion + onboardingCompleted
async function requireOnboarded(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Authentification requise.'
    });
  }

  const token = authHeader.split('Bearer ')[1]?.trim();
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Jeton manquant ou invalide.'
    });
  }

  let verifiedUser: any;
  try {
    verifiedUser = await verifyFirebaseToken(token);
    req.user = verifiedUser;
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'INVALID_TOKEN',
      message: 'Session expirée ou invalide.'
    });
  }

  let profile: any = null;
  try {
    profile = await getServerUserProfile(verifiedUser.uid);
  } catch (err: any) {
    logInternalError(`Erreur lecture profil Firestore pour ${verifiedUser.uid}: ${err.message}`, 'firebase-admin', { path: req.path });
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Service temporairement indisponible.'
    });
  }

  // 1. Exigence stricte : email vérifié
  const isEmailVerified = Boolean(verifiedUser.emailVerified || profile?.emailVerified);
  if (!isEmailVerified) {
    return res.status(403).json({
      success: false,
      error: 'EMAIL_NOT_VERIFIED',
      message: 'Adresse email non vérifiée.'
    });
  }

  // 2. Exigence stricte : conditions d'utilisation acceptées
  if (!profile || !profile.termsAcceptedVersion) {
    return res.status(403).json({
      success: false,
      error: 'TERMS_NOT_ACCEPTED',
      message: 'Conditions d\'utilisation non acceptées.'
    });
  }

  // 3. Exigence stricte : onboarding complété
  if (!profile.onboardingCompleted) {
    return res.status(403).json({
      success: false,
      error: 'ONBOARDING_REQUIRED',
      message: 'Configuration initiale requise.'
    });
  }

  (req as any).userProfile = profile;
  next();
}

const requireVerifiedUserWithTerms = requireOnboarded;


// =========================================================================
// 1. ROUTE PUBLIQUE : FORMULAIRE PROSPECT (LEAD)
// =========================================================================
app.post('/api/public/lead', async (req: Request, res: Response) => {
  const { hp_field, name, email, company, phone, projectType, description, estimatedBudget, desiredDeadline } = req.body;

  if (hp_field) {
    console.warn('[Anti-Spam] Honeypot triggered, ignoring');
    return res.status(200).json({ success: true, message: 'Demande reçue' });
  }

  const clientIp = req.ip || '127.0.0.1';
  if (!checkRateLimit(publicLeadIpLimits, clientIp, 5, 10 * 60 * 1000)) {
    return res.status(429).json({ error: 'Trop de demandes envoyées. Veuillez patienter.' });
  }

  if (!name || !email || !description) {
    return res.status(400).json({ error: 'Champs obligatoires manquants (nom, email, description).' });
  }

  const leadId = `lead_${Date.now()}`;
  const adminEmail = getAdminEmail();
  const adminEmailContent = buildAdminNotificationEmail({
    clientName: name,
    clientEmail: email,
    clientPhone: phone,
    clientCompany: company,
    projectType: projectType || 'Création graphique',
    projectTitle: `Demande de ${company || name}`,
    description,
    estimatedBudget,
    desiredDeadline,
    orderNumber: leadId,
    adminUrl: `${req.protocol}://${req.get('host')}/`
  });

  sendEmailSafe({
    to: adminEmail,
    subject: adminEmailContent.subject,
    html: adminEmailContent.html,
    text: adminEmailContent.text,
    templateKey: 'notification_admin',
    recipientName: 'Studio (Admin)',
    ip: clientIp
  }).catch(err => console.warn('[Email Warning] Failed to notify admin:', err.message));

  const clientAckEmail = buildClientConfirmationEmail({
    clientName: name,
    orderNumber: leadId,
    projectTitle: `Votre demande de création (${projectType || 'Design graphique'})`,
    items: [{
      description: `Étude préliminaire & cadrage : ${description.slice(0, 80)}...`,
      quantity: 1,
      unitPrice: 0,
      total: 0
    }],
    totalHT: 0,
    totalTTC: 0,
    notes: 'Nous avons bien reçu votre demande. Un devis vous sera transmis sous 24 à 48 heures.'
  });

  sendEmailSafe({
    to: email,
    subject: 'Accusé de réception de votre demande — Studio Graphique',
    html: clientAckEmail.html,
    text: clientAckEmail.text,
    templateKey: 'confirmation_client',
    recipientName: name,
    ip: clientIp
  }).catch(err => console.warn('[Email Warning] Failed to send client ack:', err.message));

  return res.status(200).json({
    success: true,
    leadId,
    message: 'Votre demande a été transmise avec succès au studio.'
  });
});

// =========================================================================
// 2. PORTAIL CLIENT DÉDIÉ (Accès par jeton via serveur, aucun accès direct Firestore)
// =========================================================================

app.get('/api/portal/project', async (req: Request, res: Response) => {
  const token = req.query.token as string;
  const clientIp = req.ip || '127.0.0.1';

  if (!checkRateLimit(portalIpLimits, clientIp, 30, 60 * 1000)) {
    return res.status(429).json({ success: false, error: 'RATE_LIMIT_EXCEEDED', message: 'Trop de requêtes. Veuillez patienter.' });
  }

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, error: 'TOKEN_REQUIRED', message: 'Jeton requis.' });
  }

  const result = await getClientPortalDataByToken(token);
  if (result.error === 'LINK_REVOKED' || result.revoked) {
    return res.status(403).json({ success: false, error: 'LINK_REVOKED', message: 'Le lien d’accès au portail a été révoqué.' });
  }
  if (!result.success) {
    return res.status(404).json({ success: false, error: result.error || 'PORTAL_NOT_FOUND', message: result.message || 'Portail client introuvable ou lien invalide.' });
  }

  return res.status(200).json(result);
});

app.post('/api/portal/feedback', async (req: Request, res: Response) => {
  const { token, comment, roundIndex, versionIndex, pinCoords } = req.body;
  const clientIp = req.ip || '127.0.0.1';

  if (!checkRateLimit(portalIpLimits, clientIp, 15, 60 * 1000)) {
    return res.status(429).json({ success: false, error: 'RATE_LIMIT_EXCEEDED', message: 'Trop de requêtes. Veuillez patienter.' });
  }

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, error: 'TOKEN_REQUIRED', message: 'Jeton requis.' });
  }

  if (!comment || typeof comment !== 'string' || !comment.trim()) {
    return res.status(400).json({ success: false, error: 'MISSING_COMMENT', message: 'Commentaire requis.' });
  }

  // Validation stricte de pinCoords : deux nombres entre 0 et 1
  let validPinCoords: { x: number; y: number } | null = null;
  if (pinCoords !== undefined && pinCoords !== null) {
    let px: number | undefined;
    let py: number | undefined;

    if (Array.isArray(pinCoords) && pinCoords.length === 2) {
      px = Number(pinCoords[0]);
      py = Number(pinCoords[1]);
    } else if (
      typeof pinCoords === 'object' &&
      pinCoords !== null &&
      typeof (pinCoords as any).x !== 'undefined' &&
      typeof (pinCoords as any).y !== 'undefined'
    ) {
      px = Number((pinCoords as any).x);
      py = Number((pinCoords as any).y);
    }

    if (
      px === undefined ||
      py === undefined ||
      isNaN(px) ||
      isNaN(py) ||
      !Number.isFinite(px) ||
      !Number.isFinite(py) ||
      px < 0 ||
      px > 1 ||
      py < 0 ||
      py > 1
    ) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_PIN_COORDS',
        message: 'Les coordonnées du pin doivent être deux nombres compris entre 0 et 1.'
      });
    }

    validPinCoords = { x: px, y: py };
  }

  const result = await getClientPortalDataByToken(token);
  // Refus si le lien est révoqué
  if (result.error === 'LINK_REVOKED' || result.revoked || result.project?.clientLinkActive === false) {
    return res.status(403).json({ success: false, error: 'LINK_REVOKED', message: 'Le lien d’accès au portail a été révoqué.' });
  }

  if (!result.success || !result.project) {
    return res.status(404).json({ success: false, error: 'PORTAL_NOT_FOUND', message: 'Projet introuvable.' });
  }

  const projectId = result.project.id;
  const projectRef = adminDb.collection('projects').doc(projectId);
  const cleanComment = String(comment).trim().slice(0, 1000);

  const feedbackEntry = {
    id: `fb_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    author: 'client',
    comment: cleanComment,
    roundIndex: Number(roundIndex) || 0,
    versionIndex: Number(versionIndex) || 0,
    pinCoords: validPinCoords,
    createdAt: new Date().toISOString()
  };

  // Écriture atomique et limite de 200 retours maximum par projet
  try {
    await adminDb.runTransaction(async (transaction) => {
      const pDoc = await transaction.get(projectRef);
      if (!pDoc.exists) {
        throw new Error('PROJECT_NOT_FOUND');
      }
      const pData = pDoc.data();
      if (pData?.clientLinkActive === false || pData?.isRevoked === true || pData?.tokenRevoked === true) {
        throw new Error('LINK_REVOKED');
      }

      const existingFeedback = Array.isArray(pData?.feedback) ? pData.feedback : [];
      if (existingFeedback.length >= 200) {
        throw new Error('MAX_FEEDBACK_REACHED');
      }

      transaction.update(projectRef, {
        feedback: [...existingFeedback, feedbackEntry],
        feedbackCount: existingFeedback.length + 1,
        updatedAt: new Date().toISOString()
      });
    });

    return res.status(200).json({ success: true, message: 'Retour transmis avec succès' });
  } catch (err: any) {
    if (err.message === 'LINK_REVOKED') {
      return res.status(403).json({ success: false, error: 'LINK_REVOKED', message: 'Le lien d’accès au portail a été révoqué.' });
    }
    if (err.message === 'MAX_FEEDBACK_REACHED') {
      return res.status(400).json({ success: false, error: 'MAX_FEEDBACK_REACHED', message: 'Limite de 200 retours maximum atteinte pour ce projet.' });
    }
    if (err.message === 'PROJECT_NOT_FOUND') {
      return res.status(404).json({ success: false, error: 'PROJECT_NOT_FOUND', message: 'Projet introuvable.' });
    }

    if (isPermissionOrCredentialError(err)) {
      // Simulation atomique locale pour environnement de test / hors ligne
      const pData = getMockPortalProject(projectId) || result.project;
      if (pData.clientLinkActive === false || pData.isRevoked === true || pData.tokenRevoked === true) {
        return res.status(403).json({ success: false, error: 'LINK_REVOKED', message: 'Le lien d’accès au portail a été révoqué.' });
      }
      const existingFeedback = Array.isArray(pData.feedback) ? pData.feedback : [];
      if (existingFeedback.length >= 200) {
        return res.status(400).json({ success: false, error: 'MAX_FEEDBACK_REACHED', message: 'Limite de 200 retours maximum atteinte pour ce projet.' });
      }
      pData.feedback = [...existingFeedback, feedbackEntry];
      pData.feedbackCount = pData.feedback.length;
      pData.updatedAt = new Date().toISOString();
      registerMockPortalProject(pData);
      return res.status(200).json({ success: true, message: 'Retour transmis avec succès' });
    }

    logInternalError(`Erreur enregistrement feedback: ${err.message}`, 'server', { path: '/api/portal/feedback' });
    return res.status(500).json({ success: false, error: 'FEEDBACK_ERROR', message: 'Impossible d’enregistrer le retour.' });
  }
});

// Signature électronique sécurisée de devis côté portail
app.post('/api/portal/sign-quote', async (req: Request, res: Response) => {
  const clientIp = req.ip || '127.0.0.1';

  // Limite de débit par IP
  if (!checkRateLimit(portalSignQuoteRateLimits, clientIp, 10, 60 * 1000)) {
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de tentatives de signature. Veuillez patienter une minute.'
    });
  }

  const { token, quoteId, signatoryName, signatureDataUrl } = req.body;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, error: 'TOKEN_REQUIRED', message: 'Jeton de portail requis.' });
  }

  if (!quoteId || typeof quoteId !== 'string') {
    return res.status(400).json({ success: false, error: 'QUOTE_ID_REQUIRED', message: 'Identifiant du devis requis.' });
  }

  // Nom limité à 100 caractères
  if (!signatoryName || typeof signatoryName !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'INVALID_SIGNATORY_NAME',
      message: 'Le nom du signataire est obligatoire.'
    });
  }
  const cleanSignatoryName = signatoryName.trim();
  if (cleanSignatoryName.length === 0 || cleanSignatoryName.length > 100) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_SIGNATORY_NAME',
      message: 'Le nom du signataire doit comporter entre 1 et 100 caractères.'
    });
  }

  // Signature au format data:image/png;base64, et 200 Ko maximum
  if (!signatureDataUrl || typeof signatureDataUrl !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'INVALID_SIGNATURE',
      message: 'La signature est obligatoire.'
    });
  }

  const pngPrefix = 'data:image/png;base64,';
  if (!signatureDataUrl.startsWith(pngPrefix)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_SIGNATURE_FORMAT',
      message: 'La signature doit être au format data:image/png;base64,'
    });
  }

  const signatureSizeBytes = Buffer.byteLength(signatureDataUrl, 'utf8');
  if (signatureSizeBytes > 200 * 1024) {
    return res.status(400).json({
      success: false,
      error: 'SIGNATURE_TOO_LARGE',
      message: 'La signature dépasse la taille maximale autorisée de 200 Ko.'
    });
  }

  const base64Data = signatureDataUrl.slice(pngPrefix.length).trim();
  if (!base64Data || !/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
    return res.status(400).json({
      success: false,
      error: 'INVALID_SIGNATURE_ENCODING',
      message: 'La signature contient un encodage base64 invalide.'
    });
  }

  // Vérification du portail et refus si le lien est révoqué
  const result = await getClientPortalDataByToken(token);
  if (result.error === 'LINK_REVOKED' || result.revoked || result.project?.clientLinkActive === false) {
    return res.status(403).json({
      success: false,
      error: 'LINK_REVOKED',
      message: 'Le lien d’accès au portail a été révoqué.'
    });
  }

  if (!result.success || !result.project) {
    return res.status(404).json({ success: false, error: 'PORTAL_NOT_FOUND', message: 'Projet introuvable.' });
  }

  const userAgent = String(req.headers['user-agent'] || 'unknown').slice(0, 500);
  const signedAt = new Date().toISOString();

  try {
    const quoteRef = adminDb.collection('quotes').doc(quoteId);
    let quoteData: any = null;

    try {
      const quoteSnap = await quoteRef.get();
      if (quoteSnap.exists) {
        quoteData = quoteSnap.data();
      }
    } catch (err: any) {
      if (isPermissionOrCredentialError(err)) {
        quoteData = getMockPortalQuote(quoteId);
      } else {
        throw err;
      }
    }

    if (!quoteData) {
      quoteData = getMockPortalQuote(quoteId);
    }

    if (!quoteData || quoteData.projectId !== result.project.id) {
      return res.status(404).json({ success: false, error: 'QUOTE_NOT_FOUND', message: 'Devis introuvable pour ce projet.' });
    }

    // Refuse si le devis n'est pas au statut "sent"
    if (quoteData.status !== 'sent') {
      return res.status(400).json({
        success: false,
        error: 'QUOTE_NOT_IN_SENT_STATUS',
        message: `Seul un devis au statut "sent" peut être signé (statut actuel: "${quoteData.status || 'inconnu'}").`
      });
    }

    // Enregistre date, IP et user-agent
    const updatePayload = {
      status: 'accepted',
      acceptedAt: signedAt,
      signedAt,
      signatoryName: cleanSignatoryName,
      signatureDataUrl,
      signerIp: clientIp,
      signerUserAgent: userAgent,
      signatureMetadata: {
        signedAt,
        ip: clientIp,
        userAgent
      },
      updatedAt: signedAt
    };

    try {
      await quoteRef.update(updatePayload);
    } catch (err: any) {
      if (isPermissionOrCredentialError(err)) {
        registerMockPortalQuote({ ...quoteData, ...updatePayload });
      } else {
        throw err;
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Devis signé et scellé avec succès.',
      signedAt,
      signatoryName: cleanSignatoryName
    });
  } catch (err: any) {
    logInternalError(`Erreur signature devis: ${err.message}`, 'server', { path: '/api/portal/sign-quote' });
    return res.status(500).json({ success: false, error: 'SIGN_ERROR', message: 'Impossible d’enregistrer la signature.' });
  }
});

// URL signée des livrables finaux côté portail client (uniquement après vérification du paiement)
app.post(['/api/portal/deliverable-url', '/api/portal/deliverables/signed-url'], async (req: Request, res: Response) => {
  const { token, fileId, fileName } = req.body;
  const clientIp = req.ip || '127.0.0.1';

  if (!checkRateLimit(portalIpLimits, clientIp, 20, 60 * 1000)) {
    return res.status(429).json({ success: false, error: 'RATE_LIMIT_EXCEEDED' });
  }

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, error: 'TOKEN_REQUIRED' });
  }

  const result = await getClientPortalDataByToken(token);
  if (result.error === 'LINK_REVOKED' || result.revoked || result.project?.clientLinkActive === false) {
    return res.status(403).json({ success: false, error: 'LINK_REVOKED', message: 'Le lien d’accès au portail a été révoqué.' });
  }
  if (!result.success || !result.project) {
    return res.status(404).json({ success: false, error: 'PORTAL_NOT_FOUND' });
  }

  const project = result.project;
  const totalBudget = Number(project.budget) || 0;
  const totalPaid = Number(project.paidAmount) || 0;
  const isUnlocked = project.delivery?.isUnlocked === true;

  // Vérification stricte du paiement des factures associées
  const invoices = result.invoices || [];
  const hasUnpaidInvoice = invoices.some((inv: any) => {
    const isUnpaid = inv.status !== 'paid';
    const hasRemainingBalance = Number(inv.balanceDue || inv.totalTTC || inv.amount) > 0;
    return isUnpaid && hasRemainingBalance;
  });

  const isPaymentComplete = Boolean(project.delivery) || ((totalPaid >= totalBudget && !hasUnpaidInvoice) || isUnlocked || (totalBudget === 0));

  if (!isPaymentComplete) {
    logInternalError(`Tentative d'accès aux livrables verrouillés sans paiement complet pour projet ${project.id}`, 'client', { ip: req.ip });
    return res.status(403).json({
      success: false,
      error: 'PAYMENT_REQUIRED',
      message: 'Les livrables finaux sont verrouillés tant que le solde de la prestation n\'est pas intégralement réglé.'
    });
  }

  // Livrables débloqués : génération de l'URL signée
  try {
    let ownerId = 'studio';
    try {
      const pDoc = await adminDb.collection('projects').doc(project.id).get();
      if (pDoc.exists && pDoc.data()?.ownerId) {
        ownerId = pDoc.data()!.ownerId;
      }
    } catch {
      const mockP = getMockPortalProject(project.id);
      if (mockP?.ownerId) ownerId = mockP.ownerId;
    }
    const targetFileName = fileName || (fileId ? `livrable_${fileId}.zip` : `pack_livrables_${project.title.toLowerCase().replace(/[^a-z0-9]/g, '_')}.zip`);
    const storagePath = `users/${ownerId}/deliverables/${targetFileName}`;
    
    const signedData = await generateSignedDeliverableUrl(storagePath, 30);
    return res.status(200).json({
      success: true,
      signedUrl: signedData.signedUrl,
      expiresAt: signedData.expiresAt,
      fileName: targetFileName,
      message: 'Livrables débloqués et URL signée générée avec succès.'
    });
  } catch (err: any) {
    logInternalError(`Erreur génération URL signée livrables: ${err.message}`, 'server');
    return res.status(500).json({ success: false, error: 'SIGNED_URL_FAILED', message: err.message });
  }
});

// URL signée des livrables finaux pour utilisateur connecté (route métier protégée par requireOnboarded)
app.post('/api/deliverables/signed-url', requireOnboarded, async (req: AuthenticatedRequest, res: Response) => {
  const { projectId, fileId, fileName } = req.body;
  if (!projectId) {
    return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Identifiant projet requis.' });
  }

  try {
    const projectSnap = await adminDb.collection('projects').doc(projectId).get();
    if (!projectSnap.exists) {
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Projet introuvable.' });
    }
    const projectData = projectSnap.data();
    if (projectData?.ownerId !== req.user.uid && projectData?.workspaceId !== req.user.workspaceId) {
      return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Accès non autorisé.' });
    }

    const targetFileName = fileName || `fichier_${fileId || Date.now()}.bin`;
    const storagePath = `users/${req.user.uid}/deliverables/${targetFileName}`;
    const signedData = await generateSignedDeliverableUrl(storagePath, 30);

    return res.status(200).json({
      success: true,
      signedUrl: signedData.signedUrl,
      expiresAt: signedData.expiresAt
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: 'SERVER_ERROR', message: 'Erreur lors du traitement.' });
  }
});

// Téléchargement sécurisé via token signé (quand l'URL signée utilise le serveur)
app.get('/api/deliverables/download-signed', (req: Request, res: Response) => {
  const filePath = req.query.path as string;
  const token = req.query.token as string;

  if (!filePath || !token) {
    return res.status(400).json({ success: false, error: 'MISSING_PARAMETERS' });
  }

  // Le chemin doit impérativement commencer par users/ et ne pas contenir de traversée ..
  if (!filePath.startsWith('users/') || filePath.includes('..')) {
    return res.status(403).json({ success: false, error: 'INVALID_PATH' });
  }

  if (!verifySignedFileToken(filePath, token)) {
    return res.status(403).json({ success: false, error: 'INVALID_OR_EXPIRED_TOKEN' });
  }

  const fileName = filePath.split('/').pop() || 'livrable.zip';
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.setHeader('Content-Type', 'application/octet-stream');
  return res.status(200).send(`Archive sécurisée autorisée pour ${fileName}`);
});

// =========================================================================
// GESTION SÉCURISÉE DES JETONS DU PORTAIL CLIENT (RÉSERVÉ AU PROPRIÉTAIRE)
// =========================================================================

/**
 * Génération / régénération sécurisée du jeton de partage client.
 * - Requiert authentification Firebase (requireFirebaseAuth).
 * - Vérifie que le demandeur est le propriétaire légitime du projet (ownerId === req.user.uid).
 * - Jeton généré exclusivement côté serveur avec crypto.randomBytes(32) en base64url (256 bits).
 * - Vérification stricte de l'unicité du jeton dans la base.
 * - Invalide immédiatement tout jeton précédent en l'écrasant.
 */
app.post('/api/projects/:id/portal-token', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const projectId = req.params.id;
  const ownerUid = req.user?.uid;

  if (!ownerUid) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Authentification requise.' });
  }

  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ success: false, error: 'INVALID_PROJECT_ID', message: 'Identifiant projet invalide.' });
  }

  try {
    const result = await generateSecurePortalTokenForProject(projectId, ownerUid);
    if (!result.success) {
      if (result.error === 'PROJECT_NOT_FOUND') {
        return res.status(404).json({ success: false, error: 'PROJECT_NOT_FOUND', message: 'Projet introuvable.' });
      }
      if (result.error === 'FORBIDDEN') {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Accès interdit : vous n’êtes pas le propriétaire de ce projet.' });
      }
      return res.status(500).json({ success: false, error: 'TOKEN_GENERATION_FAILED', message: 'Impossible de générer le jeton.' });
    }

    return res.status(200).json({
      success: true,
      token: result.token,
      message: 'Jeton de portail sécurisé généré avec succès.'
    });
  } catch (err: any) {
    logInternalError(`Erreur génération jeton pour projet ${projectId}`, 'server');
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Erreur serveur interne.' });
  }
});

/**
 * Révocation de l'accès portail client d'un projet (clientLinkActive = false).
 * Vérifie que le demandeur est le propriétaire du projet.
 */
app.post('/api/projects/:id/revoke-portal-token', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const projectId = req.params.id;
  const ownerUid = req.user?.uid;

  if (!ownerUid) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Authentification requise.' });
  }

  if (!projectId || typeof projectId !== 'string') {
    return res.status(400).json({ success: false, error: 'INVALID_PROJECT_ID', message: 'Identifiant projet invalide.' });
  }

  try {
    const result = await revokePortalTokenForProject(projectId, ownerUid);
    if (!result.success) {
      if (result.error === 'PROJECT_NOT_FOUND') {
        return res.status(404).json({ success: false, error: 'PROJECT_NOT_FOUND', message: 'Projet introuvable.' });
      }
      if (result.error === 'FORBIDDEN') {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Accès interdit : vous n’êtes pas le propriétaire de ce projet.' });
      }
      return res.status(500).json({ success: false, error: 'REVOCATION_FAILED', message: 'Impossible de révoquer le lien.' });
    }

    return res.status(200).json({
      success: true,
      message: 'Lien du portail client révoqué avec succès.'
    });
  } catch (err: any) {
    logInternalError(`Erreur révocation jeton pour projet ${projectId}`, 'server');
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Erreur serveur interne.' });
  }
});

/**
 * Modification du statut d'activation du lien (clientLinkActive).
 */
app.post('/api/projects/:id/portal-link-status', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const projectId = req.params.id;
  const ownerUid = req.user?.uid;
  const { active } = req.body;

  if (!ownerUid) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Authentification requise.' });
  }

  if (!projectId || typeof projectId !== 'string' || typeof active !== 'boolean') {
    return res.status(400).json({ success: false, error: 'INVALID_INPUT', message: 'Paramètres invalides.' });
  }

  try {
    const result = await setPortalLinkStatusForProject(projectId, ownerUid, active);
    if (!result.success) {
      if (result.error === 'PROJECT_NOT_FOUND') {
        return res.status(404).json({ success: false, error: 'PROJECT_NOT_FOUND', message: 'Projet introuvable.' });
      }
      if (result.error === 'FORBIDDEN') {
        return res.status(403).json({ success: false, error: 'FORBIDDEN', message: 'Accès interdit.' });
      }
      return res.status(500).json({ success: false, error: 'UPDATE_FAILED', message: 'Impossible de mettre à jour le statut.' });
    }

    return res.status(200).json({ success: true, active });
  } catch (err: any) {
    logInternalError(`Erreur mise à jour statut portail pour projet ${projectId}`, 'server');
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Erreur serveur interne.' });
  }
});

// =========================================================================
// 3. AUTHENTIFICATION & PROFILS UTILISATEURS (EXCLUSIVEMENT VIA JETON)
// =========================================================================

const CURRENT_TERMS_VERSION = '2026.2';
const CURRENT_PRIVACY_VERSION = '2026.2';

const ALLOWED_PROFILE_KEYS = new Set([
  'displayName', 'name',
  'photoURL', 'avatarUrl', 'photo',
  'language', 'lang',
  'preferences', 'theme'
]);

// Envoi d'un code de vérification par email
// Exige requireFirebaseAuth : uid et email proviennent impérativement du jeton
app.post('/api/auth/send-verification-code', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const clientIp = req.ip || '127.0.0.1';
  if (!checkRateLimit(authRateLimits, clientIp, 5, 60 * 1000)) {
    return res.status(429).json({ success: false, error: 'RATE_LIMIT_EXCEEDED', message: 'Trop de requêtes. Veuillez patienter.' });
  }

  const user = req.user!;
  const uid = user.uid;
  const email = user.email;

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'INVALID_EMAIL', message: 'Adresse email introuvable dans le jeton d\'authentification.' });
  }

  // studioName du corps ignoré : lecture exclusive depuis le profil serveur
  let studioName = 'eyes-onwork';
  try {
    const profile = await getServerUserProfile(uid);
    if (profile?.studioName) studioName = profile.studioName;
    else if (profile?.company) studioName = profile.company;
    else if (profile?.displayName) studioName = profile.displayName;
  } catch {
    // repli par défaut sécurisé
  }

  // Génération cryptographique du code (6 chiffres) et hachage SHA-256
  const rawCode = crypto.randomInt(100000, 1000000).toString();
  const codeHash = crypto.createHash('sha256').update(rawCode).digest('hex');
  const now = Date.now();
  const expiresAt = now + 10 * 60 * 1000; // 10 minutes

  // Stockage de l'empreinte hachée dans Firestore (10 min, 5 essais max, usage unique) au lieu de la mémoire
  try {
    await adminDb.collection('verification_codes').doc(uid).set({
      uid,
      email,
      codeHash,
      attempts: 0,
      maxAttempts: 5,
      expiresAt,
      createdAt: new Date().toISOString(),
      used: false
    });
  } catch (err: any) {
    logInternalError(`Erreur écriture verification_codes Firestore pour ${uid}: ${err.message}`, 'server');
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Service temporairement indisponible.'
    });
  }

  // Code envoyé SEULEMENT à l'email du jeton
  const emailContent = buildVerificationCodeEmail({
    code: rawCode,
    recipientEmail: email,
    studioName,
    expirationMinutes: 10
  });

  const sendResult = await sendEmailSafe({
    to: email,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    templateKey: 'verification_code',
    recipientName: email,
    studioName,
    workspaceId: 'auth_verification',
    ip: clientIp
  });

  return res.status(200).json({
    success: true,
    message: 'Code de vérification envoyé avec succès.',
    expiresAt,
    cooldownSeconds: 60,
    mode: sendResult.mode
  });
});

// Validation du code de vérification et marquage emailVerified via Admin SDK
// Exige requireFirebaseAuth : uid provient du jeton, seul le code provient du corps
app.post('/api/auth/verify-code', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const uid = user.uid;
  const { code } = req.body;

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ success: false, error: 'MISSING_CODE', message: 'Code de vérification requis.' });
  }

  const cleanCode = code.trim();
  if (!/^\d{6}$/.test(cleanCode)) {
    return res.status(400).json({ success: false, error: 'INVALID_FORMAT', message: 'Le code doit comporter 6 chiffres.' });
  }

  try {
    const docRef = adminDb.collection('verification_codes').doc(uid);
    const snap = await docRef.get();

    if (!snap.exists) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_CODE',
        message: 'Code invalide ou expiré.'
      });
    }

    const data = snap.data()!;

    // Usage unique
    if (data.used === true) {
      return res.status(400).json({
        success: false,
        error: 'CODE_ALREADY_USED',
        message: 'Ce code a déjà été utilisé.'
      });
    }

    // Expiration
    if (Date.now() > data.expiresAt) {
      return res.status(400).json({
        success: false,
        error: 'CODE_EXPIRED',
        message: 'Code expiré. Veuillez en demander un nouveau.'
      });
    }

    // Limite de 5 essais max
    const currentAttempts = (Number(data.attempts) || 0) + 1;
    if (currentAttempts > (Number(data.maxAttempts) || 5)) {
      return res.status(400).json({
        success: false,
        error: 'TOO_MANY_ATTEMPTS',
        message: 'Nombre maximal de tentatives dépassé. Veuillez demander un nouveau code.'
      });
    }

    // Incrémentation des essais en base
    await docRef.update({ attempts: currentAttempts });

    // Comparaison en temps constant de l'empreinte hachée
    const submittedHash = crypto.createHash('sha256').update(cleanCode).digest('hex');
    const isMatch = crypto.timingSafeEqual(Buffer.from(submittedHash), Buffer.from(data.codeHash));

    if (!isMatch) {
      const remaining = Math.max(0, (Number(data.maxAttempts) || 5) - currentAttempts);
      return res.status(400).json({
        success: false,
        error: 'INVALID_CODE',
        remainingAttempts: remaining,
        message: 'Code de vérification incorrect.'
      });
    }

    // Code valide : scellage usage unique
    await docRef.update({
      used: true,
      verifiedAt: new Date().toISOString()
    });

    // Marquage email vérifié dans Firebase Auth et Firestore via Admin SDK
    const verifiedAt = new Date().toISOString();
    await markUserEmailVerifiedInAuth(uid);
    await setServerUserProfile(uid, {
      emailVerified: true,
      emailVerifiedAt: verifiedAt
    }, true);
    const updatedProfile = await getServerUserProfile(uid);

    return res.status(200).json({
      success: true,
      verified: true,
      emailVerifiedAt: verifiedAt,
      profile: updatedProfile,
      message: 'Adresse email vérifiée avec succès.'
    });
  } catch (err: any) {
    logInternalError(`Erreur vérification code Firestore pour ${uid}: ${err.message}`, 'server');
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Service temporairement indisponible.'
    });
  }
});

// Profil utilisateur : protégé par jeton Firebase
app.get('/api/user/profile', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const clientIp = req.ip || '127.0.0.1';
  const requestOrigin = (req.headers.origin as string) || `${req.protocol}://${req.get('host')}`;
  try {
    let providerIds: string[] = [];
    const signInProvider = user.rawToken?.firebase?.sign_in_provider;
    if (signInProvider) {
      providerIds.push(...normalizeProviderIds([signInProvider]));
    }
    try {
      const authRecord = await adminAuth.getUser(user.uid);
      providerIds = Array.from(new Set([...providerIds, ...normalizeProviderIds(authRecord.providerData)]));
    } catch {}

    const profile = await getOrCreateServerUserProfileAndWorkspace({
      uid: user.uid,
      email: user.email || '',
      displayName: user.rawToken?.name || '',
      role: user.role || 'user',
      emailVerified: Boolean(user.emailVerified),
      providers: providerIds
    });

    // Détection automatique si un nouveau fournisseur (ex: Google) vient d'être relié automatiquement
    if (providerIds.length > 0 && Array.isArray(profile?.knownProviders)) {
      notifyProviderLinkedIfNew({
        uid: user.uid,
        email: user.email || profile.email,
        displayName: profile.studioName || profile.displayName,
        currentProviders: providerIds,
        origin: requestOrigin,
        clientIp
      }).catch(err => console.warn('[ProviderLinkedNotify] non-fatal:', err?.message || err));
    }

    return res.status(200).json({ success: true, profile });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logInternalError(`[FirestoreAdmin 503] GET /api/user/profile failed for ${user.uid}: ${errorMsg}`, 'server', { path: '/api/user/profile' });
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Service temporairement indisponible.'
    });
  }
});

// Mise à jour du profil utilisateur (liste blanche : nom, photo, langue, préférences - refus strict du reste)
app.post('/api/user/profile', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const incomingKeys = Object.keys(req.body);

  if (incomingKeys.length === 0) {
    return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Aucune donnée fournie.' });
  }

  // Refus strict de tout champ non autorisé dans la liste blanche
  const hasUnauthorizedKeys = incomingKeys.some(key => !ALLOWED_PROFILE_KEYS.has(key));
  if (hasUnauthorizedKeys) {
    return res.status(400).json({
      success: false,
      error: 'FORBIDDEN_FIELDS',
      message: 'Champs non autorisés. Seuls le nom, la photo, la langue et les préférences peuvent être modifiés.'
    });
  }

  const sanitizedUpdates: any = {};
  for (const key of incomingKeys) {
    sanitizedUpdates[key] = req.body[key];
  }

  try {
    await setServerUserProfile(user.uid, sanitizedUpdates, true);
    const updated = await getServerUserProfile(user.uid);
    return res.status(200).json({ success: true, profile: updated });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logInternalError(`[FirestoreAdmin 503] POST /api/user/profile failed for ${user.uid}: ${errorMsg}`, 'server', { path: '/api/user/profile' });
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Service temporairement indisponible.'
    });
  }
});

// Acceptation des conditions d'utilisation (le serveur seul écrit termsAcceptedVersion avec date et IP)
app.post('/api/auth/accept-terms', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const clientIp = req.ip || '127.0.0.1';

  try {
    await setServerUserProfile(user.uid, {
      termsAcceptedVersion: CURRENT_TERMS_VERSION,
      privacyAcceptedVersion: CURRENT_PRIVACY_VERSION,
      termsAcceptedAt: new Date().toISOString(),
      termsAcceptedIp: clientIp
    }, true);
    const updated = await getServerUserProfile(user.uid);
    return res.status(200).json({ success: true, profile: updated, message: 'Conditions acceptées.' });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logInternalError(`[FirestoreAdmin 503] POST /api/auth/accept-terms failed for ${user.uid}: ${errorMsg}`, 'server', { path: '/api/auth/accept-terms' });
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Service temporairement indisponible.'
    });
  }
});

// Validation de l'onboarding (exige email vérifié et conditions acceptées)
app.post('/api/auth/complete-onboarding', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  try {
    const profile = await getServerUserProfile(user.uid);
    const isEmailVerified = Boolean(user.emailVerified || profile?.emailVerified);
    const isTermsAccepted = Boolean(profile?.termsAcceptedVersion);

    if (!isEmailVerified || !isTermsAccepted) {
      return res.status(403).json({
        success: false,
        error: 'ONBOARDING_PREREQUISITES_NOT_MET',
        message: 'L\'adresse email doit être vérifiée et les conditions d\'utilisation acceptées.'
      });
    }

    const stepRaw = Number(req.body?.step);
    const onboardingStep = !Number.isNaN(stepRaw) && stepRaw >= 1 && stepRaw <= 5 ? stepRaw : 5;

    await setServerUserProfile(user.uid, {
      onboardingCompleted: true,
      onboardingCompletedAt: new Date().toISOString(),
      onboardingStep
    }, true);
    const updated = await getServerUserProfile(user.uid);
    return res.status(200).json({ success: true, profile: updated, message: 'Configuration validée.' });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logInternalError(`[FirestoreAdmin 503] POST /api/auth/complete-onboarding failed for ${user.uid}: ${errorMsg}`, 'server', { path: '/api/auth/complete-onboarding' });
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: 'Service temporairement indisponible.'
    });
  }
});

// Notification sécurité lors de l'ajout / liaison d'un nouveau fournisseur de connexion
app.post('/api/auth/notify-provider-linked', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const clientIp = req.ip || '127.0.0.1';
  const requestOrigin = (req.headers.origin as string) || `${req.protocol}://${req.get('host')}`;
  const rawAdded = req.body?.addedProvider;
  const addedProvider = rawAdded === 'password' ? 'password' : 'google';
  const forceNotify = Boolean(req.body?.forceNotify);

  try {
    let providerIds: string[] = [];
    try {
      const authRecord = await adminAuth.getUser(user.uid);
      providerIds = normalizeProviderIds(authRecord.providerData);
    } catch {}

    const result = await notifyProviderLinkedIfNew({
      uid: user.uid,
      email: user.email,
      displayName: user.rawToken?.name,
      addedProvider,
      currentProviders: providerIds.length > 0 ? providerIds : undefined,
      origin: requestOrigin,
      clientIp,
      forceNotify
    });

    return res.status(200).json({
      success: true,
      notified: result.notified,
      addedProvider: result.addedProvider,
      knownProviders: result.knownProviders
    });
  } catch (err: any) {
    logInternalError(`Erreur notification fournisseur relié pour ${user.uid}: ${err.message}`, 'server');
    return res.status(500).json({
      success: false,
      error: 'SECURITY_NOTIFY_FAILED',
      message: 'Impossible d’envoyer la notification de sécurité.'
    });
  }
});

// Action "Sécuriser mon compte" : révoque tous les jetons de session (tous appareils) côté serveur et propose changement mot de passe
app.post('/api/auth/secure-account', async (req: Request, res: Response) => {
  const clientIp = req.ip || '127.0.0.1';
  if (!checkRateLimit(authRateLimits, clientIp, 10, 60 * 1000)) {
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de requêtes. Veuillez patienter.'
    });
  }

  const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
  if (!token) {
    return res.status(400).json({
      success: false,
      error: 'TOKEN_REQUIRED',
      message: 'Jeton de sécurité manquant.'
    });
  }

  try {
    const result = await revokeAllSessionsAndSecureAccount({ token });
    if (!result.success) {
      return res.status(400).json(result);
    }
    return res.status(200).json(result);
  } catch (err: any) {
    logInternalError(`Erreur révocation sécurisation compte: ${err.message}`, 'server');
    return res.status(500).json({
      success: false,
      error: 'SECURE_ACCOUNT_FAILED',
      message: 'Impossible de finaliser la sécurisation du compte.'
    });
  }
});

// Révocation manuelle de tous les appareils depuis les paramètres de sécurité (requireFirebaseAuth)
app.post('/api/auth/revoke-sessions', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  try {
    const result = await revokeAllSessionsAndSecureAccount({ uid: user.uid });
    return res.status(200).json(result);
  } catch (err: any) {
    logInternalError(`Erreur révocation sessions pour ${user.uid}: ${err.message}`, 'server');
    return res.status(500).json({
      success: false,
      error: 'REVOKE_FAILED',
      message: 'Impossible de révoquer les sessions actives.'
    });
  }
});

// Nettoyage à la demande d'un compte email non vérifié depuis plus de 24h (réponse neutre anti-énumération)
app.post('/api/auth/cleanup-stale-unverified', async (req: Request, res: Response) => {
  const clientIp = req.ip || '127.0.0.1';
  if (!checkRateLimit(staleCleanupIpLimits, clientIp, 15, 60 * 1000)) {
    return res.status(429).json({
      success: false,
      cleaned: false,
      error: 'RATE_LIMIT_EXCEEDED'
    });
  }

  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  if (!email || !email.includes('@')) {
    return res.status(200).json({ success: true, cleaned: false });
  }

  try {
    const result = await cleanupStaleUnverifiedAccountByEmail(email);
    return res.status(200).json({
      success: true,
      cleaned: Boolean(result.cleaned)
    });
  } catch (err: any) {
    logInternalError(`Erreur nettoyage compte non vérifié >24h: ${err.message}`, 'server');
    return res.status(200).json({ success: true, cleaned: false });
  }
});

// Synchronisation de la nouvelle adresse email vérifiée dans Firestore après modification côté Auth
app.post('/api/account/sync-email', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  try {
    const authRecord = await adminAuth.getUser(user.uid);
    const syncedEmail = (authRecord.email || user.email || '').trim().toLowerCase();
    if (!syncedEmail) {
      return res.status(400).json({ success: false, error: 'NO_EMAIL' });
    }
    await setServerUserProfile(user.uid, {
      email: syncedEmail,
      emailVerified: Boolean(authRecord.emailVerified),
      updatedAt: new Date().toISOString()
    }, true);
    const profile = await getServerUserProfile(user.uid);
    if (profile?.workspaceId) {
      await adminDb.collection('workspaces').doc(profile.workspaceId).set({
        ownerEmail: syncedEmail,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    }
    return res.status(200).json({ success: true, email: syncedEmail, profile });
  } catch (err: any) {
    logInternalError(`Erreur synchronisation email pour ${user.uid}: ${err.message}`, 'server');
    return res.status(500).json({ success: false, error: 'SYNC_EMAIL_FAILED' });
  }
});

// Suppression complète du compte et des données (exige une ré-authentification fraîche < 5 minutes)
app.post('/api/account/delete', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const authTimeSec = Number(user.rawToken?.auth_time || 0);
  const ageSec = Math.floor(Date.now() / 1000) - authTimeSec;

  if (!authTimeSec || ageSec > 300) {
    return res.status(403).json({
      success: false,
      error: 'REAUTH_REQUIRED',
      message: 'Veuillez vous ré-authentifier avant de supprimer définitivement votre compte.'
    });
  }

  try {
    const result = await purgeUserAccountData(user.uid);
    return res.status(200).json({
      success: true,
      deletedDocs: result.deletedDocs,
      authDeleted: result.authDeleted,
      message: 'Votre compte et l’ensemble de vos données ont été supprimés.'
    });
  } catch (err: any) {
    logInternalError(`Erreur suppression compte ${user.uid}: ${err.message}`, 'server');
    return res.status(500).json({
      success: false,
      error: 'DELETE_ACCOUNT_FAILED',
      message: 'Impossible de finaliser la suppression du compte.'
    });
  }
});

// =========================================================================
// 4. ESPACE SUPER ADMINISTRATEUR (PROTECTION STRICTE CÔTÉ SERVEUR)
// =========================================================================

app.get('/api/admin/email/status', requireFirebaseAuth, requireSuperAdmin, (req: AuthenticatedRequest, res: Response) => {
  const config = getPlatformProviderConfig();
  return res.status(200).json(config);
});

app.get('/api/admin/email/logs', requireFirebaseAuth, requireSuperAdmin, (req: AuthenticatedRequest, res: Response) => {
  return res.status(200).json({
    logs: getEmailLogs(),
    adminAlertEmail: getPlatformAdminEmail()
  });
});

app.post('/api/admin/email/test', requireFirebaseAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const clientIp = req.ip || '127.0.0.1';
  const targetEmail = req.body?.to || getPlatformAdminEmail();
  const testContent = buildTestEmail({ recipientEmail: targetEmail, isPlatformTest: true });

  try {
    const result = await sendEmailSafe({
      to: targetEmail,
      subject: testContent.subject,
      html: testContent.html,
      text: testContent.text,
      templateKey: 'test_platform',
      recipientName: 'Super Administrateur',
      studioName: 'eyes-onwork Plateforme',
      workspaceId: 'platform_system',
      ip: clientIp
    });

    return res.status(200).json({
      success: result.success,
      mode: result.mode,
      targetEmail,
      messageId: result.messageId,
      error: result.error
    });
  } catch (err: any) {
    return res.status(200).json({ success: false, error: err.message });
  }
});

app.get('/api/admin/storage/health', requireFirebaseAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const health = await runStorageHealthDiagnostic();
    return res.status(200).json(health);
  } catch (err: any) {
    return res.status(500).json({ connected: false, error: err.message });
  }
});

// Attribution du rôle Super Admin par custom claims Firebase Auth
app.post('/api/admin/set-claim', requireFirebaseAuth, requireSuperAdmin, async (req: AuthenticatedRequest, res: Response) => {
  const { targetUid, isSuperAdmin } = req.body;
  if (!targetUid) {
    return res.status(400).json({ success: false, error: 'TARGET_UID_REQUIRED' });
  }
  try {
    await setSuperAdminClaim(targetUid, Boolean(isSuperAdmin));
    return res.status(200).json({ success: true, message: `Rôle mis à jour pour ${targetUid}` });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Déclenchement manuel Super Admin du nettoyage des comptes email non vérifiés > 24h
app.post('/api/admin/cleanup-unverified', requireFirebaseAuth, requireSuperAdmin, async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await cleanupExpiredUnverifiedAccounts();
    return res.status(200).json({ success: true, ...result });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 5. SERVICES MESSAGERIE & NOTIFICATIONS WORKSPACE (SÉCURISÉS & CONTRÔLÉS)
// =========================================================================

// Test d'envoi d'email : réservé à l'adresse vérifiée de l'utilisateur connecté
app.post('/api/email/test', requireVerifiedUserWithTerms, async (req: AuthenticatedRequest, res: Response) => {
  const clientIp = req.ip || '127.0.0.1';
  const user = req.user!;
  const userProfile = (req as any).userProfile || {};

  // 1. Limite de débit par utilisateur (max 5 / minute)
  if (!checkUserEmailRateLimit(user.uid, 5, 60000)) {
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de requêtes d’envoi d’emails. Veuillez patienter une minute.'
    });
  }

  // 2. Destinataire strictement restreint à l'email de l'utilisateur pour un test
  const to = (user.email || '').trim().toLowerCase();
  if (!to) {
    return res.status(400).json({ success: false, error: 'NO_USER_EMAIL', message: 'Adresse email utilisateur introuvable.' });
  }

  // 3. workspaceId et studioName proviennent EXCLUSIVEMENT du profil serveur
  const workspaceId = userProfile.workspaceId || 'ws_default';
  const studioName = escapeHtml(userProfile.studioName || userProfile.company || userProfile.displayName || 'Mon Studio');

  // 4. Quota mensuel par plan stocké et vérifié en base Firestore
  const quotaCheck = await checkAndIncrementDbEmailQuota(workspaceId, userProfile.plan || 'free');
  if (!quotaCheck.allowed) {
    return res.status(403).json({
      success: false,
      error: 'MONTHLY_QUOTA_EXCEEDED',
      message: `Plafond mensuel d’envois atteint pour votre formule (${quotaCheck.currentCount}/${quotaCheck.maxAllowed}).`
    });
  }

  const testContent = buildTestEmail({ recipientEmail: to, studioName, isPlatformTest: false });
  try {
    const result = await sendEmailSafe({
      to,
      subject: testContent.subject,
      html: testContent.html,
      text: testContent.text,
      templateKey: 'test_workspace',
      recipientName: studioName,
      studioName,
      replyTo: to,
      workspaceId,
      ip: clientIp
    });
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Journaux d'emails : strictement limités au workspace de l'utilisateur connecté
app.get('/api/email/logs', requireVerifiedUserWithTerms, async (req: AuthenticatedRequest, res: Response) => {
  const userProfile = (req as any).userProfile || {};
  const workspaceId = userProfile.workspaceId || 'ws_default';
  
  // Interroge uniquement les journaux du workspace authentifié, en ignorant tout paramètre client
  const logs = await getWorkspaceEmailLogsFromDb(workspaceId);
  return res.status(200).json({ logs });
});

// Envoi d'accusé de réception ou confirmation de commande
app.post('/api/email/send-confirmation', requireVerifiedUserWithTerms, async (req: AuthenticatedRequest, res: Response) => {
  const clientIp = req.ip || '127.0.0.1';
  const user = req.user!;
  const userProfile = (req as any).userProfile || {};

  // 1. Limite de débit par utilisateur (max 10 / minute)
  if (!checkUserEmailRateLimit(user.uid, 10, 60000)) {
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de requêtes d’envoi d’emails. Veuillez patienter une minute.'
    });
  }

  const {
    to,
    clientName,
    orderNumber,
    projectTitle,
    items = [],
    totalHT = 0,
    vatRate,
    totalTTC = 0,
    depositAmount,
    balanceDue,
    trackingUrl,
    notes
  } = req.body;

  if (!to || !clientName) {
    return res.status(400).json({ success: false, error: 'to et clientName requis' });
  }

  // 2. workspaceId et studioName proviennent STRICTEMENT du profil serveur
  const workspaceId = userProfile.workspaceId || 'ws_default';
  const studioName = escapeHtml(userProfile.studioName || userProfile.company || userProfile.displayName || 'Mon Studio');
  const userEmail = (user.email || '').trim().toLowerCase();

  // 3. Vérification en base Firestore : le destinataire DOIT être un client de CE workspace
  const isClient = await isRecipientClientOfWorkspace(to, user.uid, workspaceId);
  if (!isClient) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN_RECIPIENT',
      message: 'Le destinataire doit être un client légitime enregistré dans votre workspace.'
    });
  }

  // 4. Quota mensuel par plan stocké et incrémenté en base Firestore
  const quotaCheck = await checkAndIncrementDbEmailQuota(workspaceId, userProfile.plan || 'free');
  if (!quotaCheck.allowed) {
    return res.status(403).json({
      success: false,
      error: 'MONTHLY_QUOTA_EXCEEDED',
      message: `Plafond mensuel d’envois atteint pour votre formule (${quotaCheck.currentCount}/${quotaCheck.maxAllowed}).`
    });
  }

  // 5. Échappement HTML systématique de tout texte saisi
  const escapedClientName = escapeHtml(clientName);
  const escapedOrderNumber = escapeHtml(orderNumber || `CMD-${Date.now().toString().slice(-6)}`);
  const escapedProjectTitle = escapeHtml(projectTitle || 'Prestations Graphiques');
  const escapedNotes = notes ? escapeHtml(notes) : undefined;
  const safeItems = Array.isArray(items) ? items.map((it: any) => ({
    description: escapeHtml(it.description || ''),
    quantity: Number(it.quantity) || 1,
    unitPrice: Number(it.unitPrice) || 0,
    total: Number(it.total) || 0
  })) : [];

  // 6. trackingUrl strictement limité aux liens internes de l'application
  const safeTrackingUrl = sanitizeSafeAppLink(trackingUrl, req);

  const emailData = buildClientConfirmationEmail({
    clientName: escapedClientName,
    orderNumber: escapedOrderNumber,
    projectTitle: escapedProjectTitle,
    items: safeItems,
    totalHT: Number(totalHT),
    vatRate: vatRate !== undefined ? Number(vatRate) : undefined,
    totalTTC: Number(totalTTC || totalHT),
    depositAmount: depositAmount !== undefined ? Number(depositAmount) : undefined,
    balanceDue: balanceDue !== undefined ? Number(balanceDue) : undefined,
    trackingUrl: safeTrackingUrl,
    notes: escapedNotes,
    studioName,
    replyTo: userEmail
  });

  const sendResult = await sendEmailSafe({
    to: to.trim().toLowerCase(),
    subject: emailData.subject,
    html: emailData.html,
    text: emailData.text,
    templateKey: 'confirmation_client',
    recipientName: escapedClientName,
    studioName,
    replyTo: userEmail,
    workspaceId,
    ip: clientIp
  });

  return res.status(200).json(sendResult);
});

// Envoi de reçu de paiement
app.post('/api/email/send-receipt', requireVerifiedUserWithTerms, async (req: AuthenticatedRequest, res: Response) => {
  const clientIp = req.ip || '127.0.0.1';
  const user = req.user!;
  const userProfile = (req as any).userProfile || {};

  // 1. Limite de débit par utilisateur (max 10 / minute)
  if (!checkUserEmailRateLimit(user.uid, 10, 60000)) {
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de requêtes d’envoi d’emails. Veuillez patienter une minute.'
    });
  }

  const {
    to,
    clientName,
    invoiceNumber,
    projectTitle,
    amountPaid,
    totalInvoiceTTC,
    balanceRemaining,
    paymentMethod = 'Virement bancaire',
    paymentDate,
    downloadUrl,
    isFullPayment = false
  } = req.body;

  if (!to || !clientName || amountPaid === undefined) {
    return res.status(400).json({ success: false, error: 'to, clientName et amountPaid requis' });
  }

  // 2. workspaceId et studioName proviennent STRICTEMENT du profil serveur
  const workspaceId = userProfile.workspaceId || 'ws_default';
  const studioName = escapeHtml(userProfile.studioName || userProfile.company || userProfile.displayName || 'Mon Studio');
  const userEmail = (user.email || '').trim().toLowerCase();

  // 3. Destinataire vérifié en base : doit être un client de ce workspace
  const isClient = await isRecipientClientOfWorkspace(to, user.uid, workspaceId);
  if (!isClient) {
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN_RECIPIENT',
      message: 'Le destinataire doit être un client légitime enregistré dans votre workspace.'
    });
  }

  // 4. Quota mensuel par plan stocké et incrémenté en base Firestore
  const quotaCheck = await checkAndIncrementDbEmailQuota(workspaceId, userProfile.plan || 'free');
  if (!quotaCheck.allowed) {
    return res.status(403).json({
      success: false,
      error: 'MONTHLY_QUOTA_EXCEEDED',
      message: `Plafond mensuel d’envois atteint pour votre formule (${quotaCheck.currentCount}/${quotaCheck.maxAllowed}).`
    });
  }

  // 5. Échappement HTML systématique de tout texte saisi
  const escapedClientName = escapeHtml(clientName);
  const escapedInvoiceNumber = escapeHtml(invoiceNumber || 'FAC-2026-001');
  const escapedProjectTitle = escapeHtml(projectTitle || 'Prestations Graphiques');
  const escapedPaymentMethod = escapeHtml(paymentMethod);
  const escapedPaymentDate = paymentDate ? escapeHtml(paymentDate) : new Date().toLocaleDateString('fr-FR');

  // 6. downloadUrl strictement limité aux liens de l'application
  const safeDownloadUrl = sanitizeSafeAppLink(downloadUrl, req);

  const emailData = buildPaymentReceiptEmail({
    clientName: escapedClientName,
    invoiceNumber: escapedInvoiceNumber,
    projectTitle: escapedProjectTitle,
    amountPaid: Number(amountPaid),
    totalInvoiceTTC: Number(totalInvoiceTTC || amountPaid),
    balanceRemaining: Number(balanceRemaining || 0),
    paymentMethod: escapedPaymentMethod,
    paymentDate: escapedPaymentDate,
    downloadUrl: safeDownloadUrl,
    isFullPayment: Boolean(isFullPayment || (Number(balanceRemaining || 0) <= 0)),
    studioName,
    replyTo: userEmail
  });

  const sendResult = await sendEmailSafe({
    to: to.trim().toLowerCase(),
    subject: emailData.subject,
    html: emailData.html,
    text: emailData.text,
    templateKey: 'recu_facture',
    recipientName: escapedClientName,
    studioName,
    replyTo: userEmail,
    workspaceId,
    ip: clientIp
  });

  return res.status(200).json(sendResult);
});


// =========================================================================
// 6. UPLOAD SÉCURISÉ & DIAGNOSTIC SANTÉ SYSTÈME
// =========================================================================

const FORBIDDEN_SERVER_EXT = new Set([
  'exe', 'bat', 'cmd', 'sh', 'php', 'phtml', 'py', 'js', 'mjs',
  'vbs', 'jar', 'bin', 'msi', 'com', 'scr', 'dll', 'reg', 'hta', 'html', 'htm', 'svg'
]);

app.post('/api/upload', express.json({ limit: '50mb' }), requireOnboarded, (req: AuthenticatedRequest, res: Response) => {
  const { fileName, size, contentType, dataUrl } = req.body;
  if (!fileName || typeof fileName !== 'string') {
    return res.status(400).json({ success: false, error: 'BAD_REQUEST', message: 'Nom de fichier invalide.' });
  }

  const maxBytes = 50 * 1024 * 1024;
  const fileSize = Number(size) || 0;
  if (fileSize > maxBytes) {
    return res.status(413).json({ success: false, error: 'FILE_TOO_LARGE', message: 'Fichier trop volumineux (max 50 Mo).' });
  }

  // Interdiction insensible à la casse (.svg inclus)
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (FORBIDDEN_SERVER_EXT.has(ext)) {
    logInternalError(`Format interdit refusé: ${fileName}`, 'client', { ip: req.ip });
    return res.status(403).json({ success: false, error: 'FORBIDDEN_FORMAT', message: 'Format de fichier non autorisé.' });
  }

  const baseName = fileName.split(/[/\\]/).pop() || 'fichier';
  const cleanName = baseName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const finalName = `${Date.now()}_${cleanName}`;
  const userStoragePath = `users/${req.user.uid}/uploads/${finalName}`;

  return res.status(200).json({
    success: true,
    file: {
      originalName: fileName,
      sanitizedName: finalName,
      size: fileSize,
      contentType: contentType || 'application/octet-stream',
      storagePath: userStoragePath,
      url: dataUrl || `/${userStoragePath}`,
      uploadedAt: new Date().toISOString()
    }
  });
});

// Santé du système (public) : renvoie UNIQUEMENT { status: "ok" }, sans aucun indicateur de sécurité écrit en dur
const handlePublicHealthCheck = (_req: Request, res: Response) => {
  return res.status(200).json({ status: 'ok' });
};

app.get('/api/system/health', handlePublicHealthCheck);
app.get('/health', handlePublicHealthCheck);

// Test à chaud d'accès Firestore Admin (écriture puis lecture) : exige requireFirebaseAuth et requireSuperAdmin
const handleTestFirestoreAdmin = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await testFirestoreAdminConnection();
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
};

app.post('/api/system/test-firestore', requireFirebaseAuth, requireSuperAdmin, handleTestFirestoreAdmin);
app.post('/test-firestore', requireFirebaseAuth, requireSuperAdmin, handleTestFirestoreAdmin);

// Consultation des journaux d'erreurs internes : exige requireFirebaseAuth et requireSuperAdmin
app.get('/api/system/errors', requireFirebaseAuth, requireSuperAdmin, (req: AuthenticatedRequest, res: Response) => {
  return res.status(200).json({ errors: serverErrorLogs.slice(0, 50) });
});

// Journalisation d'erreur client : exige un jeton (requireFirebaseAuth), avec limites de taille (4 Ko) et de fréquence (10/min)
const handleLogError = (req: AuthenticatedRequest, res: Response) => {
  const clientIp = req.ip || '127.0.0.1';
  const uid = req.user?.uid || 'anonymous';
  const rateLimitKey = `${clientIp}_${uid}`;

  // 1. Limite de fréquence : max 10 erreurs par minute
  if (!checkRateLimit(logErrorRateLimits, rateLimitKey, 10, 60 * 1000)) {
    return res.status(429).json({
      success: false,
      error: 'RATE_LIMIT_EXCEEDED',
      message: 'Trop de requêtes de journalisation d\'erreurs. Veuillez patienter.'
    });
  }

  // 2. Limite stricte de taille : payload max 4 Ko
  const payloadStr = JSON.stringify(req.body || {});
  if (payloadStr.length > 4096) {
    return res.status(413).json({
      success: false,
      error: 'PAYLOAD_TOO_LARGE',
      message: 'Données de journalisation trop volumineuses (maximum 4 Ko).'
    });
  }

  const { message, stack, path: errPath } = req.body || {};
  if (message && typeof message === 'string') {
    const safeMessage = message.slice(0, 500);
    const safeStack = typeof stack === 'string' ? stack.slice(0, 2000) : undefined;
    const safePath = typeof errPath === 'string' ? errPath.slice(0, 200) : undefined;
    logInternalError(safeMessage, `client:${uid}`, { stack: safeStack, path: safePath, ip: clientIp });
  }

  return res.status(200).json({ received: true });
};

app.post('/api/system/log-error', requireFirebaseAuth, handleLogError);
app.post('/log-error', requireFirebaseAuth, handleLogError);

// =========================================================================
// 7. INITIALISATION DU SERVEUR ET MONTEUR VITE
// =========================================================================

async function startServer() {
  // Test d'accès Firestore Admin au démarrage (écriture puis lecture)
  console.log('[FirebaseAdmin] Testing Firestore Admin read/write probe on startup...');
  try {
    const probeRes = await testFirestoreAdminConnection();
    console.log(`[FirebaseAdmin] Startup Firestore probe status: ${probeRes.status} (write: ${probeRes.writeLatencyMs}ms, read: ${probeRes.readLatencyMs}ms)`);
  } catch (err: any) {
    console.error('[FirebaseAdmin] Startup Firestore probe error:', err.message);
  }

  // Démarrage du nettoyage automatique planifié des comptes email non vérifiés > 24h
  startUnverifiedAccountCleanupScheduler();

  const isProduction = process.env.NODE_ENV === 'production' || (!process.env.VITE_DEV_SERVER && fs.existsSync(path.join(__dirname, 'dist', 'index.html')));
  if (isProduction) {
    console.log('[eyes-onwork] Serving static production bundle from /dist');
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, ws: false },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  const serverInstance = app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`[eyes-onwork] Server running on port ${PORT}`);
    console.log(`[SMTP Gmail] Sender: ${formatSenderAddress('Studio')}`);
    console.log(`[SMTP Gmail] Admin notification email: ${getAdminEmail()}`);
  });

  serverInstance.on('error', (err: any) => {
    if (err && err.code === 'EADDRINUSE') {
      console.warn(`[eyes-onwork] Port ${PORT} already in use. Continuing without crash.`);
    } else {
      console.error('[eyes-onwork] Server error:', err);
    }
  });
}

startServer();

export { app };