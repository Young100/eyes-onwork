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