import { getApps, initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();

export async function signInWithGoogle() {
  return signInWithPopup(auth, googleProvider);
}

export async function signInWithCredentials(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function provisionCredentialsUser(params: {
  email: string;
  password: string;
  displayName: string;
}): Promise<string> {
  const secondaryAppName = 'account-provisioner';
  const existingSecondary = getApps().find((item) => item.name === secondaryAppName);
  const secondaryApp =
    existingSecondary || initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      params.email,
      params.password
    );
    if (params.displayName.trim()) {
      await updateProfile(credential.user, {
        displayName: params.displayName.trim(),
      });
    }
    const createdUid = credential.user.uid;
    await signOut(secondaryAuth);
    return createdUid;
  } catch (err) {
    try {
      await signOut(secondaryAuth);
    } catch {
      // Ignore cleanup error on failed creation
    }
    throw err;
  }
}

export function formatAuthErrorAr(err: unknown): string {
  const code =
    typeof err === 'object' && err !== null && 'code' in err
      ? String((err as { code?: unknown }).code || '')
      : '';
  const msg = err instanceof Error ? err.message : String(err || '');

  if (
    code === 'auth/invalid-credential' ||
    code === 'auth/wrong-password' ||
    code === 'auth/user-not-found' ||
    msg.includes('invalid-credential') ||
    msg.includes('wrong-password') ||
    msg.includes('user-not-found')
  ) {
    return 'اسم المستخدم (اليوزر) أو كلمة المرور غير صحيحة.';
  }
  if (code === 'auth/invalid-email' || msg.includes('invalid-email')) {
    return 'صيغة اسم المستخدم أو البريد الإلكتروني غير صالحة.';
  }
  if (code === 'auth/user-disabled' || msg.includes('user-disabled')) {
    return 'تم تعطيل هذا الحساب. يرجى مراجعة إدارة المنظومة.';
  }
  if (code === 'auth/too-many-requests' || msg.includes('too-many-requests')) {
    return 'تم تجاوز عدد محاولات الدخول المسموحة مؤقتاً. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.';
  }
  if (code === 'auth/email-already-in-use' || msg.includes('email-already-in-use')) {
    return 'اسم المستخدم (اليوزر) أو البريد مستخدم مسبقاً. يرجى اختيار اسم مستخدم آخر.';
  }
  if (code === 'auth/weak-password' || msg.includes('weak-password')) {
    return 'كلمة المرور ضعيفة، يجب أن لا تقل عن 6 أحرف.';
  }
  if (code === 'auth/operation-not-allowed' || msg.includes('operation-not-allowed')) {
    return 'تسجيل الدخول العادي (Email/Password) غير مفعّل بعد في لوحة Firebase. يرجى تفعيله من Authentication -> Sign-in method.';
  }
  if (code === 'auth/popup-closed-by-user' || msg.includes('popup-closed-by-user')) {
    return 'تم إغلاق نافذة تسجيل الدخول بحساب Google قبل الإتمام.';
  }
  if (code === 'auth/requires-recent-login' || msg.includes('requires-recent-login')) {
    return 'لأسباب أمنية، يرجى تسجيل الخروج ثم إعادة الدخول قبل تغيير كلمة المرور.';
  }
  if (
    code === 'auth/credential-already-in-use' ||
    code === 'auth/email-already-in-use' ||
    msg.includes('credential-already-in-use')
  ) {
    return 'هذا الحساب مرتبط مسبقاً بطريقة دخول أخرى.';
  }
  if (code === 'auth/provider-already-linked' || msg.includes('provider-already-linked')) {
    return 'طريقة الدخول هذه مفعلة ومربوطة مسبقاً بهذا الحساب.';
  }
  return msg ? `تعذر إتمام العملية: ${msg}` : 'حدث خطأ غير متوقع أثناء المصادقة.';
}

export async function signOutUser() {
  return signOut(auth);
}
