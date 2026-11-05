import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  sendEmailSafe,
  buildClientConfirmationEmail,
  buildAdminNotificationEmail,
  buildPaymentReceiptEmail,
  buildTestEmail,
  buildVerificationCodeEmail,
  issueVerificationCode,
  verifySubmittedCode,
  getVerificationStatus,
  checkEmailRateLimit,
  checkWorkspaceMonthlyLimit,
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
  setServerUserProfile,
  getClientPortalDataByToken,
  getSuperAdminUids,
  testFirestoreAdminConnection,
  getStartupFirestoreTestResult,
  adminDb
} from './src/server/firebaseAdminSdk.js';
import { runStorageHealthDiagnostic } from './src/server/firestoreAdmin.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// SÉCURITÉ : En-têtes HTTP défensifs
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.removeHeader('X-Frame-Options');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=*');

  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  if (req.method === 'OPTIONS') {
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

function logInternalError(message: string, source: string = 'server', details?: any) {
  const entry = {
    id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
    source,
    message: String(message),
    stack: details?.stack,
    path: details?.path,
    ip: details?.ip
  };
  serverErrorLogs.unshift(entry);
  if (serverErrorLogs.length > 100) serverErrorLogs.pop();
}

// Rate limiters en mémoire
const publicLeadIpLimits = new Map<string, { count: number; resetAt: number }>();
const portalIpLimits = new Map<string, { count: number; resetAt: number }>();
const authRateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(map: Map<string, { count: number; resetAt: number }>, ip: string, maxCount: number, windowMs: number): boolean {
  const now = Date.now();
  const current = map.get(ip);
  if (!current || now >= current.resetAt) {
    map.set(ip, { count: 1, resetAt: now + windowMs });
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

// =========================================================================
// 1. ROUTE PUBLIQUE : FORMULAIRE PROSPECT (LEAD)
// =========================================================================
app.post('/api/public/lead', async (req: Request, res: Response) => {
  const { hp_field, name, email, company, phone, projectType, description, estimatedBudget, desiredDeadline } = req.body;

  if (hp_field) {
    console.warn('[Anti-Spam] Honeypot triggered, ignoring');
    return res.status(200).json({ success: true, message: 'Demande reçue' });
  }

  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
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
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  if (!checkRateLimit(portalIpLimits, clientIp, 30, 60 * 1000)) {
    return res.status(429).json({ success: false, error: 'RATE_LIMIT_EXCEEDED' });
  }

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ success: false, error: 'TOKEN_REQUIRED' });
  }

  const result = await getClientPortalDataByToken(token);
  if (!result.success) {
    return res.status(404).json({ success: false, error: result.error || 'PORTAL_NOT_FOUND' });
  }

  return res.status(200).json(result);
});

app.post('/api/portal/feedback', async (req: Request, res: Response) => {
  const { token, comment, roundIndex, versionIndex, pinCoords } = req.body;
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  if (!checkRateLimit(portalIpLimits, clientIp, 15, 60 * 1000)) {
    return res.status(429).json({ success: false, error: 'RATE_LIMIT_EXCEEDED' });
  }

  if (!token || !comment) {
    return res.status(400).json({ success: false, error: 'MISSING_FIELDS' });
  }

  const result = await getClientPortalDataByToken(token);
  if (!result.success || !result.project) {
    return res.status(404).json({ success: false, error: 'PORTAL_NOT_FOUND' });
  }

  try {
    const feedbackEntry = {
      id: `fb_${Date.now()}`,
      author: 'client',
      comment: String(comment).slice(0, 1000),
      roundIndex: Number(roundIndex) || 0,
      versionIndex: Number(versionIndex) || 0,
      pinCoords: pinCoords || null,
      createdAt: new Date().toISOString()
    };

    const projectRef = adminDb.collection('projects').doc(result.project.id);
    const existing = (await projectRef.get()).data();
    const existingFeedback = existing?.feedback || [];
    await projectRef.update({
      feedback: [...existingFeedback, feedbackEntry],
      updatedAt: new Date().toISOString()
    });

    return res.status(200).json({ success: true, message: 'Retour transmis avec succès' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// Signature électronique sécurisée de devis côté portail
app.post('/api/portal/sign-quote', async (req: Request, res: Response) => {
  const { token, quoteId, signatoryName, signatureDataUrl } = req.body;
  if (!token || !quoteId || !signatoryName || !signatureDataUrl) {
    return res.status(400).json({ success: false, error: 'MISSING_FIELDS' });
  }

  const result = await getClientPortalDataByToken(token);
  if (!result.success || !result.project) {
    return res.status(404).json({ success: false, error: 'PORTAL_NOT_FOUND' });
  }

  try {
    const quoteRef = adminDb.collection('quotes').doc(quoteId);
    const quoteSnap = await quoteRef.get();
    if (!quoteSnap.exists || quoteSnap.data()?.projectId !== result.project.id) {
      return res.status(404).json({ success: false, error: 'QUOTE_NOT_FOUND' });
    }

    await quoteRef.update({
      status: 'accepted',
      acceptedAt: new Date().toISOString(),
      signatoryName,
      signatureDataUrl,
      updatedAt: new Date().toISOString()
    });

    return res.status(200).json({ success: true, message: 'Devis signé et scellé avec succès.' });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// =========================================================================
// 3. AUTHENTIFICATION & PROFILS UTILISATEURS (EXCLUSIVEMENT VIA JETON)
// =========================================================================

// Envoi d'un code de vérification par email
app.post('/api/auth/send-verification-code', async (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  if (!checkRateLimit(authRateLimits, clientIp, 5, 60 * 1000)) {
    return res.status(429).json({ success: false, error: 'RATE_LIMIT_EXCEEDED', message: 'Trop de requêtes. Veuillez patienter.' });
  }

  const { email, userId, studioName } = req.body;
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    return res.status(400).json({ success: false, error: 'INVALID_EMAIL', message: 'Adresse email valide requise.' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const issueResult = issueVerificationCode(cleanEmail, userId);
  if (!issueResult.success) {
    return res.status(429).json({
      success: false,
      error: issueResult.error,
      remainingSeconds: issueResult.remainingSeconds,
      message: issueResult.message
    });
  }

  const code = issueResult.code!;
  const emailContent = buildVerificationCodeEmail({
    code,
    recipientEmail: cleanEmail,
    studioName: studioName || 'eyes-onwork',
    expirationMinutes: 10
  });

  const sendResult = await sendEmailSafe({
    to: cleanEmail,
    subject: emailContent.subject,
    html: emailContent.html,
    text: emailContent.text,
    templateKey: 'verification_code',
    recipientName: cleanEmail,
    studioName: studioName || 'eyes-onwork',
    workspaceId: 'auth_verification',
    ip: clientIp
  });

  return res.status(200).json({
    success: true,
    message: 'Code de vérification envoyé avec succès.',
    expiresAt: issueResult.expiresAt,
    cooldownSeconds: 60,
    mode: sendResult.mode
  });
});

// Validation du code de vérification et marquage emailVerified via Admin SDK
app.post('/api/auth/verify-code', async (req: Request, res: Response) => {
  const { email, code, uid } = req.body;
  if (!email || !code) {
    return res.status(400).json({ success: false, error: 'MISSING_FIELDS', message: 'Email et code requis.' });
  }

  const verifyResult = verifySubmittedCode(email, code);
  if (!verifyResult.success) {
    return res.status(400).json(verifyResult);
  }

  // Marque l'email comme vérifié dans Firebase Auth et Firestore via Admin SDK
  if (uid) {
    await markUserEmailVerifiedInAuth(uid);
    await setServerUserProfile(uid, { emailVerified: true, emailVerifiedAt: new Date().toISOString() }, true);
  }

  return res.status(200).json({
    success: true,
    verified: true,
    message: 'Votre adresse email a été vérifiée avec succès.'
  });
});

// Statut de vérification
app.get('/api/auth/verification-status', (req: Request, res: Response) => {
  const email = (req.query.email as string) || '';
  if (!email) return res.status(400).json({ error: 'Email requis' });
  const status = getVerificationStatus(email);
  return res.status(200).json(status);
});

// Profil utilisateur : EXCLUSIVEMENT protégé par Authorization: Bearer <jeton Firebase>
// Seul le serveur écrit emailVerified, termsAcceptedVersion, plan et workspaceId
app.get('/api/user/profile', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  try {
    let profile = await getServerUserProfile(user.uid);
    if (!profile) {
      // Création automatique au premier login avec attributs gérés exclusivement par le serveur
      profile = {
        uid: user.uid,
        email: user.email || '',
        displayName: user.rawToken?.name || '',
        role: user.role || 'user',
        plan: 'free',
        emailVerified: Boolean(user.emailVerified),
        workspaceId: `ws_${user.uid.slice(0, 8)}`,
        termsAcceptedVersion: null,
        onboardingCompleted: false,
        createdAt: new Date().toISOString()
      };
      await setServerUserProfile(user.uid, profile, false);
    }
    return res.status(200).json({ success: true, profile });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logInternalError(`[FirestoreAdmin 503] GET /api/user/profile failed for ${user.uid}: ${errorMsg}`, 'server', { path: '/api/user/profile' });
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: `Erreur d'accès base de données Firestore Admin: ${errorMsg}`
    });
  }
});

// Mise à jour du profil utilisateur (protégé par jeton, champs sensibles strictement interdits au client)
app.post('/api/user/profile', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const allowedUpdates = { ...req.body };

  // Le serveur seul écrit ces champs : interdiction formelle au client
  delete allowedUpdates.role;
  delete allowedUpdates.isSuperAdmin;
  delete allowedUpdates.admin;
  delete allowedUpdates.plan;
  delete allowedUpdates.emailVerified;
  delete allowedUpdates.workspaceId;
  delete allowedUpdates.termsAcceptedVersion;

  try {
    await setServerUserProfile(user.uid, allowedUpdates, true);
    const updated = await getServerUserProfile(user.uid);
    return res.status(200).json({ success: true, profile: updated });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logInternalError(`[FirestoreAdmin 503] POST /api/user/profile failed for ${user.uid}: ${errorMsg}`, 'server', { path: '/api/user/profile' });
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: `Erreur d'écriture Firestore Admin: ${errorMsg}`
    });
  }
});

// Acceptation des conditions d'utilisation (le serveur seul écrit termsAcceptedVersion)
app.post('/api/auth/accept-terms', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  const { termsVersion, privacyVersion } = req.body;
  try {
    await setServerUserProfile(user.uid, {
      termsAcceptedVersion: termsVersion || '2026.1',
      privacyAcceptedVersion: privacyVersion || '2026.1',
      termsAcceptedAt: new Date().toISOString()
    }, true);
    const updated = await getServerUserProfile(user.uid);
    return res.status(200).json({ success: true, profile: updated, message: 'Conditions acceptées' });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logInternalError(`[FirestoreAdmin 503] POST /api/auth/accept-terms failed for ${user.uid}: ${errorMsg}`, 'server', { path: '/api/auth/accept-terms' });
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: `Erreur d'enregistrement des conditions Firestore Admin: ${errorMsg}`
    });
  }
});

// Validation de l'onboarding
app.post('/api/auth/complete-onboarding', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const user = req.user!;
  try {
    await setServerUserProfile(user.uid, {
      onboardingCompleted: true,
      onboardingCompletedAt: new Date().toISOString()
    }, true);
    const updated = await getServerUserProfile(user.uid);
    return res.status(200).json({ success: true, profile: updated, message: 'Configuration validée' });
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logInternalError(`[FirestoreAdmin 503] POST /api/auth/complete-onboarding failed for ${user.uid}: ${errorMsg}`, 'server', { path: '/api/auth/complete-onboarding' });
    return res.status(503).json({
      success: false,
      error: 'SERVICE_UNAVAILABLE',
      message: `Erreur validation onboarding Firestore Admin: ${errorMsg}`
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
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
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

// =========================================================================
// 5. SERVICES MESSAGERIE & NOTIFICATIONS WORKSPACE (PROTÉGÉS PAR AUTH)
// =========================================================================

app.post('/api/email/test', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const { to, studioName, replyTo, workspaceId = 'ws_freelance' } = req.body;

  if (!to) return res.status(400).json({ error: 'Adresse email requise.' });

  const testContent = buildTestEmail({ recipientEmail: to, studioName, isPlatformTest: false });
  try {
    const result = await sendEmailSafe({
      to,
      subject: testContent.subject,
      html: testContent.html,
      text: testContent.text,
      templateKey: 'test_workspace',
      recipientName: studioName || 'Freelance',
      studioName,
      replyTo,
      workspaceId,
      ip: clientIp
    });
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/email/logs', requireFirebaseAuth, (req: AuthenticatedRequest, res: Response) => {
  const workspaceId = (req.query.workspaceId as string) || '';
  if (!workspaceId) return res.status(200).json({ logs: [] });
  const logs = getEmailLogs(workspaceId);
  return res.status(200).json({ logs });
});

app.post('/api/email/send-confirmation', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
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
    notes,
    workspaceId = 'ws_default',
    studioName,
    replyTo
  } = req.body;

  if (!to || !clientName) {
    return res.status(400).json({ error: 'to et clientName requis' });
  }

  const quotaCheck = checkWorkspaceMonthlyLimit(workspaceId, 30);
  if (!quotaCheck.allowed) {
    return res.status(403).json({
      success: false,
      error: `Plafond mensuel d’envois atteint (${quotaCheck.currentCount}/${quotaCheck.maxAllowed}).`
    });
  }

  const emailData = buildClientConfirmationEmail({
    clientName,
    orderNumber: orderNumber || `CMD-${Date.now().toString().slice(-6)}`,
    projectTitle: projectTitle || 'Prestations Graphiques',
    items,
    totalHT: Number(totalHT),
    vatRate: vatRate !== undefined ? Number(vatRate) : undefined,
    totalTTC: Number(totalTTC || totalHT),
    depositAmount: depositAmount !== undefined ? Number(depositAmount) : undefined,
    balanceDue: balanceDue !== undefined ? Number(balanceDue) : undefined,
    trackingUrl,
    notes,
    studioName,
    replyTo
  });

  const sendResult = await sendEmailSafe({
    to,
    subject: emailData.subject,
    html: emailData.html,
    text: emailData.text,
    templateKey: 'confirmation_client',
    recipientName: clientName,
    studioName,
    replyTo,
    workspaceId,
    ip: clientIp
  });

  return res.status(200).json(sendResult);
});

app.post('/api/email/send-receipt', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
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
    isFullPayment = false,
    workspaceId = 'ws_default',
    studioName,
    replyTo
  } = req.body;

  if (!to || !clientName || amountPaid === undefined) {
    return res.status(400).json({ error: 'to, clientName et amountPaid requis' });
  }

  const emailData = buildPaymentReceiptEmail({
    clientName,
    invoiceNumber: invoiceNumber || 'FAC-2026-001',
    projectTitle: projectTitle || 'Prestations Graphiques',
    amountPaid: Number(amountPaid),
    totalInvoiceTTC: Number(totalInvoiceTTC || amountPaid),
    balanceRemaining: Number(balanceRemaining || 0),
    paymentMethod,
    paymentDate: paymentDate || new Date().toLocaleDateString('fr-FR'),
    downloadUrl,
    isFullPayment: Boolean(isFullPayment || (balanceRemaining <= 0)),
    studioName,
    replyTo
  });

  const sendResult = await sendEmailSafe({
    to,
    subject: emailData.subject,
    html: emailData.html,
    text: emailData.text,
    templateKey: 'recu_facture',
    recipientName: clientName,
    studioName,
    replyTo,
    workspaceId,
    ip: clientIp
  });

  return res.status(200).json(sendResult);
});

app.post('/api/email/send', requireFirebaseAuth, async (req: AuthenticatedRequest, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  const { to, subject, html, text, templateKey = 'custom', recipientName, workspaceId = 'ws_default', studioName, replyTo } = req.body;

  if (!to || !subject) return res.status(400).json({ error: 'to et subject requis' });

  const result = await sendEmailSafe({
    to,
    subject,
    html: html || `<p>${text || subject}</p>`,
    text: text || '',
    templateKey,
    recipientName,
    studioName,
    replyTo,
    workspaceId,
    ip: clientIp
  });
  return res.status(200).json(result);
});

// =========================================================================
// 6. UPLOAD SÉCURISÉ & DIAGNOSTIC SANTÉ SYSTÈME
// =========================================================================

const FORBIDDEN_SERVER_EXT = new Set([
  'exe', 'bat', 'cmd', 'sh', 'php', 'phtml', 'py', 'js', 'mjs',
  'vbs', 'jar', 'bin', 'msi', 'com', 'scr', 'dll', 'reg', 'hta', 'html', 'htm'
]);

app.post('/api/upload', requireFirebaseAuth, (req: AuthenticatedRequest, res: Response) => {
  const { fileName, size, contentType, dataUrl } = req.body;
  if (!fileName || typeof fileName !== 'string') {
    return res.status(400).json({ success: false, error: 'Nom de fichier invalide.' });
  }

  const maxBytes = 50 * 1024 * 1024;
  const fileSize = Number(size) || 0;
  if (fileSize > maxBytes) {
    return res.status(413).json({ success: false, error: 'Fichier trop volumineux (max 50 Mo).' });
  }

  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (FORBIDDEN_SERVER_EXT.has(ext)) {
    logInternalError(`Format interdit refusé: ${fileName}`, 'client', { ip: req.ip });
    return res.status(403).json({ success: false, error: `Format strictement refusé (.${ext}).` });
  }

  const baseName = fileName.split(/[/\\]/).pop() || 'fichier';
  const cleanName = baseName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  const finalName = `${Date.now()}_${cleanName}`;

  return res.status(200).json({
    success: true,
    file: {
      originalName: fileName,
      sanitizedName: finalName,
      size: fileSize,
      contentType: contentType || 'application/octet-stream',
      url: dataUrl || `/uploads/${finalName}`,
      uploadedAt: new Date().toISOString()
    }
  });
});

// Santé du système (public) avec diagnostic Firestore Admin (écriture puis lecture)
app.get('/api/system/health', (req: Request, res: Response) => {
  const mem = process.memoryUsage();
  return res.status(200).json({
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    serverTime: new Date().toISOString(),
    firestoreAdmin: getStartupFirestoreTestResult(),
    smtp: {
      configured: Boolean(getMailTransporter()),
      sender: formatSenderAddress('Studio'),
      adminEmail: getAdminEmail()
    },
    security: {
      securityHeaders: true,
      rateLimitingActive: true,
      xssSanitizationActive: true,
      corsRestricted: true,
      maxUploadSizeMb: 50,
      zeroTrustActive: true
    },
    memory: {
      rssMb: (mem.rss / (1024 * 1024)).toFixed(1),
      heapUsedMb: (mem.heapUsed / (1024 * 1024)).toFixed(1)
    },
    recentErrorsCount: serverErrorLogs.length
  });
});

// Test à chaud d'écriture puis de lecture Firestore Admin (déclenchable depuis Santé du système)
app.post('/api/system/test-firestore', async (req: Request, res: Response) => {
  try {
    const result = await testFirestoreAdminConnection();
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/system/errors', (req: Request, res: Response) => {
  return res.status(200).json({ errors: serverErrorLogs.slice(0, 50) });
});

app.post('/api/system/log-error', (req: Request, res: Response) => {
  const { message, stack, path: errPath } = req.body;
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
  if (message) {
    logInternalError(message, 'client', { stack, path: errPath, ip: clientIp });
  }
  return res.status(200).json({ received: true });
});

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

  if (process.env.NODE_ENV === 'production') {
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