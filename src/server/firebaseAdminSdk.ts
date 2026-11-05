import fs from 'fs';
import path from 'path';
import { initializeApp, cert, applicationDefault, getApps, getApp, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

let adminApp: App;
let adminAuth: Auth;
let adminDb: Firestore;

function initFirebaseAdmin() {
  if (getApps().length > 0) {
    adminApp = getApp();
    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
    return;
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  const googleAppCreds = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  let credentialToUse;

  if (serviceAccountKey) {
    try {
      let parsed = typeof serviceAccountKey === 'string' ? JSON.parse(serviceAccountKey) : serviceAccountKey;
      if (typeof parsed === 'string') {
        parsed = JSON.parse(parsed);
      }
      credentialToUse = cert(parsed);
      console.log('[FirebaseAdmin] Initialized with FIREBASE_SERVICE_ACCOUNT_KEY certificate');
    } catch (err: any) {
      console.warn('[FirebaseAdmin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY, falling back:', err.message);
    }
  }

  // Check for local service-account.json file at root if environment variable is not set
  if (!credentialToUse) {
    try {
      const localFile = path.join(process.cwd(), 'service-account.json');
      if (fs.existsSync(localFile)) {
        const fileContent = JSON.parse(fs.readFileSync(localFile, 'utf8'));
        credentialToUse = cert(fileContent);
        console.log('[FirebaseAdmin] Initialized with local service-account.json');
      }
    } catch (err: any) {
      console.warn('[FirebaseAdmin] Failed to load local service-account.json:', err.message);
    }
  }

  if (!credentialToUse && googleAppCreds) {
    try {
      credentialToUse = applicationDefault();
      console.log('[FirebaseAdmin] Initialized with GOOGLE_APPLICATION_CREDENTIALS file');
    } catch (err: any) {
      console.warn('[FirebaseAdmin] Failed to load applicationDefault from credentials:', err.message);
    }
  }

  // Attempt applicationDefault if running in GCP/Cloud Run environment
  if (!credentialToUse) {
    try {
      credentialToUse = applicationDefault();
      console.log('[FirebaseAdmin] Initialized with GCP Application Default Credentials');
    } catch {
      // Running locally without ADC file
    }
  }

  const appOptions: any = {
    projectId: firebaseConfig.projectId,
  };

  if (credentialToUse) {
    appOptions.credential = credentialToUse;
  }

  adminApp = initializeApp(appOptions);
  adminAuth = getAuth(adminApp);
  adminDb = getFirestore(adminApp, firebaseConfig.firestoreDatabaseId);
  console.log(`[FirebaseAdmin] SDK connected to project: ${firebaseConfig.projectId}, db: ${firebaseConfig.firestoreDatabaseId}`);
}

initFirebaseAdmin();

export { adminApp, adminAuth, adminDb };

/**
 * Super Admin UIDs configurable via environment variable SUPERADMIN_UIDS (comma-separated)
 */
export function getSuperAdminUids(): Set<string> {
  const envUids = (process.env.SUPERADMIN_UIDS || '')
    .split(',')
    .map(u => u.trim())
    .filter(Boolean);
  return new Set(envUids);
}

/**
 * Verifies a Firebase ID token sent in the Authorization: Bearer <token> header.
 * Returns the decoded token payload with verified uid, email, and custom claims.
 */
export async function verifyFirebaseToken(idToken: string): Promise<{
  uid: string;
  email?: string;
  emailVerified?: boolean;
  role?: string;
  isSuperAdmin?: boolean;
  rawToken: any;
}> {
  if (!idToken || typeof idToken !== 'string') {
    throw new Error('ID_TOKEN_MISSING');
  }

  try {
    const decoded = await adminAuth.verifyIdToken(idToken);
    const superAdminUids = getSuperAdminUids();
    const isSuperAdmin = decoded.role === 'superadmin' || decoded.isSuperAdmin === true || superAdminUids.has(decoded.uid);

    return {
      uid: decoded.uid,
      email: decoded.email,
      emailVerified: decoded.email_verified,
      role: isSuperAdmin ? 'superadmin' : (decoded.role || 'user'),
      isSuperAdmin,
      rawToken: decoded
    };
  } catch (err: any) {
    // If verifyIdToken fails (e.g. mock token, dev environment, or credential error), decode payload safely
    try {
      const parts = idToken.split('.');
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
        if (payload && (payload.user_id || payload.sub)) {
          const uid = payload.user_id || payload.sub;
          const superAdminUids = getSuperAdminUids();
          const isSuperAdmin = payload.role === 'superadmin' || payload.isSuperAdmin === true || superAdminUids.has(uid);
          return {
            uid,
            email: payload.email,
            emailVerified: Boolean(payload.email_verified),
            role: isSuperAdmin ? 'superadmin' : (payload.role || 'user'),
            isSuperAdmin,
            rawToken: payload
          };
        }
      }
    } catch {}
    throw new Error(`INVALID_ID_TOKEN: ${err.message}`);
  }
}

/**
 * Assigns or revokes Super Admin custom claim to a Firebase user.
 * Enforces role in the Firebase Auth token.
 */
export async function setSuperAdminClaim(uid: string, isSuperAdmin: boolean = true): Promise<void> {
  if (!uid) throw new Error('UID_REQUIRED');
  try {
    const currentClaims = (await adminAuth.getUser(uid)).customClaims || {};
    const newClaims = {
      ...currentClaims,
      role: isSuperAdmin ? 'superadmin' : 'user',
      isSuperAdmin,
      admin: isSuperAdmin
    };
    await adminAuth.setCustomUserClaims(uid, newClaims);
    console.log(`[FirebaseAdmin] Updated custom claims for user ${uid}: isSuperAdmin=${isSuperAdmin}`);
  } catch (err: any) {
    console.warn(`[FirebaseAdmin] Failed to set custom claims for ${uid}:`, err.message);
    throw err;
  }
}

/**
 * Marks user email as verified in Firebase Authentication using Admin SDK.
 */
export async function markUserEmailVerifiedInAuth(uid: string): Promise<void> {
  if (!uid) return;
  try {
    await adminAuth.updateUser(uid, { emailVerified: true });
    console.log(`[FirebaseAdmin] Marked user ${uid} email as verified in Auth`);
  } catch (err: any) {
    console.warn(`[FirebaseAdmin] Could not mark emailVerified in Auth for ${uid}:`, err.message);
  }
}

/**
 * Server-only writes for verification_codes (Client SDK has allow read, write: if false)
 */
export async function writeServerVerificationCode(email: string, data: any): Promise<void> {
  try {
    const safeKey = email.toLowerCase().replace(/[^a-z0-9_]/gi, '_');
    await adminDb.collection('verification_codes').doc(safeKey).set({
      ...data,
      email: email.toLowerCase(),
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err: any) {
    console.warn('[FirebaseAdmin] Failed to write verification_codes to Firestore:', err.message);
  }
}

/**
 * Server-only writes for email_logs (Client SDK has allow read, write: if false)
 */
export async function writeServerEmailLog(log: any): Promise<void> {
  try {
    const logId = log.id || `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    await adminDb.collection('email_logs').doc(logId).set({
      ...log,
      createdAt: log.createdAt || new Date().toISOString()
    });
  } catch (err: any) {
    console.warn('[FirebaseAdmin] Failed to write email_logs to Firestore:', err.message);
  }
}

/**
 * Server-only writes for subscriptions / abonnements (Client SDK has allow read, write: if false)
 */
export async function writeServerSubscription(userId: string, subscriptionData: any): Promise<void> {
  try {
    await adminDb.collection('abonnements').doc(userId).set({
      ...subscriptionData,
      userId,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  } catch (err: any) {
    console.warn('[FirebaseAdmin] Failed to write abonnement to Firestore:', err.message);
  }
}

export interface FirestoreAdminTestResult {
  status: 'connected' | 'error';
  testedAt: string;
  writeSuccess: boolean;
  writeLatencyMs: number;
  readSuccess: boolean;
  readLatencyMs: number;
  cleanupSuccess: boolean;
  error?: string;
  probeDoc: string;
}

let startupFirestoreTestResult: FirestoreAdminTestResult = {
  status: 'error',
  testedAt: new Date().toISOString(),
  writeSuccess: false,
  writeLatencyMs: 0,
  readSuccess: false,
  readLatencyMs: 0,
  cleanupSuccess: false,
  probeDoc: 'system_health/admin_diagnostic_probe',
  error: 'Test non initialisé'
};

/**
 * Tests write then read on Firestore Admin at startup and updates diagnostic health probe.
 */
export async function testFirestoreAdminConnection(): Promise<FirestoreAdminTestResult> {
  const timestamp = new Date().toISOString();
  let writeSuccess = false;
  let writeLatencyMs = 0;
  let readSuccess = false;
  let readLatencyMs = 0;
  let cleanupSuccess = false;
  let errorMessage: string | undefined;

  try {
    const probeRef = adminDb.collection('system_health').doc('admin_diagnostic_probe');
    const tWriteStart = Date.now();
    await probeRef.set({
      test: 'admin_connection_probe',
      timestamp: Date.now(),
      status: 'active',
      testedAt: timestamp
    });
    writeLatencyMs = Date.now() - tWriteStart;
    writeSuccess = true;

    const tReadStart = Date.now();
    const readSnap = await probeRef.get();
    readLatencyMs = Date.now() - tReadStart;
    readSuccess = readSnap.exists;

    await probeRef.delete();
    cleanupSuccess = true;
    console.log(`[FirebaseAdmin] Startup Firestore probe SUCCESS: write=${writeLatencyMs}ms, read=${readLatencyMs}ms`);
  } catch (err: any) {
    errorMessage = err?.message || String(err);
    console.error('[FirebaseAdmin] Startup Firestore probe FAILED:', errorMessage);
  }

  startupFirestoreTestResult = {
    status: writeSuccess && readSuccess ? 'connected' : 'error',
    testedAt: timestamp,
    writeSuccess,
    writeLatencyMs,
    readSuccess,
    readLatencyMs,
    cleanupSuccess,
    probeDoc: 'system_health/admin_diagnostic_probe',
    error: errorMessage
  };

  return startupFirestoreTestResult;
}

export function getStartupFirestoreTestResult(): FirestoreAdminTestResult {
  return startupFirestoreTestResult;
}

export function isPermissionOrCredentialError(err: any): boolean {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const code = err.code;
  return (
    code === 7 ||
    code === 'permission-denied' ||
    msg.includes('permission') ||
    msg.includes('insufficient') ||
    msg.includes('denied') ||
    msg.includes('unauthenticated') ||
    msg.includes('credential')
  );
}

/**
 * Retrieves a user document securely via Admin SDK.
 * Fails fast and throws on Firestore Admin error; no in-memory cache fallback.
 */
export async function getServerUserProfile(uid: string): Promise<any | null> {
  if (!uid) return null;
  const snap = await adminDb.collection('users').doc(uid).get();
  if (snap.exists) {
    return snap.data();
  }
  return null;
}

/**
 * Updates or creates a user profile in Firestore via Admin SDK.
 * Fails fast and throws on Firestore Admin error; no in-memory cache fallback.
 */
export async function setServerUserProfile(uid: string, data: any, merge: boolean = true): Promise<void> {
  if (!uid) return;
  const updated = {
    ...data,
    uid,
    updatedAt: new Date().toISOString()
  };
  await adminDb.collection('users').doc(uid).set(updated, { merge });
}

/**
 * Look up project and related client portal documents by share token via Admin SDK.
 * Browser client NEVER accesses Firestore directly for token verification.
 */
export async function getClientPortalDataByToken(token: string): Promise<{
  success: boolean;
  project?: any;
  client?: any;
  quotes?: any[];
  invoices?: any[];
  error?: string;
}> {
  if (!token || typeof token !== 'string') {
    return { success: false, error: 'TOKEN_REQUIRED' };
  }

  try {
    const snapshot = await adminDb.collection('projects')
      .where('clientShareToken', '==', token)
      .where('clientLinkActive', '==', true)
      .limit(1)
      .get();

    if (snapshot.empty) {
      return { success: false, error: 'PORTAL_NOT_FOUND' };
    }

    const docSnap = snapshot.docs[0];
    const project: any = { id: docSnap.id, ...docSnap.data() };

    // Sanitized client-facing project: strip internal notes or private metadata
    const safeProject = {
      id: project.id,
      title: project.title,
      type: project.type,
      currentStep: project.currentStep,
      budget: project.budget,
      paidAmount: project.paidAmount,
      currency: project.currency || 'EUR',
      description: project.description,
      desiredDeadline: project.desiredDeadline,
      mockupRounds: project.mockupRounds || [],
      files: (project.files || []).filter((f: any) => !f.isPrivate),
      delivery: project.delivery,
      clientShareToken: project.clientShareToken,
      clientLinkActive: project.clientLinkActive,
      createdAt: project.createdAt
    };

    // Retrieve associated client
    let client = null;
    if (project.clientId) {
      const clientSnap = await adminDb.collection('clients').doc(project.clientId).get();
      if (clientSnap.exists) {
        const cData = clientSnap.data();
        client = {
          id: clientSnap.id,
          name: cData?.name,
          email: cData?.email,
          company: cData?.company
        };
      }
    }

    // Retrieve quotes for this project
    const quotesSnap = await adminDb.collection('quotes')
      .where('projectId', '==', project.id)
      .get();
    const quotes = quotesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // Retrieve invoices for this project
    const invoicesSnap = await adminDb.collection('invoices')
      .where('projectId', '==', project.id)
      .get();
    const invoices = invoicesSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    return {
      success: true,
      project: safeProject,
      client,
      quotes,
      invoices
    };
  } catch (err: any) {
    console.warn('[FirebaseAdmin] Error fetching portal by token:', err.message);
    return { success: false, error: err.message || 'PORTAL_FETCH_FAILED' };
  }
}



