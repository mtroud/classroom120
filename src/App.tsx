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
import { AccountsView } from './components/AccountsView';
import { AuditLogView } from './components/AuditLogView';
import { AuthLanding } from './components/AuthLanding';
import { BookingDraft, BookingModal } from './components/BookingModal';
import { BookingsTableView } from './components/BookingsTableView';
import { ClassroomDraft, ClassroomModal } from './components/ClassroomModal';
import { ClassroomsView } from './components/ClassroomsView';
import { DepartmentDraft, DepartmentModal } from './components/DepartmentModal';
import { DepartmentsView } from './components/DepartmentsView';
import { ErrorBoundary } from './components/ErrorBoundary';
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
  handleFirestoreError,
  signInWithGoogle,
  signOutUser,
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
  resolveEffectiveAccess,
} from './utils/permissions';
import {
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  calculateDurationHours,
  formatArabicDate,
  formatTime12Ar,
  getTodayISO,
  isActiveBooking,
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

  const access = useMemo(
    () =>
      resolveEffectiveAccess({
        email: user?.email,
        emailVerified: user?.emailVerified,
        hasAdminsDoc,
        account: myAccountDoc,
        settings: systemSettings,
      }),
    [user, hasAdminsDoc, myAccountDoc, systemSettings]
  );

  // Auth listener & user profile provisioning
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      setAuthReady(true);

      if (!firebaseUser) {
        setHasAdminsDoc(false);
        setMyAccountDoc(null);
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

      const bootstrapped =
        firebaseUser.emailVerified &&
        firebaseUser.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

      let adminFlag = false;
      if (!bootstrapped) {
        try {
          const adminSnap = await getDoc(doc(db, 'admins', firebaseUser.uid));
          adminFlag = adminSnap.exists();
        } catch {
          adminFlag = false;
        }
      }
      setHasAdminsDoc(adminFlag);

      // Ensure private profile exists without self-assigning admin role
      const profileRef = doc(db, 'users', firebaseUser.uid, 'private', 'info');
      try {
        const existingSnap = await getDoc(profileRef);
        if (!existingSnap.exists()) {
          await setDoc(profileRef, {
            uid: firebaseUser.uid,
            email: (firebaseUser.email || '').slice(0, 160),
            displayName: (firebaseUser.displayName || 'مستخدم').slice(0, 80),
            photoURL: (firebaseUser.photoURL || '').slice(0, 300),
            department: 'قسم مجمع سيد الشهداء (ع) الخدمي',
            role: bootstrapped || adminFlag ? 'admin' : 'coordinator',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (err) {
        handleFirestoreError(
          err,
          OperationType.WRITE,
          `users/${firebaseUser.uid}/private/info`
        );
      }
    });

    return () => unsubscribe();
  }, []);

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

    setLoadingRooms(true);
    setLoadingDepartments(true);
    setLoadingBookings(true);
    setLoadingAuditLogs(true);

    const isBootstrapped =
      Boolean(user.emailVerified) &&
      user.email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

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
    if (user.email && user.emailVerified) {
      const myAccId = emailToAccountId(user.email);
      unsubMyAccount = onSnapshot(
        doc(db, 'accounts', myAccId),
        (snapshot) => {
          if (snapshot.exists()) {
            setMyAccountDoc({
              ...(snapshot.data() as AccountRecord),
              id: snapshot.id,
            });
          } else {
            setMyAccountDoc(null);
          }
        },
        () => {
          setMyAccountDoc(null);
        }
      );
    } else {
      setMyAccountDoc(null);
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
      if (!user || !user.emailVerified || access.isSuspended || access.role === 'viewer') {
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
    [user, access, myAccountDoc, systemSettings.organizationName]
  );

  const handleSignIn = async () => {
    setAuthError(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? `تعذر تسجيل الدخول: ${err.message}`
          : 'حدث خطأ أثناء تسجيل الدخول.'
      );
    }
  };

  // KPI metrics for selectedDate
  const metrics = useMemo(() => {
    const availableRooms = classrooms.filter((r) => r.status === 'available').length;
    const todayActive = bookings.filter(
      (b) => b.date === selectedDate && isActiveBooking(b)
    );
    const pendingCount = bookings.filter((b) => b.status === 'pending').length;
    const scheduledHours = todayActive.reduce(
      (sum, b) => sum + calculateDurationHours(b.startTime, b.endTime),
      0
    );
    return {
      availableRooms,
      totalRooms: classrooms.length,
      todayCount: todayActive.length,
      pendingCount,
      scheduledHours: Math.round(scheduledHours * 10) / 10,
    };
  }, [classrooms, bookings, selectedDate]);

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
    const defaultDept =
      departmentName ||
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
    if (!user || !access.canCreateBookings) return;
    const targetRoom = classrooms.find((r) => r.id === draft.roomId);
    if (!targetRoom) {
      throw new Error('القاعة المحددة غير موجودة.');
    }

    if (draft.id) {
      const path = `bookings/${draft.id}`;
      try {
        const updatePayload: Record<string, unknown> = {
          roomId: targetRoom.id,
          roomName: targetRoom.name.slice(0, BLUEPRINT_LIMITS.ROOM_NAME_MAX),
          courseTitle: draft.courseTitle,
          instructorName: draft.instructorName,
          department: draft.department,
          bookingType: draft.bookingType,
          date: draft.date,
          startTime: draft.startTime,
          endTime: draft.endTime,
          attendeesCount: Math.trunc(draft.attendeesCount),
          notes: draft.notes,
          updatedAt: serverTimestamp(),
        };
        if (access.canApproveBookings) {
          updatePayload.status = draft.status;
        }
        await updateDoc(doc(db, 'bookings', draft.id), updatePayload);
        void recordAuditLog({
          entityType: 'booking',
          entityId: draft.id,
          entityLabel: `${targetRoom.name} — ${draft.courseTitle}`,
          action: 'update',
          summary: `تعديل حجز ${draft.department} (${draft.date} من ${draft.startTime} إلى ${draft.endTime})`,
        });
        showToast('تم تحديث الحجز في الجدول الدراسي');
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, path);
      }
    } else {
      const newId = generateSafeId('bk');
      const path = `bookings/${newId}`;
      const nextStatus = access.canApproveBookings ? draft.status : 'pending';
      try {
        await setDoc(doc(db, 'bookings', newId), {
          id: newId,
          roomId: targetRoom.id,
          roomName: targetRoom.name.slice(0, BLUEPRINT_LIMITS.ROOM_NAME_MAX),
          courseTitle: draft.courseTitle,
          instructorName: draft.instructorName,
          department: draft.department,
          bookingType: draft.bookingType,
          date: draft.date,
          startTime: draft.startTime,
          endTime: draft.endTime,
          attendeesCount: Math.trunc(draft.attendeesCount),
          status: nextStatus,
          notes: draft.notes,
          creatorId: user.uid,
          creatorName: (user.displayName || 'مستخدم').slice(0, 80),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        void recordAuditLog({
          entityType: 'booking',
          entityId: newId,
          entityLabel: `${targetRoom.name} — ${draft.courseTitle}`,
          action: 'create',
          summary: `حجز جديد لقسم ${draft.department} (${draft.date} من ${draft.startTime} إلى ${draft.endTime}) · ${BOOKING_STATUS_LABEL[nextStatus]}`,
        });
        showToast(
          access.canApproveBookings
            ? 'تم تثبيت الحجز في الجدول الدراسي'
            : 'تم إرسال طلب الحجز بنجاح'
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.CREATE, path);
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
      displayName: '',
      branchName: '',
      role: 'branch_supervisor',
      status: 'active',
      permissions: defaultPermissionsForRole('branch_supervisor'),
      notes: '',
    });
    setAccountModalOpen(true);
  };

  const openEditAccount = (acc: AccountRecord) => {
    setAccountDraft({
      id: acc.id,
      email: acc.email,
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
        await updateDoc(doc(db, 'accounts', accId), {
          email: draft.email,
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
      try {
        await setDoc(doc(db, 'accounts', accId), {
          id: accId,
          email: draft.email,
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
          summary: `إضافة حساب جديد بصلاحية ${ROLE_LABEL_AR[draft.role]}`,
        });
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center" dir="rtl">
        <div className="text-sm font-medium text-slate-600">جاري تهيئة المنظومة...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthLanding onSignIn={handleSignIn} authError={authError} />;
  }

  if (access.isAccessBlocked) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
        <div className="bg-white border border-slate-200 rounded-xl max-w-md w-full p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mx-auto">
            <Ban className="w-6 h-6" />
          </div>
          <h1 className="font-display text-lg font-bold text-slate-900">
            {access.isSuspended
              ? 'تم تعليق صلاحية هذا الحساب مؤقتاً'
              : 'الحساب غير مضاف في سجل الصلاحيات'}
          </h1>
          <p className="text-xs text-slate-600 leading-relaxed">
            {access.isSuspended
              ? 'يرجى مراجعة إدارة قسم مجمع سيد الشهداء (ع) الخدمي لإعادة تفعيل الحساب.'
              : 'النظام مضبوط حالياً على وضع الدخول الحصري. يرجى تزويد مدير المنظومة ببريدك الإلكتروني لإضافتك ومنحك الصلاحية المناسبة.'}
          </p>
          {user.email && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs font-mono-num text-slate-800">
              {user.email}
            </div>
          )}
          <button
            type="button"
            onClick={() => void signOutUser()}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </div>
    );
  }

  const navItems: { id: ViewTab; label: string; icon: typeof CalendarDays; badge?: number }[] = [
    { id: 'schedule', label: 'الجدول الدراسي', icon: CalendarDays },
    {
      id: 'bookings',
      label: 'سجل الحجوزات',
      icon: ClipboardList,
      badge: metrics.pendingCount > 0 ? metrics.pendingCount : undefined,
    },
    { id: 'classrooms', label: 'القاعات المجهزة', icon: Building2 },
    { id: 'departments', label: 'الأقسام', icon: Layers },
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
    <div className="min-h-screen bg-slate-50 text-slate-900 flex" dir="rtl">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Right Sidebar (260px) */}
      <aside
        className={`fixed lg:static inset-y-0 right-0 z-50 w-[260px] shrink-0 bg-white border-l border-slate-200 flex flex-col justify-between transition-transform duration-200 lg:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div>
          <div className="px-5 py-5 border-b border-slate-200 flex items-center justify-between">
            <div>
              <div className="font-display text-base font-bold text-slate-900 leading-snug">
                {systemSettings.organizationName}
              </div>
              <div className="text-xs text-slate-500 mt-0.5">
                {systemSettings.complexSubtitle}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="lg:hidden p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
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
                  className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-teal-50 text-teal-900'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon
                      className={`w-4 h-4 ${
                        isActive ? 'text-teal-700' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </span>
                  {item.badge !== undefined && (
                    <span className="font-mono-num text-xs font-semibold text-amber-700">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Account Footer */}
        <div className="p-4 border-t border-slate-200 space-y-3">
          <div className="flex items-center gap-3">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.displayName || 'المستخدم'}
                referrerPolicy="no-referrer"
                className="w-9 h-9 rounded-lg object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-teal-700 text-white flex items-center justify-center text-xs font-bold shrink-0">
                {(user.displayName || 'م').slice(0, 1)}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-slate-900 truncate">
                {myAccountDoc?.displayName || user.displayName || 'مستخدم المنظومة'}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {ROLE_LABEL_AR[access.role]}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => void signOutUser()}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>تسجيل الخروج</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-5 lg:px-8 py-3.5 flex items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
              aria-label="فتح القائمة"
            >
              <Menu className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2 text-sm truncate">
              <span className="hidden sm:inline text-slate-500 whitespace-nowrap">
                {access.branchName}
              </span>
              <span className="hidden sm:inline text-slate-300" aria-hidden="true">
                /
              </span>
              <h1 className="font-display text-base font-bold text-slate-900 whitespace-nowrap truncate">
                {activeTabTitle}
              </h1>
            </div>
          </div>

          {access.canCreateBookings && (
            <button
              type="button"
              onClick={() => openNewBooking()}
              disabled={classrooms.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>حجز قاعة جديدة</span>
            </button>
          )}
        </header>

        <main className="flex-1 p-5 lg:p-8 max-w-[1440px] w-full mx-auto space-y-6">
          {/* 4-column Summary KPI Strip */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">القاعات الجاهزة للتشغيل</div>
              <div className="font-mono-num text-2xl font-semibold text-slate-900 mt-1">
                {metrics.availableRooms} / {metrics.totalRooms}
              </div>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">حجوزات اليوم المحدد</div>
              <div className="font-mono-num text-2xl font-semibold text-slate-900 mt-1">
                {metrics.todayCount}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setBookingsStatusFilter('pending');
                setActiveTab('bookings');
              }}
              className="bg-white border border-slate-200 rounded-xl p-4 text-right hover:border-amber-300 transition-colors cursor-pointer"
            >
              <div className="text-xs text-slate-500">طلبات بانتظار موافقة الإدارة</div>
              <div className="font-mono-num text-2xl font-semibold text-amber-700 mt-1">
                {metrics.pendingCount}
              </div>
            </button>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="text-xs text-slate-500">ساعات الدراسة المجدولة</div>
              <div className="font-mono-num text-2xl font-semibold text-teal-800 mt-1">
                {metrics.scheduledHours} س
              </div>
            </div>
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
            />
          )}

          {activeTab === 'bookings' && (
            <BookingsTableView
              bookings={bookings}
              classrooms={classrooms}
              currentUserId={user.uid}
              isAdmin={access.canApproveBookings}
              canApprove={access.canApproveBookings}
              canManageAll={access.canManageBookings}
              canCreate={access.canCreateBookings}
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

          {activeTab === 'classrooms' && (
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

          {activeTab === 'departments' && (
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
              isLoading={loadingAccounts}
              onAddAccount={openAddAccount}
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

      {/* Booking Inspection Quick Modal */}
      {inspectedBooking && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500">
                  {inspectedBooking.roomName} · {BOOKING_TYPE_LABEL[inspectedBooking.bookingType]}
                </div>
                <h3 className="font-display text-base font-bold text-slate-900 mt-0.5">
                  {inspectedBooking.courseTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setInspectedBooking(null)}
                className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-900 cursor-pointer"
                aria-label="إغلاق"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs text-slate-500">التاريخ</div>
                  <div className="font-medium text-slate-900 mt-0.5">
                    {formatArabicDate(inspectedBooking.date)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">الفترة الزمنية</div>
                  <div className="font-mono-num font-medium text-slate-900 mt-0.5">
                    {formatTime12Ar(inspectedBooking.startTime)} –{' '}
                    {formatTime12Ar(inspectedBooking.endTime)}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">المحاضر / الأستاذ</div>
                  <div className="font-medium text-slate-900 mt-0.5">
                    {inspectedBooking.instructorName}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">الجهة المستفيدة</div>
                  <div className="font-medium text-slate-900 mt-0.5">
                    {inspectedBooking.department}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">عدد الطلاب</div>
                  <div className="font-mono-num font-medium text-slate-900 mt-0.5 inline-flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-slate-400" />
                    {inspectedBooking.attendeesCount} طالب
                  </div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">حالة الحجز</div>
                  <div className="mt-0.5">
                    {inspectedBooking.status === 'confirmed' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="w-4 h-4" />
                        {BOOKING_STATUS_LABEL.confirmed}
                      </span>
                    )}
                    {inspectedBooking.status === 'pending' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                        <Clock className="w-4 h-4" />
                        {BOOKING_STATUS_LABEL.pending}
                      </span>
                    )}
                    {inspectedBooking.status === 'rejected' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                        <Ban className="w-4 h-4" />
                        {BOOKING_STATUS_LABEL.rejected}
                      </span>
                    )}
                    {inspectedBooking.status === 'cancelled' && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                        <XCircle className="w-4 h-4" />
                        {BOOKING_STATUS_LABEL.cancelled}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {inspectedBooking.notes && (
                <div className="pt-3 border-t border-slate-100">
                  <div className="text-xs text-slate-500 mb-1">ملاحظات وتجهيزات</div>
                  <p className="text-xs text-slate-700 leading-relaxed">
                    {inspectedBooking.notes}
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {(access.canApproveBookings ||
                  access.canManageBookings ||
                  (access.canCreateBookings &&
                    inspectedBooking.creatorId === user.uid &&
                    inspectedBooking.status === 'pending')) && (
                  <button
                    type="button"
                    onClick={() => openEditBooking(inspectedBooking)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
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
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-amber-200 bg-white text-xs font-medium text-amber-800 hover:bg-amber-50 cursor-pointer"
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-white text-xs font-medium text-red-700 hover:bg-red-50 cursor-pointer"
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
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg border border-red-200 bg-white text-red-700 text-xs font-semibold hover:bg-red-50 cursor-pointer"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>رفض الطلب</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleApproveBooking(inspectedBooking)}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 cursor-pointer"
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

      {/* Transient Notification */}
      {toastMessage && (
        <div
          role="status"
          className="fixed bottom-5 left-5 z-50 bg-slate-900 text-white text-xs font-medium px-4 py-3 rounded-lg shadow-lg border border-slate-800"
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
