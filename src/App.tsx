import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  ClipboardList,
  Clock,
  FileBarChart2,
  History,
  Layers,
  LogOut,
  Menu,
  Pencil,
  Plus,
  Settings as SettingsIcon,
  ShieldCheck,
  Trash2,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { User, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { AccountDraft, AccountModal } from './components/AccountModal';
import {
  AccountsView,
  CreatedCredentialsNotice,
} from './components/AccountsView';
import { AuditLogView } from './components/AuditLogView';
import { AuthLanding } from './components/AuthLanding';
import { BookingDraft, BookingModal } from './components/BookingModal';
import { BookingsTableView } from './components/BookingsTableView';
import { ClassroomDraft, ClassroomModal } from './components/ClassroomModal';
import { ClassroomsView } from './components/ClassroomsView';
import {
  RoomOccupancyStat,
  ScheduledHoursCard,
} from './components/ScheduledHoursCard';
import { DepartmentDraft, DepartmentModal } from './components/DepartmentModal';
import { DepartmentsView } from './components/DepartmentsView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { GoogleGLogo, WorkspaceEmblem } from './components/GoogleBrandMark';
import { ReportsView } from './components/ReportsView';
import { ScheduleGrid } from './components/ScheduleGrid';
import { SettingsView, SystemBackupBundle } from './components/SettingsView';
import {
  ATABA_DEPARTMENTS,
  CLASSROOM_IMAGE_PRESETS,
  INITIAL_CLASSROOMS,
  INITIAL_DEPARTMENTS,
  buildInitialBookings,
} from './data/seedData';
import {
  OperationType,
  auth,
  db,
  formatAuthErrorAr,
  handleFirestoreError,
  logFirestoreError,
  provisionCredentialsUser,
  signInWithCredentials,
  signInWithGoogle,
  signOutUser,
  translateFirestoreBookingErrorAr,
} from './firebase';
import {
  AccountRecord,
  AuditActionType,
  AuditEntityType,
  AuditLogEntry,
  BLUEPRINT_LIMITS,
  BOOTSTRAPPED_ADMIN_EMAIL,
  Booking,
  BookingStatus,
  Classroom,
  Department,
  SystemSettings,
  ViewTab,
} from './types';
import {
  DEFAULT_SYSTEM_SETTINGS,
  ROLE_LABEL_AR,
  defaultPermissionsForRole,
  emailToAccountId,
  generateReadablePassword,
  isInternalAuthEmail,
  resolveEffectiveAccess,
  suggestCoordinatorUsername,
  usernameToAuthEmail,
} from './utils/permissions';
import {
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  calculateDurationHours,
  findBookingConflicts,
  formatArabicDate,
  formatShortArabicDate,
  formatTime12Ar,
  getTodayISO,
  isActiveBooking,
  timeToMinutes,
} from './utils/schedule';

function generateSafeId(prefix: string): string {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${rand}`;
}

function DashboardWorkspace() {
  const [authReady, setAuthReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [hasAdminsDoc, setHasAdminsDoc] = useState(false);
  const [myAccountDoc, setMyAccountDoc] = useState<AccountRecord | null>(null);
  const [myAccountResolved, setMyAccountResolved] = useState(false);
  const [accountLinkError, setAccountLinkError] = useState<
    'missing' | 'unlinked_or_mismatched' | 'permission_denied' | null
  >(null);
  const [lastCreatedCredentials, setLastCreatedCredentials] =
    useState<CreatedCredentialsNotice | null>(null);
  const [batchCreatedCredentials, setBatchCreatedCredentials] = useState<
    CreatedCredentialsNotice[] | null
  >(null);

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [accounts, setAccounts] = useState<AccountRecord[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings>(
    DEFAULT_SYSTEM_SETTINGS
  );

  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [loadingAuditLogs, setLoadingAuditLogs] = useState(true);

  const [activeTab, setActiveTab] = useState<ViewTab>('schedule');
  const [bookingsStatusFilter, setBookingsStatusFilter] = useState<
    'all' | BookingStatus
  >('all');
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO());
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Modals
  const [bookingModalOpen, setBookingModalOpen] = useState(false);
  const [bookingDraft, setBookingDraft] = useState<BookingDraft>({
    roomId: '',
    courseTitle: '',
    instructorName: '',
    department: ATABA_DEPARTMENTS[0],
    bookingType: 'lecture',
    date: getTodayISO(),
    startTime: '09:00',
    endTime: '11:00',
    attendeesCount: 25,
    status: 'confirmed',
    notes: '',
  });

  const [classroomModalOpen, setClassroomModalOpen] = useState(false);
  const [classroomDraft, setClassroomDraft] = useState<ClassroomDraft>({
    name: '',
    code: '',
    floor: 'الطابق الأول',
    capacity: 35,
    equipment: ['سبورة ذكية تفاعلية'],
    status: 'available',
    imageUrl: CLASSROOM_IMAGE_PRESETS[0].url,
    notes: '',
  });

  const [departmentModalOpen, setDepartmentModalOpen] = useState(false);
  const [departmentDraft, setDepartmentDraft] = useState<DepartmentDraft>({
    name: '',
    code: '',
    headName: '',
    sector: 'العتبة الحسينية المقدسة',
    status: 'active',
    notes: '',
  });

  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountDraft, setAccountDraft] = useState<AccountDraft>({
    email: '',
    username: '',
    authType: 'credentials',
    password: '',
    displayName: '',
    branchName: '',
    role: 'branch_supervisor',
    status: 'active',
    permissions: defaultPermissionsForRole('branch_supervisor'),
    notes: '',
  });

  const [inspectedBooking, setInspectedBooking] = useState<Booking | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const autoSeedTriggeredRef = useRef(false);
  const autoSeedDeptsTriggeredRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const isPasswordUser = useMemo(
    () => Boolean(user?.providerData?.some((p) => p.providerId === 'password')),
    [user]
  );

  const isUnverifiedBootstrappedAdmin = useMemo(
    () =>
      Boolean(
        user?.email &&
          user.email.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL &&
          !user.emailVerified
      ),
    [user]
  );

  const access = useMemo(
    () =>
      resolveEffectiveAccess({
        email: user?.email,
        emailVerified: Boolean(user?.emailVerified),
        isPasswordProvider: isPasswordUser,
        hasAdminsDoc,
        account: myAccountDoc,
        settings: systemSettings,
      }),
    [user, isPasswordUser, hasAdminsDoc, myAccountDoc, systemSettings]
  );

  // Auth listener & admin doc check
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (!firebaseUser) {
        setHasAdminsDoc(false);
        setMyAccountDoc(null);
        setMyAccountResolved(false);
        setAccountLinkError(null);
        setLastCreatedCredentials(null);
        setBatchCreatedCredentials(null);
        setClassrooms([]);
        setDepartments([]);
        setBookings([]);
        setAccounts([]);
        setAuditLogs([]);
        setSystemSettings(DEFAULT_SYSTEM_SETTINGS);
        setLoadingRooms(false);
        setLoadingDepartments(false);
        setLoadingBookings(false);
        setLoadingAccounts(false);
        setLoadingAuditLogs(false);
        autoSeedTriggeredRef.current = false;
        autoSeedDeptsTriggeredRef.current = false;
        return;
      }

      setMyAccountResolved(false);
      const isPwd = firebaseUser.providerData.some((p) => p.providerId === 'password');
      const bootstrapped =
        Boolean(firebaseUser.emailVerified) &&
        firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

      let adminFlag = false;
      if (!bootstrapped && !isPwd && firebaseUser.emailVerified) {
        try {
          const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
          adminFlag = adminSnap.exists();
        } catch {
          adminFlag = false;
        }
      }
      setHasAdminsDoc(adminFlag);
    });

    return () => unsubscribe();
  }, []);

  // Provision private profile once account/access state is resolved & active
  useEffect(() => {
    if (!authReady || !user || !myAccountResolved || access.isAccessBlocked) return;

    const profileRef = doc(db, 'users', user.uid, 'private', 'info');
    let cancelled = false;
    void (async () => {
      try {
        const existingSnap = await getDoc(profileRef);
        if (!existingSnap.exists() && !cancelled) {
          await setDoc(profileRef, {
            uid: user.uid,
            email: (user.email || '').slice(0, 160),
            displayName: (myAccountDoc?.displayName || user.displayName || 'مستخدم').slice(0, 80),
            photoURL: (user.photoURL || '').slice(0, 300),
            department: (myAccountDoc?.branchName || 'قسم مجمع سيد الشهداء (ع) الخدمي').slice(0, 80),
            role: access.isFullAdmin ? 'admin' : 'coordinator',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        if (!cancelled) {
          handleFirestoreError(
            err,
            OperationType.WRITE,
            `users/${user.uid}/private/info`
          );
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, user, myAccountResolved, access.isAccessBlocked, access.isFullAdmin, myAccountDoc]);

  const seedDefaultWorkspace = useCallback(async () => {
    if (!user || !access.canManageClassrooms) return;
    const roomsBatch = writeBatch(db);
    for (const room of INITIAL_CLASSROOMS) {
      roomsBatch.set(doc(db, 'classrooms', room.id), {
        ...room,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await roomsBatch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'classrooms');
    }

    const bookingsBatch = writeBatch(db);
    const seedBookings = buildInitialBookings();
    for (const b of seedBookings) {
      bookingsBatch.set(doc(db, 'bookings', b.id), {
        ...b,
        creatorId: user.uid,
        creatorName: (user.displayName || 'إدارة القسم').slice(0, 80),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await bookingsBatch.commit();
      showToast('تمت تهيئة القاعات والجدول الافتراضي بنجاح');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'bookings');
    }
  }, [user, access.canManageClassrooms, showToast]);

  const seedDefaultDepartments = useCallback(async () => {
    if (!user || !access.canManageDepartments) return;
    const deptsBatch = writeBatch(db);
    for (const dept of INITIAL_DEPARTMENTS) {
      deptsBatch.set(doc(db, 'departments', dept.id), {
        ...dept,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
    try {
      await deptsBatch.commit();
      showToast('تمت تهيئة قائمة أقسام العتبة الحسينية المقدسة بنجاح');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'departments');
    }
  }, [user, access.canManageDepartments, showToast]);

  // Firestore real-time listeners (strictly gated behind authReady && user)
  useEffect(() => {
    if (!authReady || !user) return;

    const isPwd = user.providerData.some((p) => p.providerId === 'password');
    const verifiedNow = Boolean(user.emailVerified);
    const isMainAdminEmail = user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

    if (isMainAdminEmail && !verifiedNow) {
      setMyAccountDoc(null);
      setMyAccountResolved(true);
      setAccountLinkError(null);
      setLoadingRooms(false);
      setLoadingDepartments(false);
      setLoadingBookings(false);
      setLoadingAccounts(false);
      setLoadingAuditLogs(false);
      return;
    }

    setLoadingRooms(true);
    setLoadingDepartments(true);
    setLoadingBookings(true);
    setLoadingAuditLogs(true);

    const isBootstrapped = verifiedNow && isMainAdminEmail;

    // 1. Settings listener (/settings/system)
    const unsubSettings = onSnapshot(
      doc(db, 'settings', 'system'),
      (snapshot) => {
        if (snapshot.exists()) {
          setSystemSettings({
            ...DEFAULT_SYSTEM_SETTINGS,
            ...(snapshot.data() as SystemSettings),
            id: 'system',
          });
        } else {
          setSystemSettings(DEFAULT_SYSTEM_SETTINGS);
        }
      },
      (error) => {
        handleFirestoreError(error, OperationType.GET, 'settings/system');
      }
    );

    // 2. Current user's branch/staff account document listener
    let unsubMyAccount = () => {};
    if (user.email && (verifiedNow || isPwd) && !isBootstrapped) {
      const myAccId = emailToAccountId(user.email);
      unsubMyAccount = onSnapshot(
        doc(db, 'accounts', myAccId),
        (snapshot) => {
          if (snapshot.exists()) {
            const data = snapshot.data() as AccountRecord;
            if (isPwd && (data.authType !== 'credentials' || data.authUid !== user.uid)) {
              console.error('Account link mismatch detected for password user:', {
                accountId: myAccId,
                expectedAuthType: 'credentials',
                actualAuthType: data.authType ?? null,
                uidMatches: data.authUid === user.uid,
              });
              setMyAccountDoc(null);
              setAccountLinkError('unlinked_or_mismatched');
            } else {
              setMyAccountDoc({
                ...data,
                id: snapshot.id,
              });
              setAccountLinkError(null);
            }
          } else {
            setMyAccountDoc(null);
            setAccountLinkError('missing');
          }
          setMyAccountResolved(true);
        },
        (error) => {
          logFirestoreError(error, OperationType.GET, `accounts/${myAccId}`, {
            isPasswordUser: isPwd,
            accountId: myAccId,
          });
          setMyAccountDoc(null);
          setAccountLinkError(isPwd ? 'unlinked_or_mismatched' : 'permission_denied');
          setMyAccountResolved(true);
        }
      );
    } else {
      setMyAccountDoc(null);
      setMyAccountResolved(true);
      setAccountLinkError(null);
    }

    // 3. Full accounts directory (bootstrapped admin only)
    let unsubAccounts = () => {};
    if (isBootstrapped) {
      setLoadingAccounts(true);
      unsubAccounts = onSnapshot(
        query(collection(db, 'accounts')),
        (snapshot) => {
          const list: AccountRecord[] = snapshot.docs.map((d) => ({
            ...(d.data() as AccountRecord),
            id: d.id,
          }));
          list.sort((a, b) => a.displayName.localeCompare(b.displayName, 'ar'));
          setAccounts(list);
          setLoadingAccounts(false);
        },
        (error) => {
          setLoadingAccounts(false);
          handleFirestoreError(error, OperationType.LIST, 'accounts');
        }
      );
    } else {
      setAccounts([]);
      setLoadingAccounts(false);
    }

    // 4. Classrooms listener
    const roomsQuery = isBootstrapped
      ? query(collection(db, 'classrooms'))
      : query(
          collection(db, 'classrooms'),
          where('status', 'in', ['available', 'maintenance'])
        );

    const unsubRooms = onSnapshot(
      roomsQuery,
      (snapshot) => {
        const list: Classroom[] = snapshot.docs.map((d) => ({
          ...(d.data() as Classroom),
          id: d.id,
        }));
        list.sort((a, b) => a.code.localeCompare(b.code));
        setClassrooms(list);
        setLoadingRooms(false);

        if (list.length === 0 && isBootstrapped && !autoSeedTriggeredRef.current) {
          autoSeedTriggeredRef.current = true;
          void seedDefaultWorkspace();
        }
      },
      (error) => {
        setLoadingRooms(false);
        handleFirestoreError(error, OperationType.LIST, 'classrooms');
      }
    );

    // 5. Bookings listener
    let unsubBookingsPrimary = () => {};
    let unsubBookingsOwn = () => {};

    if (isBootstrapped) {
      const bookingsQuery = query(collection(db, 'bookings'));
      unsubBookingsPrimary = onSnapshot(
        bookingsQuery,
        (snapshot) => {
          const list: Booking[] = snapshot.docs.map((d) => ({
            ...(d.data() as Booking),
            id: d.id,
          }));
          setBookings(list);
          setLoadingBookings(false);
        },
        (error) => {
          setLoadingBookings(false);
          handleFirestoreError(error, OperationType.LIST, 'bookings');
        }
      );
    } else {
      let activeSnapDocs: Booking[] = [];
      let ownSnapDocs: Booking[] = [];
      const mergeAndSet = () => {
        const map = new Map<string, Booking>();
        for (const item of activeSnapDocs) map.set(item.id, item);
        for (const item of ownSnapDocs) map.set(item.id, item);
        setBookings(Array.from(map.values()));
        setLoadingBookings(false);
      };

      unsubBookingsPrimary = onSnapshot(
        query(
          collection(db, 'bookings'),
          where('status', 'in', ['confirmed', 'pending'])
        ),
        (snapshot) => {
          activeSnapDocs = snapshot.docs.map((d) => ({
            ...(d.data() as Booking),
            id: d.id,
          }));
          mergeAndSet();
        },
        (error) => {
          setLoadingBookings(false);
          handleFirestoreError(error, OperationType.LIST, 'bookings');
        }
      );

      unsubBookingsOwn = onSnapshot(
        query(
          collection(db, 'bookings'),
          where('creatorId', '==', user.uid)
        ),
        (snapshot) => {
          ownSnapDocs = snapshot.docs.map((d) => ({
            ...(d.data() as Booking),
            id: d.id,
          }));
          mergeAndSet();
        },
        (error) => {
          setLoadingBookings(false);
          handleFirestoreError(error, OperationType.LIST, 'bookings');
        }
      );
    }

    // 6. Departments listener
    const departmentsQuery = isBootstrapped
      ? query(collection(db, 'departments'))
      : query(
          collection(db, 'departments'),
          where('status', 'in', ['active', 'inactive'])
        );

    const unsubDepartments = onSnapshot(
      departmentsQuery,
      (snapshot) => {
        const list: Department[] = snapshot.docs.map((d) => ({
          ...(d.data() as Department),
          id: d.id,
        }));
        list.sort((a, b) => a.code.localeCompare(b.code));
        setDepartments(list);
        setLoadingDepartments(false);

        if (list.length === 0 && isBootstrapped && !autoSeedDeptsTriggeredRef.current) {
          autoSeedDeptsTriggeredRef.current = true;
          void seedDefaultDepartments();
        }
      },
      (error) => {
        setLoadingDepartments(false);
        handleFirestoreError(error, OperationType.LIST, 'departments');
      }
    );

    // 7. Immutable Audit Logs listener
    let unsubAuditPrimary = () => {};
    let unsubAuditOwn = () => {};

    if (isBootstrapped) {
      unsubAuditPrimary = onSnapshot(
        query(collection(db, 'auditLogs'), orderBy('createdAt', 'desc'), limit(400)),
        (snapshot) => {
          const list: AuditLogEntry[] = snapshot.docs.map((d) => ({
            ...(d.data() as AuditLogEntry),
            id: d.id,
          }));
          setAuditLogs(list);
          setLoadingAuditLogs(false);
        },
        (error) => {
          setLoadingAuditLogs(false);
          handleFirestoreError(error, OperationType.LIST, 'auditLogs');
        }
      );
    } else {
      let workspaceLogs: AuditLogEntry[] = [];
      let ownLogs: AuditLogEntry[] = [];
      const mergeLogs = () => {
        const map = new Map<string, AuditLogEntry>();
        for (const item of workspaceLogs) map.set(item.id, item);
        for (const item of ownLogs) map.set(item.id, item);
        setAuditLogs(Array.from(map.values()));
        setLoadingAuditLogs(false);
      };

      unsubAuditPrimary = onSnapshot(
        query(
          collection(db, 'auditLogs'),
          where('entityType', 'in', ['booking', 'classroom', 'department'])
        ),
        (snapshot) => {
          workspaceLogs = snapshot.docs.map((d) => ({
            ...(d.data() as AuditLogEntry),
            id: d.id,
          }));
          mergeLogs();
        },
        () => {
          setLoadingAuditLogs(false);
        }
      );

      unsubAuditOwn = onSnapshot(
        query(collection(db, 'auditLogs'), where('actorUid', '==', user.uid)),
        (snapshot) => {
          ownLogs = snapshot.docs.map((d) => ({
            ...(d.data() as AuditLogEntry),
            id: d.id,
          }));
          mergeLogs();
        },
        () => {
          setLoadingAuditLogs(false);
        }
      );
    }

    return () => {
      unsubSettings();
      unsubMyAccount();
      unsubAccounts();
      unsubRooms();
      unsubDepartments();
      unsubBookingsPrimary();
      unsubBookingsOwn();
      unsubAuditPrimary();
      unsubAuditOwn();
    };
  }, [authReady, user, seedDefaultWorkspace, seedDefaultDepartments]);

  const recordAuditLog = useCallback(
    async (params: {
      entityType: AuditEntityType;
      entityId: string;
      entityLabel: string;
      action: AuditActionType;
      summary: string;
    }) => {
      const isCredentialActive = Boolean(
        isPasswordUser &&
          myAccountDoc?.authType === 'credentials' &&
          myAccountDoc?.status === 'active'
      );
      if (
        !user ||
        (!user.emailVerified && !isCredentialActive) ||
        access.isSuspended ||
        access.role === 'viewer'
      ) {
        return;
      }
      const logId = generateSafeId('log');
      const safeEntityId = BLUEPRINT_LIMITS.ID_PATTERN.test(params.entityId)
        ? params.entityId.slice(0, 128)
        : 'system';
      const actorName = (
        myAccountDoc?.displayName ||
        user.displayName ||
        'مستخدم المنظومة'
      )
        .trim()
        .slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX);
      const branchName = (access.branchName || systemSettings.organizationName)
        .trim()
        .slice(0, BLUEPRINT_LIMITS.BRANCH_NAME_MAX);
      const entityLabel = params.entityLabel
        .trim()
        .slice(0, BLUEPRINT_LIMITS.AUDIT_ENTITY_LABEL_MAX);
      const summary = params.summary
        .trim()
        .slice(0, BLUEPRINT_LIMITS.AUDIT_SUMMARY_MAX);

      if (!actorName || !entityLabel || summary.length < 2) return;

      try {
        await setDoc(doc(db, 'auditLogs', logId), {
          id: logId,
          entityType: params.entityType,
          entityId: safeEntityId,
          entityLabel,
          action: params.action,
          summary,
          actorUid: user.uid,
          actorName,
          actorRole: access.role,
          branchName,
          createdAt: serverTimestamp(),
        });
      } catch (err) {
        console.error('Audit log write skipped:', err);
      }
    },
    [user, isPasswordUser, access, myAccountDoc, systemSettings.organizationName]
  );

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(formatAuthErrorAr(err));
    }
  };

  const handleCredentialsSignIn = async (identifier: string, password: string) => {
    setAuthError(null);
    const cleanId = identifier.trim().toLowerCase();
    try {
      const authEmail = usernameToAuthEmail(identifier);
      await signInWithCredentials(authEmail, password);
    } catch (err) {
      if (cleanId === BOOTSTRAPPED_ADMIN_EMAIL) {
        setAuthError(
          `لحساب الإدارة الرئيسي (${BOOTSTRAPPED_ADMIN_EMAIL})، يرجى الضغط على زر «دخول الإدارة بحساب Google» بالأسفل للدخول بضغطة واحدة.`
        );
        return;
      }
      setAuthError(formatAuthErrorAr(err));
    }
  };

  const coordinatorVisibleBookings = useMemo(() => {
    if (!user || access.role !== 'coordinator') return bookings;
    const myDept = access.branchName.trim();
    return bookings.filter(
      (b) => b.department.trim() === myDept || b.creatorId === user.uid
    );
  }, [access.branchName, access.role, bookings, user]);

  // KPI metrics & per-classroom occupancy for selectedDate
  const metrics = useMemo(() => {
    const startMins = timeToMinutes(systemSettings.workStartHour || '08:00');
    const endMins = timeToMinutes(systemSettings.workEndHour || '21:00');
    const dailyOperatingHours =
      endMins > startMins ? Math.round(((endMins - startMins) / 60) * 10) / 10 : 13;

    const availableRooms = classrooms.filter((r) => r.status === 'available').length;
    const maintenanceRooms = classrooms.length - availableRooms;
    const todayActive = bookings.filter(
      (b) => b.date === selectedDate && isActiveBooking(b)
    );
    const todayConfirmedCount = todayActive.filter(
      (b) => b.status === 'confirmed'
    ).length;
    const pendingCount = bookings.filter((b) => b.status === 'pending').length;
    const scopedPendingCount =
      access.role === 'coordinator'
        ? coordinatorVisibleBookings.filter((b) => b.status === 'pending').length
        : pendingCount;
    const scheduledHours = todayActive.reduce(
      (sum, b) => sum + calculateDurationHours(b.startTime, b.endTime),
      0
    );

    const roomOccupancyList: RoomOccupancyStat[] = classrooms.map((room) => {
      const isMaintenance = room.status === 'maintenance';
      if (isMaintenance) {
        return {
          id: room.id,
          name: room.name,
          code: room.code,
          floor: room.floor,
          capacity: room.capacity,
          isMaintenance: true,
          sessionsCount: 0,
          confirmedHours: 0,
          pendingHours: 0,
          totalHours: 0,
          confirmedPct: 0,
          pendingPct: 0,
          totalPct: 0,
          remainingPct: 0,
        };
      }

      const roomBookings = todayActive.filter((b) => b.roomId === room.id);
      const confirmedHrsRaw = roomBookings
        .filter((b) => b.status === 'confirmed')
        .reduce((sum, b) => sum + calculateDurationHours(b.startTime, b.endTime), 0);
      const pendingHrsRaw = roomBookings
        .filter((b) => b.status === 'pending')
        .reduce((sum, b) => sum + calculateDurationHours(b.startTime, b.endTime), 0);
      const totalHrsRaw = confirmedHrsRaw + pendingHrsRaw;

      const totalPct =
        dailyOperatingHours > 0
          ? Math.min(100, Math.round((totalHrsRaw / dailyOperatingHours) * 100))
          : 0;
      const confirmedPct =
        dailyOperatingHours > 0
          ? Math.min(totalPct, Math.round((confirmedHrsRaw / dailyOperatingHours) * 100))
          : 0;
      const pendingPct = Math.max(0, totalPct - confirmedPct);

      return {
        id: room.id,
        name: room.name,
        code: room.code,
        floor: room.floor,
        capacity: room.capacity,
        isMaintenance: false,
        sessionsCount: roomBookings.length,
        confirmedHours: Math.round(confirmedHrsRaw * 10) / 10,
        pendingHours: Math.round(pendingHrsRaw * 10) / 10,
        totalHours: Math.round(totalHrsRaw * 10) / 10,
        confirmedPct,
        pendingPct,
        totalPct,
        remainingPct: Math.max(0, 100 - totalPct),
      };
    });

    const totalAvailableCapacityHours = availableRooms * dailyOperatingHours;
    const bookedAvailableHours = roomOccupancyList
      .filter((r) => !r.isMaintenance)
      .reduce((sum, r) => sum + r.totalHours, 0);
    const overallOccupancyPct =
      totalAvailableCapacityHours > 0
        ? Math.min(100, Math.round((bookedAvailableHours / totalAvailableCapacityHours) * 100))
        : 0;
    const readinessPct =
      classrooms.length > 0
        ? Math.round((availableRooms / classrooms.length) * 100)
        : 0;

    return {
      availableRooms,
      maintenanceRooms,
      totalRooms: classrooms.length,
      readinessPct,
      todayCount: todayActive.length,
      todayConfirmedCount,
      pendingCount,
      scopedPendingCount,
      scheduledHours: Math.round(scheduledHours * 10) / 10,
      dailyOperatingHours,
      overallOccupancyPct,
      roomOccupancyList,
    };
  }, [
    access.role,
    bookings,
    classrooms,
    coordinatorVisibleBookings,
    selectedDate,
    systemSettings.workStartHour,
    systemSettings.workEndHour,
  ]);

  const isTabAllowed = useMemo(
    () => (tab: ViewTab) => {
      if (tab === 'schedule') return true;
      if (tab === 'bookings') return access.canViewBookingsTab;
      if (tab === 'classrooms') return access.canViewClassroomsTab;
      if (tab === 'departments') return access.canViewDepartmentsTab;
      if (tab === 'reports') return access.canViewReports;
      if (tab === 'audit') return access.canViewAuditLog;
      if (tab === 'accounts') return access.canManageAccounts;
      if (tab === 'settings') return access.canManageSettings;
      return false;
    },
    [access]
  );

  useEffect(() => {
    if (
      authReady &&
      user &&
      myAccountResolved &&
      !access.isAccessBlocked &&
      !isTabAllowed(activeTab)
    ) {
      setActiveTab('schedule');
    }
  }, [
    authReady,
    user,
    myAccountResolved,
    access.isAccessBlocked,
    activeTab,
    isTabAllowed,
  ]);

  // Booking CRUD
  const openNewBooking = (
    roomId?: string,
    date?: string,
    startTime?: string,
    endTime?: string,
    departmentName?: string
  ) => {
    if (!access.canCreateBookings) return;
    const fallbackRoom =
      classrooms.find((r) => r.status === 'available')?.id ||
      classrooms[0]?.id ||
      '';
    const coordinatorDept =
      access.role === 'coordinator' && access.branchName
        ? access.branchName
        : '';
    const defaultDept =
      departmentName ||
      coordinatorDept ||
      departments.find((d) => d.status === 'active')?.name ||
      ATABA_DEPARTMENTS[0];
    setBookingDraft({
      roomId: roomId || fallbackRoom,
      courseTitle: '',
      instructorName: '',
      department: defaultDept,
      bookingType: 'lecture',
      date: date || selectedDate,
      startTime: startTime || '09:00',
      endTime: endTime || '11:00',
      attendeesCount: 25,
      status: access.canApproveBookings ? 'confirmed' : 'pending',
      notes: '',
    });
    setBookingModalOpen(true);
  };

  const openEditBooking = (booking: Booking) => {
    setBookingDraft({
      id: booking.id,
      roomId: booking.roomId,
      courseTitle: booking.courseTitle,
      instructorName: booking.instructorName,
      department: booking.department,
      bookingType: booking.bookingType,
      date: booking.date,
      startTime: booking.startTime,
      endTime: booking.endTime,
      attendeesCount: booking.attendeesCount,
      status: booking.status,
      notes: booking.notes,
    });
    setInspectedBooking(null);
    setBookingModalOpen(true);
  };

  const handleSaveBooking = async (draft: BookingDraft) => {
    if (!user) {
      throw new Error('يرجى تسجيل الدخول أولاً لإرسال طلب الحجز.');
    }
    if (access.isSuspended) {
      throw new Error(translateFirestoreBookingErrorAr(null, { isSuspended: true }));
    }
    if (access.role === 'viewer') {
      throw new Error(translateFirestoreBookingErrorAr(null, { isViewer: true }));
    }
    if (isPasswordUser) {
      if (!myAccountDoc) {
        throw new Error(
          translateFirestoreBookingErrorAr(null, {
            accountMissing: accountLinkError === 'missing',
            accountUnlinked: accountLinkError !== 'missing',
          })
        );
      }
      if (myAccountDoc.authType !== 'credentials' || myAccountDoc.authUid !== user.uid) {
        throw new Error(translateFirestoreBookingErrorAr(null, { accountUnlinked: true }));
      }
      if (myAccountDoc.status !== 'active') {
        throw new Error(translateFirestoreBookingErrorAr(null, { isSuspended: true }));
      }
    }
    if (!access.canCreateBookings) {
      throw new Error('حسابك لا يملك صلاحية إنشاء أو تعديل طلبات الحجز.');
    }

    const targetRoom = classrooms.find((r) => r.id === draft.roomId);
    if (!targetRoom || !BLUEPRINT_LIMITS.ID_PATTERN.test(targetRoom.id)) {
      throw new Error(translateFirestoreBookingErrorAr(null, { roomMissing: true }));
    }

    // Verify classroom exists in Firestore and its document `id` matches `roomId`
    try {
      const roomSnap = await getDoc(doc(db, 'classrooms', targetRoom.id));
      if (!roomSnap.exists()) {
        throw new Error(translateFirestoreBookingErrorAr(null, { roomMissing: true }));
      }
      const roomData = roomSnap.data() as Partial<Classroom> | undefined;
      if (roomData?.id !== targetRoom.id) {
        throw new Error(translateFirestoreBookingErrorAr(null, { roomMismatch: true }));
      }
    } catch (roomCheckErr) {
      if (
        roomCheckErr instanceof Error &&
        (roomCheckErr.message.includes('القاعة المختارة') ||
          roomCheckErr.message.includes('قاعدة البيانات'))
      ) {
        throw roomCheckErr;
      }
      const code =
        typeof roomCheckErr === 'object' && roomCheckErr !== null && 'code' in roomCheckErr
          ? String((roomCheckErr as { code?: unknown }).code || '').toLowerCase()
          : '';
      if (code === 'permission-denied' || code === 'firestore/permission-denied') {
        logFirestoreError(roomCheckErr, OperationType.GET, `classrooms/${targetRoom.id}`);
        throw new Error(translateFirestoreBookingErrorAr(roomCheckErr, { roomMissing: true }));
      }
    }

    const accountBranchTrimmed = (myAccountDoc?.branchName || '').trim();
    let effectiveDepartment = draft.department.trim().slice(0, BLUEPRINT_LIMITS.DEPARTMENT_MAX);
    if (access.role === 'coordinator') {
      const coordinatorBranch = (myAccountDoc?.branchName || access.branchName || '').trim();
      if (coordinatorBranch.length < 2) {
        throw new Error(translateFirestoreBookingErrorAr(null, { departmentMismatch: true }));
      }
      effectiveDepartment = coordinatorBranch.slice(0, BLUEPRINT_LIMITS.DEPARTMENT_MAX);
      if (
        draft.department.trim().length >= 2 &&
        draft.department.trim() !== effectiveDepartment &&
        myAccountDoc?.role === 'coordinator'
      ) {
        throw new Error(translateFirestoreBookingErrorAr(null, { departmentMismatch: true }));
      }
    }

    const cleanRoomName = (
      targetRoom.name.trim().length >= 2 ? targetRoom.name.trim() : 'قاعة دراسية'
    ).slice(0, BLUEPRINT_LIMITS.ROOM_NAME_MAX);
    const cleanCourseTitle = draft.courseTitle
      .trim()
      .slice(0, BLUEPRINT_LIMITS.COURSE_TITLE_MAX);
    const cleanInstructor = draft.instructorName
      .trim()
      .slice(0, BLUEPRINT_LIMITS.INSTRUCTOR_MAX);
    const cleanNotes = draft.notes.trim().slice(0, BLUEPRINT_LIMITS.NOTES_MAX);
    const safeAttendees = Math.trunc(Number(draft.attendeesCount) || 0);
    const validBookingType =
      draft.bookingType === 'lecture' ||
      draft.bookingType === 'workshop' ||
      draft.bookingType === 'exam' ||
      draft.bookingType === 'seminar';

    if (
      cleanRoomName.length < 2 ||
      cleanCourseTitle.length < 2 ||
      cleanInstructor.length < 2 ||
      effectiveDepartment.length < 2 ||
      !validBookingType ||
      !BLUEPRINT_LIMITS.DATE_PATTERN.test(draft.date) ||
      !BLUEPRINT_LIMITS.TIME_PATTERN.test(draft.startTime) ||
      !BLUEPRINT_LIMITS.TIME_PATTERN.test(draft.endTime) ||
      draft.startTime >= draft.endTime ||
      safeAttendees < 1 ||
      safeAttendees > BLUEPRINT_LIMITS.CAPACITY_MAX
    ) {
      throw new Error(translateFirestoreBookingErrorAr(null, { payloadInvalid: true }));
    }

    const effectiveStatus: BookingStatus = access.canApproveBookings ? draft.status : 'pending';

    if (isActiveBooking({ status: effectiveStatus })) {
      const conflicts = findBookingConflicts(bookings, {
        id: draft.id,
        roomId: targetRoom.id,
        date: draft.date,
        startTime: draft.startTime,
        endTime: draft.endTime,
      });
      if (conflicts.length > 0) {
        const firstConflict = conflicts[0];
        throw new Error(
          `يوجد تعارض زمني في نفس الوقت: القاعة «${targetRoom.name}» محجوزة بالفعل من ${formatTime12Ar(firstConflict.startTime)} إلى ${formatTime12Ar(firstConflict.endTime)}. يرجى اختيار وقت أو قاعة أخرى.`
        );
      }
    }

    const deptMatchesAccount =
      !myAccountDoc ||
      myAccountDoc.role !== 'coordinator' ||
      effectiveDepartment === accountBranchTrimmed;

    if (draft.id) {
      const path = `bookings/${draft.id}`;
      try {
        const updatePayload: Record<string, unknown> = {
          roomId: targetRoom.id,
          roomName: cleanRoomName,
          courseTitle: cleanCourseTitle,
          instructorName: cleanInstructor,
          department: effectiveDepartment,
          bookingType: draft.bookingType,
          date: draft.date,
          startTime: draft.startTime,
          endTime: draft.endTime,
          attendeesCount: safeAttendees,
          notes: cleanNotes,
          updatedAt: serverTimestamp(),
        };
        if (access.canApproveBookings) {
          updatePayload.status = draft.status;
        }
        await updateDoc(doc(db, 'bookings', draft.id), updatePayload);
        void recordAuditLog({
          entityType: 'booking',
          entityId: draft.id,
          entityLabel: `${cleanRoomName} — ${cleanCourseTitle}`,
          action: 'update',
          summary: `تعديل حجز ${effectiveDepartment} (${draft.date} من ${draft.startTime} إلى ${draft.endTime})`,
        });
        showToast('تم تحديث الحجز في الجدول الدراسي');
      } catch (err) {
        logFirestoreError(err, OperationType.UPDATE, path, {
          role: access.role,
          accountRole: myAccountDoc?.role ?? null,
          accountStatus: myAccountDoc?.status ?? null,
          deptMatchesAccount,
          roomId: targetRoom.id,
        });
        throw new Error(
          translateFirestoreBookingErrorAr(err, {
            isSuspended: myAccountDoc?.status === 'suspended',
            isViewer: myAccountDoc?.role === 'viewer',
            departmentMismatch: !deptMatchesAccount,
          })
        );
      }
    } else {
      const newId = generateSafeId('bk');
      const path = `bookings/${newId}`;
      const nextStatus: BookingStatus = access.canApproveBookings ? draft.status : 'pending';
      const creatorName = (
        myAccountDoc?.displayName?.trim() ||
        user.displayName?.trim() ||
        'مستخدم'
      ).slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX);

      try {
        await setDoc(doc(db, 'bookings', newId), {
          id: newId,
          roomId: targetRoom.id,
          roomName: cleanRoomName,
          courseTitle: cleanCourseTitle,
          instructorName: cleanInstructor,
          department: effectiveDepartment,
          bookingType: draft.bookingType,
          date: draft.date,
          startTime: draft.startTime,
          endTime: draft.endTime,
          attendeesCount: safeAttendees,
          status: nextStatus,
          notes: cleanNotes,
          creatorId: user.uid,
          creatorName,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        void recordAuditLog({
          entityType: 'booking',
          entityId: newId,
          entityLabel: `${cleanRoomName} — ${cleanCourseTitle}`,
          action: 'create',
          summary: `حجز جديد لقسم ${effectiveDepartment} (${draft.date} من ${draft.startTime} إلى ${draft.endTime}) · ${BOOKING_STATUS_LABEL[nextStatus]}`,
        });
        showToast(
          access.canApproveBookings
            ? 'تم تثبيت الحجز في الجدول الدراسي'
            : 'تم إرسال طلب الحجز بنجاح'
        );
      } catch (err) {
        logFirestoreError(err, OperationType.CREATE, path, {
          role: access.role,
          accountRole: myAccountDoc?.role ?? null,
          accountStatus: myAccountDoc?.status ?? null,
          accountAuthType: myAccountDoc?.authType ?? null,
          uidMatches: myAccountDoc?.authUid === user.uid,
          nextStatus,
          deptMatchesAccount,
          roomId: targetRoom.id,
        });
        throw new Error(
          translateFirestoreBookingErrorAr(err, {
            accountMissing: isPasswordUser && !myAccountDoc && accountLinkError === 'missing',
            accountUnlinked:
              isPasswordUser &&
              (!myAccountDoc ||
                myAccountDoc.authType !== 'credentials' ||
                myAccountDoc.authUid !== user.uid),
            isSuspended: myAccountDoc?.status === 'suspended',
            isViewer: myAccountDoc?.role === 'viewer',
            departmentMismatch: !deptMatchesAccount,
            statusNotAllowed: !access.canApproveBookings && nextStatus !== 'pending',
          })
        );
      }
    }
  };

  const handleApproveBooking = async (booking: Booking) => {
    const path = `bookings/${booking.id}`;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'confirmed',
        updatedAt: serverTimestamp(),
      });
      void recordAuditLog({
        entityType: 'booking',
        entityId: booking.id,
        entityLabel: `${booking.roomName} — ${booking.courseTitle}`,
        action: 'approve',
        summary: `الموافقة على حجز ${booking.department} وتثبيته في الجدول ليوم ${booking.date}`,
      });
      setInspectedBooking(null);
      showToast('تمت الموافقة على الحجز وتثبيته في الجدول');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleRejectBooking = async (booking: Booking) => {
    const path = `bookings/${booking.id}`;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'rejected',
        updatedAt: serverTimestamp(),
      });
      void recordAuditLog({
        entityType: 'booking',
        entityId: booking.id,
        entityLabel: `${booking.roomName} — ${booking.courseTitle}`,
        action: 'reject',
        summary: `رفض طلب الحجز المقدم من ${booking.department} ليوم ${booking.date}`,
      });
      setInspectedBooking(null);
      showToast('تم رفض طلب الحجز');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleCancelBooking = async (booking: Booking) => {
    const path = `bookings/${booking.id}`;
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
      void recordAuditLog({
        entityType: 'booking',
        entityId: booking.id,
        entityLabel: `${booking.roomName} — ${booking.courseTitle}`,
        action: 'cancel',
        summary: `إلغاء حجز ${booking.department} المجدول ليوم ${booking.date}`,
      });
      setInspectedBooking(null);
      showToast('تم إلغاء الحجز');
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteBooking = async (booking: Booking) => {
    const path = `bookings/${booking.id}`;
    try {
      await deleteDoc(doc(db, 'bookings', booking.id));
      void recordAuditLog({
        entityType: 'booking',
        entityId: booking.id,
        entityLabel: `${booking.roomName} — ${booking.courseTitle}`,
        action: 'delete',
        summary: `حذف سجل الحجز نهائياً (${booking.department} · ${booking.date})`,
      });
      setInspectedBooking(null);
      showToast('تم حذف سجل الحجز');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Classroom CRUD (Admin only)
  const openAddClassroom = () => {
    setClassroomDraft({
      name: '',
      code: '',
      floor: 'الطابق الأول',
      capacity: 35,
      equipment: ['سبورة ذكية تفاعلية', 'جهاز عرض عالي الدقة'],
      status: 'available',
      imageUrl: CLASSROOM_IMAGE_PRESETS[0].url,
      notes: '',
    });
    setClassroomModalOpen(true);
  };

  const openEditClassroom = (room: Classroom) => {
    setClassroomDraft({
      id: room.id,
      name: room.name,
      code: room.code,
      floor: room.floor,
      capacity: room.capacity,
      equipment: [...room.equipment],
      status: room.status,
      imageUrl: room.imageUrl,
      notes: room.notes,
    });
    setClassroomModalOpen(true);
  };

  const handleSaveClassroom = async (draft: ClassroomDraft) => {
    if (!user || !access.canManageClassrooms) return;
    if (draft.id) {
      const path = `classrooms/${draft.id}`;
      try {
        await updateDoc(doc(db, 'classrooms', draft.id), {
          name: draft.name,
          code: draft.code,
          floor: draft.floor,
          capacity: Math.trunc(draft.capacity),
          equipment: draft.equipment.slice(0, BLUEPRINT_LIMITS.EQUIPMENT_MAX_ITEMS),
          status: draft.status,
          imageUrl: draft.imageUrl,
          notes: draft.notes,
          updatedAt: serverTimestamp(),
        });
        void recordAuditLog({
          entityType: 'classroom',
          entityId: draft.id,
          entityLabel: `${draft.name} (${draft.code})`,
          action: 'update',
          summary: `تعديل بيانات القاعة (${draft.floor} · السعة ${Math.trunc(draft.capacity)} مقعداً)`,
        });
        showToast('تم تحديث بيانات القاعة');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    } else {
      const newId = generateSafeId('room');
      const path = `classrooms/${newId}`;
      try {
        await setDoc(doc(db, 'classrooms', newId), {
          id: newId,
          name: draft.name,
          code: draft.code,
          floor: draft.floor,
          capacity: Math.trunc(draft.capacity),
          equipment: draft.equipment.slice(0, BLUEPRINT_LIMITS.EQUIPMENT_MAX_ITEMS),
          status: draft.status,
          imageUrl: draft.imageUrl,
          notes: draft.notes,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        void recordAuditLog({
          entityType: 'classroom',
          entityId: newId,
          entityLabel: `${draft.name} (${draft.code})`,
          action: 'create',
          summary: `إضافة قاعة جديدة في ${draft.floor} بسعة ${Math.trunc(draft.capacity)} مقعداً`,
        });
        showToast('تمت إضافة القاعة الدراسية');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }
  };

  const handleToggleMaintenance = async (room: Classroom) => {
    const path = `classrooms/${room.id}`;
    const nextStatus = room.status === 'available' ? 'maintenance' : 'available';
    try {
      await updateDoc(doc(db, 'classrooms', room.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      void recordAuditLog({
        entityType: 'classroom',
        entityId: room.id,
        entityLabel: `${room.name} (${room.code})`,
        action: 'update',
        summary:
          nextStatus === 'maintenance'
            ? 'تحويل القاعة إلى وضع الصيانة وإيقاف حجزها مؤقتاً'
            : 'إعادة تفعيل القاعة وإتاحتها للحجز الدراسي',
      });
      showToast(
        nextStatus === 'maintenance'
          ? 'تم تحويل القاعة إلى وضع الصيانة'
          : 'تم تفعيل القاعة للحجز'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteClassroom = async (room: Classroom) => {
    const path = `classrooms/${room.id}`;
    try {
      await deleteDoc(doc(db, 'classrooms', room.id));
      void recordAuditLog({
        entityType: 'classroom',
        entityId: room.id,
        entityLabel: `${room.name} (${room.code})`,
        action: 'delete',
        summary: `حذف القاعة الدراسية من المنظومة (${room.floor})`,
      });
      showToast('تم حذف القاعة');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Department CRUD (Admin only)
  const openAddDepartment = () => {
    const nextCode = `DEP-${String(departments.length + 1).padStart(2, '0')}`;
    setDepartmentDraft({
      name: '',
      code: nextCode,
      headName: '',
      sector: 'العتبة الحسينية المقدسة',
      status: 'active',
      notes: '',
    });
    setDepartmentModalOpen(true);
  };

  const openEditDepartment = (dept: Department) => {
    setDepartmentDraft({
      id: dept.id,
      name: dept.name,
      code: dept.code,
      headName: dept.headName,
      sector: dept.sector,
      status: dept.status,
      notes: dept.notes,
    });
    setDepartmentModalOpen(true);
  };

  const handleSaveDepartment = async (draft: DepartmentDraft) => {
    if (!user || !access.canManageDepartments) return;
    if (draft.id) {
      const path = `departments/${draft.id}`;
      try {
        await updateDoc(doc(db, 'departments', draft.id), {
          name: draft.name,
          code: draft.code,
          headName: draft.headName,
          sector: draft.sector,
          status: draft.status,
          notes: draft.notes,
          updatedAt: serverTimestamp(),
        });
        void recordAuditLog({
          entityType: 'department',
          entityId: draft.id,
          entityLabel: `${draft.name} (${draft.code})`,
          action: 'update',
          summary: `تعديل بيانات القسم (${draft.sector})`,
        });
        showToast('تم تحديث بيانات القسم');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    } else {
      const newId = generateSafeId('dept');
      const path = `departments/${newId}`;
      try {
        await setDoc(doc(db, 'departments', newId), {
          id: newId,
          name: draft.name,
          code: draft.code,
          headName: draft.headName,
          sector: draft.sector,
          status: draft.status,
          notes: draft.notes,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        void recordAuditLog({
          entityType: 'department',
          entityId: newId,
          entityLabel: `${draft.name} (${draft.code})`,
          action: 'create',
          summary: `إضافة قسم جديد (${draft.sector})`,
        });
        showToast('تمت إضافة القسم إلى القائمة المعتمدة');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }
  };

  const handleToggleDepartmentStatus = async (dept: Department) => {
    const path = `departments/${dept.id}`;
    const nextStatus = dept.status === 'active' ? 'inactive' : 'active';
    try {
      await updateDoc(doc(db, 'departments', dept.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      void recordAuditLog({
        entityType: 'department',
        entityId: dept.id,
        entityLabel: `${dept.name} (${dept.code})`,
        action: 'update',
        summary: nextStatus === 'active' ? 'تفعيل القسم لطلبات الحجز' : 'إيقاف القسم مؤقتاً',
      });
      showToast(
        nextStatus === 'active' ? 'تم تفعيل القسم للحجز' : 'تم إيقاف القسم مؤقتاً'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteDepartment = async (dept: Department) => {
    const path = `departments/${dept.id}`;
    try {
      await deleteDoc(doc(db, 'departments', dept.id));
      void recordAuditLog({
        entityType: 'department',
        entityId: dept.id,
        entityLabel: `${dept.name} (${dept.code})`,
        action: 'delete',
        summary: 'حذف القسم من القائمة المعتمدة',
      });
      showToast('تم حذف القسم');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // Account CRUD (Bootstrapped Admin)
  const openAddAccount = () => {
    setAccountDraft({
      email: '',
      username: '',
      authType: 'credentials',
      password: '',
      displayName: '',
      branchName: '',
      role: 'branch_supervisor',
      status: 'active',
      permissions: defaultPermissionsForRole('branch_supervisor'),
      notes: '',
    });
    setAccountModalOpen(true);
  };

  const openUnifiedViewerAccount = () => {
    const existingCourses = accounts.some(
      (a) => (a.username || '').toLowerCase() === 'courses'
    );
    setAccountDraft({
      email: '',
      username: existingCourses ? `courses_${accounts.length + 1}` : 'courses',
      authType: 'credentials',
      password: generateReadablePassword(8),
      displayName: 'حساب اطلاع المنتسبين',
      branchName: 'جميع منتسبي المجمع',
      role: 'viewer',
      status: 'active',
      permissions: defaultPermissionsForRole('viewer'),
      notes: 'حساب موحّد للمنتسبين للاطلاع على جدول الدورات والقاعات فقط',
    });
    setAccountModalOpen(true);
  };

  const openCreateCoordinatorForDept = (dept: Department) => {
    const takenUsernames = new Set(
      accounts
        .map((a) =>
          (
            a.username ||
            (isInternalAuthEmail(a.email) ? a.email.split('@')[0] : '')
          ).toLowerCase()
        )
        .filter(Boolean)
    );
    const suggestedUsername = suggestCoordinatorUsername(
      dept.code,
      takenUsernames,
      accounts.length + 1
    );
    const displayName = (dept.headName.trim() || `منسق ${dept.name}`).slice(
      0,
      BLUEPRINT_LIMITS.DISPLAY_NAME_MAX
    );
    setAccountDraft({
      email: '',
      username: suggestedUsername,
      authType: 'credentials',
      password: generateReadablePassword(8),
      displayName,
      branchName: dept.name.slice(0, BLUEPRINT_LIMITS.BRANCH_NAME_MAX),
      role: 'coordinator',
      status: 'active',
      permissions: defaultPermissionsForRole('coordinator'),
      notes: `منسق حجز القاعات لـ ${dept.name}`.slice(0, BLUEPRINT_LIMITS.NOTES_MAX),
    });
    setAccountModalOpen(true);
  };

  const handleBatchCreateCoordinators = async (targetDepts: Department[]) => {
    if (!user || !access.canManageAccounts || targetDepts.length === 0) return;

    const takenUsernames = new Set(
      accounts
        .map((a) =>
          (
            a.username ||
            (isInternalAuthEmail(a.email) ? a.email.split('@')[0] : '')
          ).toLowerCase()
        )
        .filter(Boolean)
    );

    const created: CreatedCredentialsNotice[] = [];
    let firstError: string | null = null;

    for (let i = 0; i < targetDepts.length; i += 1) {
      const dept = targetDepts[i];
      const username = suggestCoordinatorUsername(dept.code, takenUsernames, i + 1);
      const authEmail = usernameToAuthEmail(username);
      const accId = emailToAccountId(authEmail);
      const password = generateReadablePassword(8);
      const displayName = (dept.headName.trim() || `منسق ${dept.name}`).slice(
        0,
        BLUEPRINT_LIMITS.DISPLAY_NAME_MAX
      );
      const branchName = dept.name.slice(0, BLUEPRINT_LIMITS.BRANCH_NAME_MAX);
      const perms = defaultPermissionsForRole('coordinator');

      try {
        const provisionedAuthUid = await provisionCredentialsUser({
          email: authEmail,
          password,
          displayName,
        });

        await setDoc(doc(db, 'accounts', accId), {
          id: accId,
          email: authEmail.slice(0, BLUEPRINT_LIMITS.EMAIL_MAX),
          username: username.slice(0, BLUEPRINT_LIMITS.USERNAME_MAX),
          authType: 'credentials',
          authUid: provisionedAuthUid,
          displayName,
          branchName,
          role: 'coordinator',
          status: 'active',
          permissions: perms,
          notes: `منسق حجز القاعات لـ ${branchName}`.slice(0, BLUEPRINT_LIMITS.NOTES_MAX),
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        created.push({
          displayName,
          username,
          password,
          branchName,
          role: 'coordinator',
        });
      } catch (err) {
        if (!firstError) {
          firstError = formatAuthErrorAr(err);
        }
      }
    }

    if (created.length > 0) {
      setBatchCreatedCredentials(created);
      void recordAuditLog({
        entityType: 'account',
        entityId: 'batch_coordinators',
        entityLabel: `تجهيز منسقي الأقسام (${created.length})`,
        action: 'create',
        summary: `إنشاء ${created.length} حسابات منسقي أقسام للحجز السريع`,
      });
      showToast(`تم إنشاء ${created.length} حساب منسق قسم بنجاح`);
    }

    if (created.length === 0 && firstError) {
      throw new Error(firstError);
    }
    if (firstError && created.length < targetDepts.length) {
      throw new Error(
        `تم إنشاء ${created.length} حساباً، وتعذر إكمال البقية: ${firstError}`
      );
    }
  };

  const openEditAccount = (acc: AccountRecord) => {
    setAccountDraft({
      id: acc.id,
      email: acc.email,
      username: acc.username || '',
      authType:
        acc.authType ||
        (acc.authUid?.trim() || isInternalAuthEmail(acc.email) ? 'credentials' : 'google'),
      authUid: acc.authUid || '',
      displayName: acc.displayName,
      branchName: acc.branchName,
      role: acc.role,
      status: acc.status,
      permissions: { ...acc.permissions },
      notes: acc.notes,
    });
    setAccountModalOpen(true);
  };

  const handleSaveAccount = async (draft: AccountDraft) => {
    if (!user || !access.canManageAccounts) return;
    const accId = draft.id || emailToAccountId(draft.email);
    const path = `accounts/${accId}`;
    const existing = accounts.find((a) => a.id === accId);

    if (draft.id || existing) {
      try {
        const resolvedAuthUid = (
          draft.authUid !== undefined ? draft.authUid : existing?.authUid || ''
        )
          .trim()
          .slice(0, 128);
        await updateDoc(doc(db, 'accounts', accId), {
          email: draft.email,
          username: (draft.username || existing?.username || '').slice(
            0,
            BLUEPRINT_LIMITS.USERNAME_MAX
          ),
          authType: draft.authType || existing?.authType || 'google',
          authUid: resolvedAuthUid,
          displayName: draft.displayName,
          branchName: draft.branchName,
          role: draft.role,
          status: draft.status,
          permissions: draft.permissions,
          notes: draft.notes,
          updatedAt: serverTimestamp(),
        });
        void recordAuditLog({
          entityType: 'account',
          entityId: accId,
          entityLabel: `${draft.displayName} (${draft.branchName})`,
          action: 'update',
          summary: `تعديل صلاحيات حساب ${ROLE_LABEL_AR[draft.role]}`,
        });
        showToast('تم تحديث صلاحيات الحساب');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    } else {
      let provisionedAuthUid = '';
      if (draft.authType === 'credentials') {
        try {
          provisionedAuthUid = await provisionCredentialsUser({
            email: draft.email,
            password: draft.password || '',
            displayName: draft.displayName,
          });
        } catch (err) {
          throw new Error(formatAuthErrorAr(err));
        }
      }

      try {
        await setDoc(doc(db, 'accounts', accId), {
          id: accId,
          email: draft.email,
          username: (draft.username || '').slice(0, BLUEPRINT_LIMITS.USERNAME_MAX),
          authType: draft.authType,
          authUid: provisionedAuthUid,
          displayName: draft.displayName,
          branchName: draft.branchName,
          role: draft.role,
          status: draft.status,
          permissions: draft.permissions,
          notes: draft.notes,
          createdBy: user.uid,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        void recordAuditLog({
          entityType: 'account',
          entityId: accId,
          entityLabel: `${draft.displayName} (${draft.branchName})`,
          action: 'create',
          summary: `إضافة حساب جديد (${draft.authType === 'credentials' ? 'يوزر دخول عادي' : 'Google'}) بصلاحية ${ROLE_LABEL_AR[draft.role]}`,
        });
        if (draft.authType === 'credentials') {
          setLastCreatedCredentials({
            displayName: draft.displayName,
            username: draft.username || draft.email,
            password: draft.password || '',
            branchName: draft.branchName,
            role: draft.role,
          });
        }
        showToast('تمت إضافة الحساب وتفعيل صلاحياته');
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
      }
    }
  };

  const handleToggleAccountStatus = async (acc: AccountRecord) => {
    const path = `accounts/${acc.id}`;
    const nextStatus = acc.status === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, 'accounts', acc.id), {
        status: nextStatus,
        updatedAt: serverTimestamp(),
      });
      void recordAuditLog({
        entityType: 'account',
        entityId: acc.id,
        entityLabel: `${acc.displayName} (${acc.branchName})`,
        action: 'update',
        summary: nextStatus === 'active' ? 'إعادة تفعيل الحساب' : 'تعليق صلاحيات الحساب مؤقتاً',
      });
      showToast(
        nextStatus === 'active' ? 'تم تفعيل الحساب' : 'تم تعليق صلاحيات الحساب'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, path);
    }
  };

  const handleDeleteAccount = async (acc: AccountRecord) => {
    const path = `accounts/${acc.id}`;
    try {
      await deleteDoc(doc(db, 'accounts', acc.id));
      void recordAuditLog({
        entityType: 'account',
        entityId: acc.id,
        entityLabel: `${acc.displayName} (${acc.branchName})`,
        action: 'delete',
        summary: 'حذف الحساب من سجل الصلاحيات',
      });
      showToast('تم حذف الحساب من سجل الصلاحيات');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, path);
    }
  };

  // System Settings & Backup/Restore
  const persistSettingsDoc = async (next: SystemSettings, skipAudit?: boolean) => {
    if (!user || !access.canManageSettings) return;
    const path = 'settings/system';
    const docRef = doc(db, 'settings', 'system');
    const payload = {
      id: 'system',
      organizationName: next.organizationName,
      complexSubtitle: next.complexSubtitle,
      workStartHour: next.workStartHour,
      workEndHour: next.workEndHour,
      maxAdvanceDays: Math.trunc(next.maxAdvanceDays),
      requireAdminApproval: Boolean(next.requireAdminApproval),
      allowWeekendBookings: Boolean(next.allowWeekendBookings),
      strictAccountAccess: Boolean(next.strictAccountAccess),
      reportHeaderTitle: next.reportHeaderTitle,
      reportFooterNote: next.reportFooterNote,
      lastBackupAt: next.lastBackupAt || '',
      lastBackupBy: next.lastBackupBy || '',
      updatedBy: user.uid,
      updatedAt: serverTimestamp(),
    };
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        await updateDoc(docRef, payload);
      } else {
        await setDoc(docRef, payload);
      }
      if (!skipAudit) {
        void recordAuditLog({
          entityType: 'settings',
          entityId: 'system',
          entityLabel: 'إعدادات تشغيل المنظومة',
          action: 'update',
          summary: `تحديث إعدادات الدوام (${next.workStartHour}–${next.workEndHour}) وسياسات الحجز`,
        });
      }
      showToast('تم حفظ إعدادات المنظومة');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, path);
    }
  };

  const handleRecordBackup = async () => {
    if (!user || !access.canManageSettings) return;
    const next: SystemSettings = {
      ...systemSettings,
      lastBackupAt: new Date().toISOString(),
      lastBackupBy: (user.displayName || user.email || 'الإدارة').slice(0, 80),
    };
    await persistSettingsDoc(next, true);
    void recordAuditLog({
      entityType: 'settings',
      entityId: 'system',
      entityLabel: 'النسخ الاحتياطي الشامل',
      action: 'restore',
      summary: 'تصدير نسخة احتياطية شاملة (JSON) لقاعات وأقسام وحجوزات المجمع',
    });
  };

  const handleRestoreBackup = async (bundle: SystemBackupBundle) => {
    if (!user || !access.canManageSettings) {
      throw new Error('لا تملك صلاحية استعادة النسخة الاحتياطية.');
    }

    const commitBatchedOps = async (
      ops: Array<(batch: ReturnType<typeof writeBatch>) => void>,
      collectionName: string
    ) => {
      const CHUNK_SIZE = 400;
      for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
        const batch = writeBatch(db);
        for (const fn of ops.slice(i, i + CHUNK_SIZE)) {
          fn(batch);
        }
        try {
          await batch.commit();
        } catch (err) {
          handleFirestoreError(err, OperationType.WRITE, collectionName);
        }
      }
    };

    const existingRoomIds = new Set(classrooms.map((r) => r.id));
    const roomOps = bundle.classrooms
      .filter((r) => r.id && BLUEPRINT_LIMITS.ID_PATTERN.test(r.id) && r.name && r.code)
      .map((r) => (batch: ReturnType<typeof writeBatch>) => {
        const id = r.id!;
        const ref = doc(db, 'classrooms', id);
        const equipment =
          Array.isArray(r.equipment) && r.equipment.length > 0
            ? r.equipment
                .map((item) => String(item).slice(0, BLUEPRINT_LIMITS.EQUIPMENT_ITEM_MAX))
                .slice(0, BLUEPRINT_LIMITS.EQUIPMENT_MAX_ITEMS)
            : ['سبورة ذكية تفاعلية'];
        const shared = {
          name: String(r.name).slice(0, BLUEPRINT_LIMITS.ROOM_NAME_MAX),
          code: String(r.code).slice(0, BLUEPRINT_LIMITS.ROOM_CODE_MAX),
          floor: String(r.floor || 'الطابق الأول').slice(0, BLUEPRINT_LIMITS.FLOOR_MAX),
          capacity: Math.max(1, Math.min(BLUEPRINT_LIMITS.CAPACITY_MAX, Math.trunc(Number(r.capacity) || 30))),
          equipment,
          status: r.status === 'maintenance' ? 'maintenance' : 'available',
          imageUrl: String(r.imageUrl || '').slice(0, BLUEPRINT_LIMITS.IMAGE_URL_MAX),
          notes: String(r.notes || '').slice(0, BLUEPRINT_LIMITS.NOTES_MAX),
          updatedAt: serverTimestamp(),
        };
        if (existingRoomIds.has(id)) {
          batch.update(ref, shared);
        } else {
          batch.set(ref, {
            id,
            ...shared,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
          });
        }
      });

    await commitBatchedOps(roomOps, 'classrooms');

    const existingDeptIds = new Set(departments.map((d) => d.id));
    const deptOps = bundle.departments
      .filter((d) => d.id && BLUEPRINT_LIMITS.ID_PATTERN.test(d.id) && d.name && d.code)
      .map((d) => (batch: ReturnType<typeof writeBatch>) => {
        const id = d.id!;
        const ref = doc(db, 'departments', id);
        const shared = {
          name: String(d.name).slice(0, BLUEPRINT_LIMITS.DEPARTMENT_MAX),
          code: String(d.code).slice(0, BLUEPRINT_LIMITS.ROOM_CODE_MAX),
          headName: String(d.headName || '').slice(0, BLUEPRINT_LIMITS.HEAD_NAME_MAX),
          sector: String(d.sector || 'العتبة الحسينية المقدسة').slice(0, BLUEPRINT_LIMITS.SECTOR_MAX),
          status: d.status === 'inactive' ? 'inactive' : 'active',
          notes: String(d.notes || '').slice(0, BLUEPRINT_LIMITS.NOTES_MAX),
          updatedAt: serverTimestamp(),
        };
        if (existingDeptIds.has(id)) {
          batch.update(ref, shared);
        } else {
          batch.set(ref, {
            id,
            ...shared,
            createdBy: user.uid,
            createdAt: serverTimestamp(),
          });
        }
      });

    await commitBatchedOps(deptOps, 'departments');

    const validRoomIds = new Set([
      ...existingRoomIds,
      ...bundle.classrooms.map((r) => r.id).filter(Boolean),
    ]);
    const existingBookingIds = new Set(bookings.map((b) => b.id));
    const bookingOps = bundle.bookings
      .filter(
        (b) =>
          b.id &&
          BLUEPRINT_LIMITS.ID_PATTERN.test(b.id) &&
          b.roomId &&
          validRoomIds.has(b.roomId) &&
          b.courseTitle &&
          b.date &&
          b.startTime &&
          b.endTime &&
          b.startTime < b.endTime
      )
      .map((b) => (batch: ReturnType<typeof writeBatch>) => {
        const id = b.id!;
        const ref = doc(db, 'bookings', id);
        const shared = {
          roomId: b.roomId!,
          roomName: String(b.roomName || 'قاعة دراسية').slice(0, BLUEPRINT_LIMITS.ROOM_NAME_MAX),
          courseTitle: String(b.courseTitle).slice(0, BLUEPRINT_LIMITS.COURSE_TITLE_MAX),
          instructorName: String(b.instructorName || 'محاضر').slice(0, BLUEPRINT_LIMITS.INSTRUCTOR_MAX),
          department: String(b.department || ATABA_DEPARTMENTS[0]).slice(0, BLUEPRINT_LIMITS.DEPARTMENT_MAX),
          bookingType:
            b.bookingType === 'workshop' || b.bookingType === 'exam' || b.bookingType === 'seminar'
              ? b.bookingType
              : 'lecture',
          date: b.date!,
          startTime: b.startTime!,
          endTime: b.endTime!,
          attendeesCount: Math.max(1, Math.min(BLUEPRINT_LIMITS.CAPACITY_MAX, Math.trunc(Number(b.attendeesCount) || 20))),
          status:
            b.status === 'pending' || b.status === 'rejected' || b.status === 'cancelled'
              ? b.status
              : 'confirmed',
          notes: String(b.notes || '').slice(0, BLUEPRINT_LIMITS.NOTES_MAX),
          updatedAt: serverTimestamp(),
        };
        if (existingBookingIds.has(id)) {
          batch.update(ref, shared);
        } else {
          batch.set(ref, {
            id,
            ...shared,
            creatorId: user.uid,
            creatorName: (user.displayName || 'استعادة نسخة احتياطية').slice(0, 80),
            createdAt: serverTimestamp(),
          });
        }
      });

    await commitBatchedOps(bookingOps, 'bookings');

    let restoredAccountsCount = 0;
    if (access.canManageAccounts && Array.isArray(bundle.accounts)) {
      const existingAccountIds = new Set(accounts.map((a) => a.id));
      const accountOps = bundle.accounts
        .filter((a) => a.email && a.displayName)
        .map((a) => (batch: ReturnType<typeof writeBatch>) => {
          const email = String(a.email).trim().toLowerCase();
          const id = emailToAccountId(email);
          const ref = doc(db, 'accounts', id);
          const role =
            a.role === 'admin' || a.role === 'branch_supervisor' || a.role === 'viewer'
              ? a.role
              : 'coordinator';
          const perms = a.permissions
            ? {
                approveBookings: Boolean(a.permissions.approveBookings),
                manageBookings: Boolean(a.permissions.manageBookings),
                manageClassrooms: Boolean(a.permissions.manageClassrooms),
                manageDepartments: Boolean(a.permissions.manageDepartments),
                viewReports: Boolean(a.permissions.viewReports),
                manageSettings: Boolean(a.permissions.manageSettings),
              }
            : defaultPermissionsForRole(role);
          const shared = {
            email: email.slice(0, BLUEPRINT_LIMITS.EMAIL_MAX),
            username: String(a.username || '').slice(0, BLUEPRINT_LIMITS.USERNAME_MAX),
            authType: a.authType === 'credentials' ? 'credentials' : 'google',
            authUid: String(a.authUid || '').slice(0, 128),
            displayName: String(a.displayName).slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
            branchName: String(a.branchName || 'قسم مجمع سيد الشهداء (ع) الخدمي').slice(0, BLUEPRINT_LIMITS.BRANCH_NAME_MAX),
            role,
            status: a.status === 'suspended' ? 'suspended' : 'active',
            permissions: perms,
            notes: String(a.notes || '').slice(0, BLUEPRINT_LIMITS.NOTES_MAX),
            updatedAt: serverTimestamp(),
          };
          if (existingAccountIds.has(id)) {
            batch.update(ref, shared);
          } else {
            batch.set(ref, {
              id,
              ...shared,
              createdBy: user.uid,
              createdAt: serverTimestamp(),
            });
          }
        });
      restoredAccountsCount = accountOps.length;
      await commitBatchedOps(accountOps, 'accounts');
    }

    if (bundle.settings) {
      await persistSettingsDoc(
        {
          ...DEFAULT_SYSTEM_SETTINGS,
          ...systemSettings,
          ...bundle.settings,
          id: 'system',
          updatedBy: user.uid,
        },
        true
      );
    }

    void recordAuditLog({
      entityType: 'settings',
      entityId: 'system',
      entityLabel: 'استعادة نسخة احتياطية',
      action: 'restore',
      summary: `استعادة ${roomOps.length} قاعات، ${deptOps.length} أقسام، و${bookingOps.length} حجوزات من ملف النسخ الاحتياطي`,
    });

    showToast('تمت استعادة البيانات من النسخة الاحتياطية بنجاح');
    return {
      classroomsCount: roomOps.length,
      departmentsCount: deptOps.length,
      bookingsCount: bookingOps.length,
      accountsCount: restoredAccountsCount,
    };
  };

  if (!authReady) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex flex-col items-center justify-center gap-3" dir="rtl">
        <WorkspaceEmblem className="w-10 h-10" />
        <div className="text-sm font-medium text-[#444746]">جاري تهيئة المنظومة...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <AuthLanding
        onSignIn={handleSignIn}
        onCredentialsSignIn={handleCredentialsSignIn}
        authError={authError}
      />
    );
  }

  if (isUnverifiedBootstrappedAdmin) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white border border-[#DADCE0] rounded-2xl max-w-md w-full overflow-hidden g-elevation-2">
          <div className="h-[3px] w-full google-spectral-bar" />
          <div className="p-7 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#E8F0FE] border border-[#AECBFA] text-[#0B57D0] flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h1 className="font-display text-lg font-bold text-[#1F1F1F]">
              دخول الإدارة عبر حساب Google
            </h1>
            <p className="text-xs text-[#444746] leading-relaxed">
              للدخول إلى الحساب الرئيسي بصلاحيات المدير الكاملة بدون خطوات تحقق معقدة، يرجى الضغط على زر الدخول بحساب Google أدناه.
            </p>
            <div className="bg-[#F0F4F9] border border-[#DADCE0] rounded-xl px-3 py-2 text-xs font-mono-num text-[#1F1F1F]" dir="ltr">
              {user.email}
            </div>
            <div className="space-y-2.5 pt-1">
              <button
                type="button"
                onClick={() => void handleSignIn()}
                className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl border border-[#DADCE0] bg-white text-[#1F1F1F] text-xs font-semibold hover:bg-[#F8FAFD] hover:border-[#AECBFA] transition-colors cursor-pointer g-elevation-1"
              >
                <GoogleGLogo className="w-4 h-4 shrink-0" />
                <span>دخول الإدارة بحساب Google</span>
              </button>
              <button
                type="button"
                onClick={() => void signOutUser()}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-[#DADCE0] bg-white text-[#444746] text-xs font-semibold hover:bg-[#F0F4F9] transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>العودة إلى شاشة الدخول</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!myAccountResolved) {
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex flex-col items-center justify-center gap-3" dir="rtl">
        <WorkspaceEmblem className="w-10 h-10" />
        <div className="text-sm font-medium text-[#444746]">جاري التحقق من صلاحيات الحساب...</div>
      </div>
    );
  }

  if (access.isAccessBlocked) {
    const displayedIdentifier =
      user.email && isInternalAuthEmail(user.email)
        ? user.email.split('@')[0]
        : user.email;
    return (
      <div className="min-h-screen bg-[#F8FAFD] flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white border border-[#DADCE0] rounded-2xl max-w-md w-full overflow-hidden g-elevation-2">
          <div className="h-[3px] w-full google-spectral-bar" />
          <div className="p-7 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-[#FEF7E0] border border-[#FDE293] text-[#B06000] flex items-center justify-center mx-auto">
              <Ban className="w-6 h-6" />
            </div>
            <h1 className="font-display text-lg font-bold text-[#1F1F1F]">
              {access.isSuspended
                ? 'تم تعليق صلاحية هذا الحساب مؤقتاً'
                : accountLinkError === 'unlinked_or_mismatched'
                  ? 'الحساب غير مربوط بملف الصلاحيات'
                  : 'الحساب غير مضاف في سجل الصلاحيات'}
            </h1>
            <p className="text-xs text-[#444746] leading-relaxed">
              {access.isSuspended
                ? 'يرجى مراجعة إدارة قسم مجمع سيد الشهداء (ع) الخدمي لإعادة تفعيل الحساب.'
                : isPasswordUser
                  ? accountLinkError === 'unlinked_or_mismatched'
                    ? 'تم تسجيل الدخول بنجاح، ولكن وثيقة الحساب في سجل الصلاحيات غير مربوطة بمعرّف الدخول أو نوع المصادقة (credentials). يرجى مراجعة مدير المنظومة لتحديث ربط الحساب.'
                    : 'هذا اليوزر غير مضاف أو غير مربوط بحساب فعال في سجل الصلاحيات. يرجى مراجعة مدير المنظومة.'
                  : 'النظام مضبوط حالياً على وضع الدخول الحصري. يرجى تزويد مدير المنظومة ببريدك الإلكتروني لإضافتك ومنحك الصلاحية المناسبة.'}
            </p>
            {displayedIdentifier && (
              <div className="bg-[#F0F4F9] border border-[#DADCE0] rounded-xl px-3 py-2 text-xs font-mono-num text-[#1F1F1F]" dir="ltr">
                {displayedIdentifier}
              </div>
            )}
            <button
              type="button"
              onClick={() => void signOutUser()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-[#0B57D0] text-white text-xs font-semibold hover:bg-[#0842A0] transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const navItems: { id: ViewTab; label: string; icon: typeof CalendarDays; badge?: number }[] = [
    { id: 'schedule', label: 'الجدول الدراسي', icon: CalendarDays },
    ...(access.canViewBookingsTab
      ? [
          {
            id: 'bookings' as ViewTab,
            label: access.role === 'coordinator' ? 'حجوزات قسمي' : 'سجل الحجوزات',
            icon: ClipboardList,
            badge: metrics.scopedPendingCount > 0 ? metrics.scopedPendingCount : undefined,
          },
        ]
      : []),
    ...(access.canViewClassroomsTab
      ? [{ id: 'classrooms' as ViewTab, label: 'القاعات المجهزة', icon: Building2 }]
      : []),
    ...(access.canViewDepartmentsTab
      ? [{ id: 'departments' as ViewTab, label: 'الأقسام', icon: Layers }]
      : []),
    ...(access.canViewReports
      ? [{ id: 'reports' as ViewTab, label: 'التقارير الدورية', icon: FileBarChart2 }]
      : []),
    ...(access.canViewAuditLog
      ? [{ id: 'audit' as ViewTab, label: 'سجل العمليات', icon: History }]
      : []),
    ...(access.canManageAccounts
      ? [{ id: 'accounts' as ViewTab, label: 'الحسابات والصلاحيات', icon: ShieldCheck }]
      : []),
    ...(access.canManageSettings
      ? [{ id: 'settings' as ViewTab, label: 'الإعدادات والنسخ الاحتياطي', icon: SettingsIcon }]
      : []),
  ];

  const activeTabTitle =
    navItems.find((n) => n.id === activeTab)?.label || 'الجدول الدراسي';

  return (
    <div className="min-h-screen bg-[#F8FAFD] text-[#1F1F1F] flex flex-col" dir="rtl">
      {/* Top 3px Google Spectral Hairline */}
      <div className="h-[3px] w-full google-spectral-bar shrink-0 no-print" />

      <div className="flex-1 flex min-w-0">
        {/* Mobile Sidebar Overlay */}
        {mobileMenuOpen && (
          <div
            className="fixed inset-0 z-40 bg-[#1F1F1F]/40 backdrop-blur-[1px] lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Right Sidebar (Google Material 3 Navigation Drawer - 268px) */}
        <aside
          className={`fixed lg:static inset-y-0 right-0 z-50 w-[268px] shrink-0 bg-[#F0F4F9] border-l border-[#DADCE0] flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          <div>
            <div className="px-5 py-5 border-b border-[#DADCE0]/80 flex items-center justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0">
                <WorkspaceEmblem className="w-8 h-8 shrink-0" />
                <div className="min-w-0">
                  <div className="font-display text-sm font-bold text-[#1F1F1F] leading-snug truncate">
                    {systemSettings.organizationName}
                  </div>
                  <div className="text-[11px] text-[#444746] mt-0.5 truncate">
                    {systemSettings.complexSubtitle}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="lg:hidden p-1.5 rounded-lg text-[#444746] hover:bg-[#E9EEF6] cursor-pointer"
                aria-label="إغلاق القائمة"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <nav className="p-3 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setActiveTab(item.id);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-[13px] transition-colors whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-[#D3E3FD] text-[#041E49] font-semibold'
                        : 'text-[#444746] font-medium hover:bg-[#E9EEF6] hover:text-[#1F1F1F]'
                    }`}
                  >
                    <span className="flex items-center gap-2.5 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#0B57D0]' : 'text-[#444746]'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge !== undefined && (
                      <span className="font-mono-num text-xs font-bold text-[#B06000] shrink-0">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Account Footer */}
          <div className="p-3.5 border-t border-[#DADCE0]/80 space-y-2.5">
            <div className="bg-white border border-[#DADCE0] rounded-xl p-2.5 flex items-center gap-2.5">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'المستخدم'}
                  referrerPolicy="no-referrer"
                  className="w-9 h-9 rounded-lg object-cover border border-[#E8EAED] shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-[#0B57D0] text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {(user.displayName || 'م').slice(0, 1)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-[#1F1F1F] truncate">
                  {myAccountDoc?.displayName || user.displayName || 'مستخدم المنظومة'}
                </div>
                <div className="text-[11px] text-[#444746] truncate">
                  {ROLE_LABEL_AR[access.role]}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void signOutUser()}
              className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-[#DADCE0] bg-white text-xs font-medium text-[#444746] hover:bg-[#F8FAFD] hover:text-[#1F1F1F] transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 min-w-0 flex flex-col">
          {/* Top Header */}
          <header className="bg-white/95 backdrop-blur-sm border-b border-[#DADCE0] px-5 lg:px-8 py-3.5 flex items-center justify-between gap-4 sticky top-0 z-20 no-print">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                className="lg:hidden p-2 rounded-xl border border-[#DADCE0] text-[#444746] hover:bg-[#F0F4F9] cursor-pointer"
                aria-label="فتح القائمة"
              >
                <Menu className="w-4 h-4" />
              </button>
              <div className="flex items-center gap-2 text-sm truncate">
                <span className="hidden sm:inline text-[#444746] whitespace-nowrap">
                  {access.branchName}
                </span>
                <span className="hidden sm:inline text-[#DADCE0]" aria-hidden="true">
                  /
                </span>
                <h1 className="font-display text-base font-bold text-[#1F1F1F] whitespace-nowrap truncate">
                  {activeTabTitle}
                </h1>
              </div>
            </div>

            {access.canCreateBookings && (
              <button
                type="button"
                onClick={() => openNewBooking()}
                disabled={classrooms.length === 0}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-semibold hover:bg-[#0842A0] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer g-elevation-1"
              >
                <Plus className="w-4 h-4" />
                <span>حجز قاعة جديدة</span>
              </button>
            )}
          </header>

          <main className="flex-1 p-5 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6">
            {/* Summary KPI Strip + Scheduled Study Hours with Recharts Pie Charts */}
            <section
              className={`grid gap-4 no-print ${
                activeTab === 'schedule'
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-12'
                  : 'grid-cols-2 lg:grid-cols-4'
              }`}
            >
              <div
                className={`bg-white border border-[#DADCE0] rounded-2xl p-4 flex flex-col justify-between ${
                  activeTab === 'schedule' ? 'lg:col-span-4' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#444746]">القاعات الجاهزة للتشغيل</span>
                    <span className="w-2 h-2 rounded-sm bg-[#34A853] shrink-0" aria-hidden="true" />
                  </div>
                  <div className="font-mono-num text-2xl font-semibold text-[#1F1F1F] mt-1.5">
                    {metrics.availableRooms} / {metrics.totalRooms}
                  </div>
                </div>
                <div className="mt-2.5 space-y-1">
                  <div className="w-full h-1.5 bg-[#E8EAED] rounded-sm overflow-hidden">
                    <div
                      className="h-full bg-[#34A853]"
                      style={{ width: `${metrics.readinessPct}%` }}
                    />
                  </div>
                  <div className="text-[11px] text-[#747775]">
                    {metrics.maintenanceRooms > 0
                      ? `${metrics.maintenanceRooms} قيد الصيانة`
                      : 'جاهزية تشغيلية كاملة'}
                  </div>
                </div>
              </div>

              <div
                className={`bg-white border border-[#DADCE0] rounded-2xl p-4 flex flex-col justify-between ${
                  activeTab === 'schedule' ? 'lg:col-span-4' : ''
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-[#444746]">حجوزات اليوم المحدد</span>
                    <span className="w-2 h-2 rounded-sm bg-[#4285F4] shrink-0" aria-hidden="true" />
                  </div>
                  <div className="font-mono-num text-2xl font-semibold text-[#1F1F1F] mt-1.5">
                    {metrics.todayCount}
                  </div>
                </div>
                <div className="mt-2.5 text-[11px] text-[#747775] truncate">
                  {formatShortArabicDate(selectedDate)} · مؤكد{' '}
                  <span className="font-mono-num font-semibold text-[#1F1F1F]">
                    {metrics.todayConfirmedCount}
                  </span>
                </div>
              </div>

              {access.canViewBookingsTab ? (
                <button
                  type="button"
                  onClick={() => {
                    setBookingsStatusFilter('pending');
                    setActiveTab('bookings');
                  }}
                  className={`bg-white border border-[#DADCE0] rounded-2xl p-4 text-right hover:border-[#FDE293] hover:bg-[#FEF7E0]/30 transition-colors cursor-pointer flex flex-col justify-between ${
                    activeTab === 'schedule' ? 'sm:col-span-2 lg:col-span-4' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#444746]">
                        {access.role === 'coordinator'
                          ? 'طلبات قسمي المعلقة'
                          : 'طلبات بانتظار موافقة الإدارة'}
                      </span>
                      <span className="w-2 h-2 rounded-sm bg-[#FBBC04] shrink-0" aria-hidden="true" />
                    </div>
                    <div className="font-mono-num text-2xl font-semibold text-[#B06000] mt-1.5">
                      {metrics.scopedPendingCount}
                    </div>
                  </div>
                  <div className="mt-2.5 text-[11px] text-[#747775]">
                    {metrics.scopedPendingCount > 0
                      ? 'اضغط لمراجعة الطلبات المعلقة'
                      : 'لا توجد طلبات معلقة حالياً'}
                  </div>
                </button>
              ) : (
                <div
                  className={`bg-white border border-[#DADCE0] rounded-2xl p-4 flex flex-col justify-between ${
                    activeTab === 'schedule' ? 'sm:col-span-2 lg:col-span-4' : ''
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#444746]">الحجوزات المؤكدة اليوم</span>
                      <span className="w-2 h-2 rounded-sm bg-[#34A853] shrink-0" aria-hidden="true" />
                    </div>
                    <div className="font-mono-num text-2xl font-semibold text-[#137333] mt-1.5">
                      {metrics.todayConfirmedCount}
                    </div>
                  </div>
                  <div className="mt-2.5 text-[11px] text-[#747775]">
                    من أصل{' '}
                    <span className="font-mono-num font-semibold text-[#1F1F1F]">
                      {metrics.todayCount}
                    </span>{' '}
                    حجزاً فعالاً
                  </div>
                </div>
              )}

              <ScheduledHoursCard
                selectedDate={selectedDate}
                scheduledHours={metrics.scheduledHours}
                dailyOperatingHours={metrics.dailyOperatingHours}
                availableRoomsCount={metrics.availableRooms}
                overallOccupancyPct={metrics.overallOccupancyPct}
                rooms={metrics.roomOccupancyList}
                isLoading={loadingRooms || loadingBookings}
                canQuickBook={access.canCreateBookings}
                onQuickBookRoom={(roomId) =>
                  openNewBooking(roomId, selectedDate, '09:00', '11:00')
                }
                compact={activeTab !== 'schedule'}
              />
            </section>

          {/* Active Workspace View */}
          {activeTab === 'schedule' && (
            <ScheduleGrid
              classrooms={classrooms}
              bookings={bookings}
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              onQuickBook={(roomId, date, startTime, endTime) =>
                openNewBooking(roomId, date, startTime, endTime)
              }
              onSelectBooking={(b) => setInspectedBooking(b)}
              isLoading={loadingRooms || loadingBookings}
              canQuickBook={access.canCreateBookings}
              workStartHour={systemSettings.workStartHour}
              workEndHour={systemSettings.workEndHour}
              reportHeaderTitle={systemSettings.reportHeaderTitle}
              organizationName={systemSettings.organizationName}
              reportFooterNote={systemSettings.reportFooterNote}
            />
          )}

          {activeTab === 'bookings' && access.canViewBookingsTab && (
            <BookingsTableView
              bookings={
                access.role === 'coordinator'
                  ? coordinatorVisibleBookings
                  : bookings
              }
              classrooms={classrooms}
              currentUserId={user.uid}
              isAdmin={access.canApproveBookings}
              canApprove={access.canApproveBookings}
              canManageAll={access.canManageBookings}
              canCreate={access.canCreateBookings}
              scopedDepartmentName={
                access.role === 'coordinator' ? access.branchName : undefined
              }
              isLoading={loadingBookings}
              statusFilter={bookingsStatusFilter}
              onStatusFilterChange={setBookingsStatusFilter}
              onCreateNew={() => openNewBooking()}
              onEdit={openEditBooking}
              onApprove={handleApproveBooking}
              onReject={handleRejectBooking}
              onCancel={handleCancelBooking}
              onDelete={handleDeleteBooking}
            />
          )}

          {activeTab === 'classrooms' && access.canViewClassroomsTab && (
            <ClassroomsView
              classrooms={classrooms}
              bookings={bookings}
              isAdmin={access.canManageClassrooms}
              canBook={access.canCreateBookings}
              isLoading={loadingRooms}
              onAddClassroom={openAddClassroom}
              onEditClassroom={openEditClassroom}
              onToggleMaintenance={handleToggleMaintenance}
              onDeleteClassroom={handleDeleteClassroom}
              onBookRoom={(roomId) => {
                setActiveTab('schedule');
                openNewBooking(roomId, selectedDate, '09:00', '11:00');
              }}
              onSeedDefaults={seedDefaultWorkspace}
            />
          )}

          {activeTab === 'departments' && access.canViewDepartmentsTab && (
            <DepartmentsView
              departments={departments}
              bookings={bookings}
              isAdmin={access.canManageDepartments}
              canBook={access.canCreateBookings}
              isLoading={loadingDepartments}
              onAddDepartment={openAddDepartment}
              onEditDepartment={openEditDepartment}
              onToggleStatus={handleToggleDepartmentStatus}
              onDeleteDepartment={handleDeleteDepartment}
              onBookForDepartment={(deptName) =>
                openNewBooking(undefined, selectedDate, '09:00', '11:00', deptName)
              }
              onSeedDefaults={seedDefaultDepartments}
              coordinatorBranchNames={
                access.canManageAccounts
                  ? new Set(
                      accounts
                        .filter((a) => a.role === 'coordinator')
                        .map((a) => a.branchName.trim())
                    )
                  : undefined
              }
              onCreateCoordinator={
                access.canManageAccounts ? openCreateCoordinatorForDept : undefined
              }
            />
          )}

          {activeTab === 'reports' && access.canViewReports && (
            <ReportsView
              bookings={bookings}
              classrooms={classrooms}
              settings={systemSettings}
            />
          )}

          {activeTab === 'audit' && access.canViewAuditLog && (
            <AuditLogView
              logs={auditLogs}
              isLoading={loadingAuditLogs}
              canViewAdminCategories={
                access.isBootstrappedAdmin || access.canManageAccounts || access.canManageSettings
              }
              settings={systemSettings}
            />
          )}

          {activeTab === 'accounts' && access.canManageAccounts && (
            <AccountsView
              accounts={accounts}
              departments={departments}
              bookings={bookings}
              isLoading={loadingAccounts}
              lastCreatedCredentials={lastCreatedCredentials}
              onDismissCreatedCredentials={() => setLastCreatedCredentials(null)}
              batchCreatedCredentials={batchCreatedCredentials}
              onDismissBatchCreated={() => setBatchCreatedCredentials(null)}
              onAddAccount={openAddAccount}
              onCreateUnifiedViewer={openUnifiedViewerAccount}
              onCreateCoordinatorForDept={openCreateCoordinatorForDept}
              onBatchCreateCoordinators={handleBatchCreateCoordinators}
              onEditAccount={openEditAccount}
              onToggleStatus={handleToggleAccountStatus}
              onDeleteAccount={handleDeleteAccount}
            />
          )}

          {activeTab === 'settings' && access.canManageSettings && (
            <SettingsView
              settings={systemSettings}
              classrooms={classrooms}
              departments={departments}
              bookings={bookings}
              accounts={accounts}
              canManageAccounts={access.canManageAccounts}
              onSaveSettings={persistSettingsDoc}
              onRecordBackup={handleRecordBackup}
              onRestoreBackup={handleRestoreBackup}
            />
          )}
          </main>
        </div>
      </div>

      {/* Booking Inspection Quick Modal */}
      {inspectedBooking && (
        <div
          className="fixed inset-0 z-50 bg-[#1F1F1F]/45 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-[#DADCE0] rounded-2xl max-w-lg w-full overflow-hidden g-elevation-modal">
            <div className="px-6 py-4 border-b border-[#E8EAED] bg-[#F8FAFD] flex items-center justify-between">
              <div>
                <div className="text-xs text-[#444746]">
                  {inspectedBooking.roomName} · {BOOKING_TYPE_LABEL[inspectedBooking.bookingType]}
                </div>
                <h3 className="font-display text-base font-bold text-[#1F1F1F] mt-0.5">
                  {inspectedBooking.courseTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedBooking(null)}
                className="p-2 rounded-xl text-[#444746] hover:bg-[#E9EEF6] hover:text-[#1F1F1F] transition-colors cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-[#747775]">التاريخ</div>
                  <div className="font-medium text-[#1F1F1F] mt-0.5">
                    {formatArabicDate(inspectedBooking.date)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#747775]">الفترة الزمنية</div>
                  <div className="font-mono-num font-medium text-[#1F1F1F] mt-0.5">
                    {formatTime12Ar(inspectedBooking.startTime)} –{' '}
                    {formatTime12Ar(inspectedBooking.endTime)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#747775]">المحاضر / الأستاذ</div>
                  <div className="font-medium text-[#1F1F1F] mt-0.5">
                    {inspectedBooking.instructorName}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#747775]">الجهة المستفيدة</div>
                  <div className="font-medium text-[#1F1F1F] mt-0.5">
                    {inspectedBooking.department}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#747775]">عدد الطلاب</div>
                  <div className="font-mono-num font-medium text-[#1F1F1F] mt-0.5 inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#747775]" />
                    {inspectedBooking.attendeesCount} طالب
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[#747775]">حالة الحجز</div>
                  <div className="mt-0.5">
                    {inspectedBooking.status === 'confirmed' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#137333]">
                        <CheckCircle2 className="w-4 h-4" />
                        {BOOKING_STATUS_LABEL.confirmed}
                      </span>
                    )}
                    {inspectedBooking.status === 'pending' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#B06000]">
                        <Clock className="w-4 h-4" />
                        {BOOKING_STATUS_LABEL.pending}
                      </span>
                    )}
                    {inspectedBooking.status === 'rejected' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#C5221F]">
                        <Ban className="w-4 h-4" />
                        {BOOKING_STATUS_LABEL.rejected}
                      </span>
                    )}
                    {inspectedBooking.status === 'cancelled' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#747775]">
                        <XCircle className="w-4 h-4" />
                        {BOOKING_STATUS_LABEL.cancelled}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {inspectedBooking.notes && (
                <div className="pt-3 border-t border-[#E8EAED]">
                  <div className="text-xs text-[#747775] mb-1">ملاحظات وتجهيزات</div>
                  <p className="text-xs text-[#444746] leading-relaxed">
                    {inspectedBooking.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-[#F8FAFD] border-t border-[#E8EAED] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {(access.canApproveBookings ||
                  access.canManageBookings ||
                  (access.canCreateBookings &&
                    inspectedBooking.creatorId === user.uid &&
                    inspectedBooking.status === 'pending')) && (
                  <button
                    type="button"
                    onClick={() => openEditBooking(inspectedBooking)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DADCE0] bg-white text-xs font-medium text-[#1F1F1F] hover:bg-[#F0F4F9] transition-colors cursor-pointer"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                    <span>تعديل</span>
                  </button>
                )}

                {(inspectedBooking.status === 'pending' ||
                  inspectedBooking.status === 'confirmed') &&
                  (access.canApproveBookings ||
                    access.canManageBookings ||
                    (access.canCreateBookings &&
                      inspectedBooking.creatorId === user.uid)) && (
                    <button
                      type="button"
                      onClick={() => void handleCancelBooking(inspectedBooking)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#FDE293] bg-white text-xs font-medium text-[#B06000] hover:bg-[#FEF7E0] transition-colors cursor-pointer"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>إلغاء الحجز</span>
                    </button>
                  )}

                {(access.canApproveBookings ||
                  access.canManageBookings ||
                  (access.canCreateBookings &&
                    inspectedBooking.creatorId === user.uid &&
                    inspectedBooking.status === 'pending')) && (
                  <button
                    type="button"
                    onClick={() => void handleDeleteBooking(inspectedBooking)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#F6AEA9] bg-white text-xs font-medium text-[#C5221F] hover:bg-[#FCE8E6] transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>حذف</span>
                  </button>
                )}
              </div>

              {access.canApproveBookings && inspectedBooking.status === 'pending' && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleRejectBooking(inspectedBooking)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl border border-[#F6AEA9] bg-white text-[#C5221F] text-xs font-semibold hover:bg-[#FCE8E6] transition-colors cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>رفض الطلب</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApproveBooking(inspectedBooking)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#0B57D0] text-white text-xs font-semibold hover:bg-[#0842A0] transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>موافقة وتثبيت</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Booking Form Modal */}
      {access.canCreateBookings && (
        <BookingModal
          isOpen={bookingModalOpen}
          onClose={() => setBookingModalOpen(false)}
          onSave={handleSaveBooking}
          classrooms={classrooms}
          departments={departments}
          existingBookings={bookings}
          initialDraft={bookingDraft}
          isAdmin={access.canApproveBookings}
          coordinatorDepartment={
            access.role === 'coordinator' && access.branchName.trim().length >= 2
              ? access.branchName.trim()
              : undefined
          }
          allowWeekendBookings={systemSettings.allowWeekendBookings}
          maxAdvanceDays={systemSettings.maxAdvanceDays}
        />
      )}

      {/* Classroom Form Modal */}
      {access.canManageClassrooms && (
        <ClassroomModal
          isOpen={classroomModalOpen}
          onClose={() => setClassroomModalOpen(false)}
          onSave={handleSaveClassroom}
          initialDraft={classroomDraft}
        />
      )}

      {/* Department Form Modal */}
      {access.canManageDepartments && (
        <DepartmentModal
          isOpen={departmentModalOpen}
          onClose={() => setDepartmentModalOpen(false)}
          onSave={handleSaveDepartment}
          initialDraft={departmentDraft}
        />
      )}

      {/* Account Form Modal */}
      {access.canManageAccounts && (
        <AccountModal
          isOpen={accountModalOpen}
          onClose={() => setAccountModalOpen(false)}
          onSave={handleSaveAccount}
          initialDraft={accountDraft}
          departments={departments}
        />
      )}

      {/* Material Design Snackbar Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 left-5 z-50 bg-[#1F1F1F] text-white text-xs font-medium px-4 py-3 rounded-xl g-elevation-modal border border-[#444746]/40"
        >
          {toastMessage}
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <DashboardWorkspace />
    </ErrorBoundary>
  );
}
