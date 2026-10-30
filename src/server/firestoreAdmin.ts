import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, doc, setDoc, getDoc, deleteDoc, collection, getDocs, setLogLevel } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

try {
  setLogLevel('silent');
} catch {
  // Ignore if already configured
}

// Suppress harmless Firestore idle stream disconnect messages from triggering false alarms
if (typeof console !== 'undefined' && console.error) {
  const originalConsoleError = console.error.bind(console);
  console.error = (...args: any[]) => {
    const firstArg = args[0];
    if (
      typeof firstArg === 'string' &&
      firstArg.includes('@firebase/firestore') &&
      (firstArg.includes('Disconnecting idle stream') || firstArg.includes('Timed out waiting for new targets'))
    ) {
      return;
    }
    originalConsoleError(...args);
  };
}

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const firestoreDb = getFirestore(app, firebaseConfig.firestoreDatabaseId);

export async function persistUserToFirestore(user: any): Promise<void> {
  try {
    const userRef = doc(firestoreDb, 'users', user.uid);
    await setDoc(userRef, { ...user, syncedAt: new Date().toISOString() }, { merge: true });
    const emailKey = user.email.toLowerCase().replace(/[^a-z0-9_]/gi, '_');
    const emailIndexRef = doc(firestoreDb, 'users_by_email', emailKey);
    await setDoc(emailIndexRef, { uid: user.uid, email: user.email.toLowerCase(), updatedAt: new Date().toISOString() }, { merge: true });
  } catch (err: any) {
    console.warn('[FirestoreAdmin] Failed to persist user to Firestore:', err.message);
  }
}

export async function fetchAllUsersFromFirestore(): Promise<any[]> {
  try {
    const usersCol = collection(firestoreDb, 'users');
    const snapshot = await getDocs(usersCol);
    const users: any[] = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      if (data && data.email) {
        users.push(data);
      }
    });
    return users;
  } catch (err: any) {
    console.warn('[FirestoreAdmin] Failed to fetch users from Firestore:', err.message);
    return [];
  }
}

export async function persistVerificationCodeToFirestore(record: any): Promise<void> {
  try {
    const safeKey = record.email.toLowerCase().replace(/[^a-z0-9_]/gi, '_');
    const ref = doc(firestoreDb, 'verification_codes', safeKey);
    await setDoc(ref, {
      email: record.email.toLowerCase(),
      hash: record.hash,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      status: record.status,
      updatedAt: new Date().toISOString()
    });
  } catch (err: any) {
    console.warn('[FirestoreAdmin] Failed to persist verification code to Firestore:', err.message);
  }
}

export async function persistEmailLogInFirestore(log: any): Promise<void> {
  try {
    const logId = log.id || `email_log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const ref = doc(firestoreDb, 'email_logs', logId);
    await setDoc(ref, { ...log, syncedAt: new Date().toISOString() });
  } catch (err: any) {
    console.warn('[FirestoreAdmin] Failed to persist email log to Firestore:', err.message);
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
    const probeRef = doc(firestoreDb, 'system_health', 'diagnostic_probe');
    const probePayload = { test: 'storage_health', initiatedAt: Date.now(), status: 'active' };
    const tWriteStart = Date.now();
    await setDoc(probeRef, probePayload);
    writeLatencyMs = Date.now() - tWriteStart;
    writeSuccess = true;

    const tReadStart = Date.now();
    const readSnap = await getDoc(probeRef);
    readLatencyMs = Date.now() - tReadStart;
    readSuccess = readSnap.exists();

    await deleteDoc(probeRef);
    cleanupSuccess = true;

    try {
      const usersSnap = await getDocs(collection(firestoreDb, 'users'));
      totalUsers = usersSnap.size;
    } catch {
      totalUsers = 1;
    }

    try {
      const wsSnap = await getDocs(collection(firestoreDb, 'workspaces'));
      totalWorkspaces = wsSnap.size;
    } catch {
      totalWorkspaces = 1;
    }
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