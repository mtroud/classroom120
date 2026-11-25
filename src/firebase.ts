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

export function logFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
  extraContext?: Record<string, unknown>
): FirestoreErrorInfo {
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
  console.error(
    'Firestore Error: ',
    JSON.stringify(errInfo),
    extraContext ? { context: extraContext } : ''
  );
  return errInfo;
}

export interface BookingErrorTranslationContext {
  accountMissing?: boolean;
  accountUnlinked?: boolean;
  isSuspended?: boolean;
  isViewer?: boolean;
  departmentMismatch?: boolean;
  roomMissing?: boolean;
  roomMismatch?: boolean;
  payloadInvalid?: boolean;
  statusNotAllowed?: boolean;
}

export function translateFirestoreBookingErrorAr(
  error: unknown,
  context: BookingErrorTranslationContext = {}
): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '').toLowerCase()
      : '';
  const msg = (error instanceof Error ? error.message : String(error || '')).toLowerCase();

  if (context.isSuspended) {
    return 'حسابك موقوف حالياً ولا يمكنك إنشاء أو تعديل طلبات الحجز. يرجى مراجعة إدارة النظام.';
  }
  if (context.isViewer) {
    return 'حسابك مخصص للمشاهدة فقط ولا يملك صلاحية إنشاء أو تعديل الحجوزات.';
  }
  if (context.accountMissing) {
    return 'تعذر العثور على ملف حسابك في سجل الصلاحيات. يرجى مراجعة مدير النظام لتفعيل الحساب.';
  }
  if (context.accountUnlinked) {
    return 'حساب الدخول الحالي غير مربوط بشكل صحيح بملف الصلاحيات في النظام. يرجى مراجعة مدير النظام لتحديث الربط.';
  }
  if (context.departmentMismatch) {
    return 'لا يمكنك إرسال طلب حجز لقسم مختلف عن القسم المربوط بحسابك.';
  }
  if (context.roomMissing || context.roomMismatch) {
    return 'القاعة المختارة غير موجودة أو بياناتها غير متطابقة في قاعدة البيانات. يرجى تحديث الصفحة واختيار قاعة صالحة.';
  }
  if (context.statusNotAllowed) {
    return 'حسابك لا يملك صلاحية اعتماد الحجز مباشرة؛ يمكن إرسال الطلب كـ «قيد المراجعة» فقط.';
  }
  if (context.payloadInvalid) {
    return 'بعض حقول طلب الحجز غير مكتملة أو تتجاوز الحدود المسموحة. يرجى مراجعة البيانات والمحاولة مجدداً.';
  }

  if (
    code === 'permission-denied' ||
    code === 'firestore/permission-denied' ||
    msg.includes('missing or insufficient permissions') ||
    msg.includes('permission_denied')
  ) {
    return 'لا تملك الصلاحية الكافية لإتمام هذه العملية على الحجز، أو أن ربط الحساب أو القسم أو القاعة غير مطابق لقواعد النظام.';
  }
  if (code === 'unauthenticated' || code === 'firestore/unauthenticated') {
    return 'انتهت جلسة تسجيل الدخول. يرجى تسجيل الخروج ثم إعادة الدخول والمحاولة مرة أخرى.';
  }
  if (code === 'not-found' || code === 'firestore/not-found') {
    return 'تعذر العثور على السجل المطلوب أو القاعة المحددة في قاعدة البيانات.';
  }
  if (code === 'invalid-argument' || code === 'firestore/invalid-argument') {
    return 'تنسيق بيانات الحجز غير صالح. يرجى التأكد من التاريخ والأوقات وعدد الحضور والمحاولة مجدداً.';
  }
  if (
    code === 'unavailable' ||
    code === 'firestore/unavailable' ||
    msg.includes('offline') ||
    msg.includes('network')
  ) {
    return 'تعذر الاتصال بخادم قاعدة البيانات حالياً. يرجى التحقق من الاتصال بالإنترنت والمحاولة مجدداً.';
  }

  return 'تعذر إرسال طلب الحجز بسبب خطأ في الحفظ. يرجى التحقق من البيانات والصلاحيات والمحاولة مجدداً.';
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
