import { 
  writeServerVerificationCode, 
  writeServerEmailLog, 
  setServerUserProfile, 
  getServerUserProfile,
  isPermissionOrCredentialError,
  adminDb
} from './firebaseAdminSdk.js';
import firebaseConfig from '../../firebase-applet-config.json';

export async function persistUserToFirestore(user: any): Promise<void> {
  if (!user || !user.uid) return;
  await setServerUserProfile(user.uid, {
    ...user,
    syncedAt: new Date().toISOString()
  }, true);
}

export async function fetchAllUsersFromFirestore(): Promise<any[]> {
  try {
    const snapshot = await adminDb.collection('users').get();
    const users: any[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data && (data.email || data.uid)) {
        users.push({ id: docSnap.id, ...data });
      }
    });
    return users;
  } catch (err: any) {
    console.warn('[FirestoreAdmin] fetchAllUsersFromFirestore error:', err.message);
    throw err;
  }
}

export async function persistVerificationCodeToFirestore(
  emailOrRecord: any,
  code?: string,
  expiresAt?: string,
  userId?: string
): Promise<void> {
  try {
    let email: string;
    let data: any;
    if (typeof emailOrRecord === 'string') {
      email = emailOrRecord;
      data = {
        code,
        expiresAt,
        userId,
        createdAt: new Date().toISOString()
      };
    } else {
      email = emailOrRecord.email;
      data = emailOrRecord;
    }
    if (email) {
      await writeServerVerificationCode(email, data);
    }
  } catch (err: any) {
    console.warn('[FirestoreAdmin] persistVerificationCodeToFirestore error:', err.message);
  }
}

export async function persistEmailLogInFirestore(log: any): Promise<void> {
  try {
    if (log) {
      await writeServerEmailLog(log);
    }
  } catch (err: any) {
    console.warn('[FirestoreAdmin] persistEmailLogInFirestore error:', err.message);
  }
}

/**
 * Quota mensuel par plan stocké en base Firestore Admin
 */
export async function checkAndIncrementDbEmailQuota(workspaceId: string, plan: string): Promise<{
  allowed: boolean;
  currentCount: number;
  maxAllowed: number;
}> {
  const yearMonth = new Date().toISOString().slice(0, 7);
  const cleanPlan = (plan || 'free').toLowerCase();
  const maxAllowed = cleanPlan === 'agency' ? 5000 : cleanPlan === 'pro' ? 1000 : 30;
  const quotaRef = adminDb.collection('email_quotas').doc(`${workspaceId}_${yearMonth}`);

  try {
    const snap = await quotaRef.get();
    const currentCount = snap.exists ? (Number(snap.data()?.count) || 0) : 0;
    if (currentCount >= maxAllowed) {
      return { allowed: false, currentCount, maxAllowed };
    }
    await quotaRef.set({
      workspaceId,
      yearMonth,
      plan: cleanPlan,
      count: currentCount + 1,
      maxAllowed,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    return { allowed: true, currentCount: currentCount + 1, maxAllowed };
  } catch (err: any) {
    console.warn('[FirestoreAdmin] checkAndIncrementDbEmailQuota warning:', err.message);
    return { allowed: true, currentCount: 1, maxAllowed };
  }
}

/**
 * Récupère les journaux d'emails d'un workspace depuis Firestore Admin
 */
export async function getWorkspaceEmailLogsFromDb(workspaceId: string): Promise<any[]> {
  if (!workspaceId) return [];
  try {
    const snapshot = await adminDb.collection('email_logs')
      .where('workspaceId', '==', workspaceId)
      .limit(100)
      .get();
    const logs: any[] = [];
    snapshot.forEach(doc => {
      logs.push({ id: doc.id, ...doc.data() });
    });
    logs.sort((a, b) => new Date(b.sentAt || b.createdAt || 0).getTime() - new Date(a.sentAt || a.createdAt || 0).getTime());
    return logs;
  } catch (err: any) {
    console.warn('[FirestoreAdmin] getWorkspaceEmailLogsFromDb warning:', err.message);
    return [];
  }
}

/**
 * Vérifie en base Firestore Admin que le destinataire est bien un client du workspace ou de l'utilisateur
 */
export async function isRecipientClientOfWorkspace(
  email: string,
  userId: string,
  workspaceId?: string
): Promise<boolean> {
  const cleanEmail = (email || '').trim().toLowerCase();
  if (!cleanEmail) return false;

  try {
    const snapByOwner = await adminDb.collection('clients')
      .where('ownerId', '==', userId)
      .get();

    for (const doc of snapByOwner.docs) {
      const cEmail = (doc.data()?.email || '').trim().toLowerCase();
      if (cEmail === cleanEmail) {
        return true;
      }
    }

    if (workspaceId) {
      const snapByWs = await adminDb.collection('clients')
        .where('workspaceId', '==', workspaceId)
        .get();

      for (const doc of snapByWs.docs) {
        const cEmail = (doc.data()?.email || '').trim().toLowerCase();
        if (cEmail === cleanEmail) {
          return true;
        }
      }
    }

    return false;
  } catch (err: any) {
    console.warn('[FirestoreAdmin] isRecipientClientOfWorkspace error:', err.message);
    return false;
  }
}


export async function runStorageHealthDiagnostic(): Promise<any> {
  const timestamp = new Date().toISOString();
  let writeSuccess = false;
  let writeLatencyMs = 0;
  let readSuccess = false;
  let readLatencyMs = 0;
  let cleanupSuccess = false;
  let totalUsers = 0;
  let totalWorkspaces = 0;
  let errorMessage: string | undefined;

  try {
    const probeRef = adminDb.collection('system_health').doc('diagnostic_probe');
    const probePayload = { test: 'storage_health', initiatedAt: Date.now(), status: 'active' };
    
    const tWriteStart = Date.now();
    await probeRef.set(probePayload);
    writeLatencyMs = Date.now() - tWriteStart;
    writeSuccess = true;

    const tReadStart = Date.now();
    const readSnap = await probeRef.get();
    readLatencyMs = Date.now() - tReadStart;
    readSuccess = readSnap.exists;

    await probeRef.delete();
    cleanupSuccess = true;

    // Quick stats via adminDb
    try {
      const uSnap = await adminDb.collection('users').limit(10).get();
      totalUsers = uSnap.size;
      const wSnap = await adminDb.collection('workspaces').limit(10).get();
      totalWorkspaces = wSnap.size;
    } catch {}

  } catch (err: any) {
    errorMessage = err?.message || String(err);
  }

  return {
    connected: writeSuccess && readSuccess,
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId,
    totalUsers,
    totalWorkspaces,
    writeSuccess,
    writeLatencyMs,
    readSuccess,
    readLatencyMs,
    cleanupSuccess,
    error: errorMessage,
    timestamp
  };
}