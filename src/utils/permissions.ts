import {
  AccountPermissions,
  AccountRecord,
  BOOTSTRAPPED_ADMIN_EMAIL,
  SystemSettings,
  UserRole,
} from '../types';

export const INTERNAL_AUTH_DOMAIN = 'shuhada-complex.app';

export function emailToAccountId(email: string): string {
  return email
    .trim()
    .toLowerCase()
    .replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isValidUsername(username: string): boolean {
  return /^[a-z0-9._-]{3,40}$/.test(normalizeUsername(username));
}

export function usernameToAuthEmail(identifier: string): string {
  const clean = identifier.trim().toLowerCase();
  if (!clean) return '';
  if (clean.includes('@')) return clean;
  return `${clean}@${INTERNAL_AUTH_DOMAIN}`;
}

export function isInternalAuthEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${INTERNAL_AUTH_DOMAIN}`);
}

export function formatAccountLoginIdentifier(
  acc: Pick<AccountRecord, 'email' | 'username' | 'authType'>
): string {
  if (acc.username && acc.username.trim()) return acc.username.trim();
  if (isInternalAuthEmail(acc.email)) return acc.email.split('@')[0];
  return acc.email;
}

export function generateReadablePassword(length = 10): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#';
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => charset[b % charset.length]).join('');
}

export const ROLE_LABEL_AR: Record<UserRole, string> = {
  admin: 'مدير النظام الأعلى',
  branch_supervisor: 'مسؤول شعبة في المجمع',
  coordinator: 'منسق حجز قسم',
  viewer: 'منتسب (اطلاع على الجدول)',
};

export const PERMISSION_ITEMS: {
  key: keyof AccountPermissions;
  label: string;
  description: string;
}[] = [
  {
    key: 'approveBookings',
    label: 'الموافقة على الطلبات',
    description: 'اعتماد طلبات الحجز المعلقة أو رفضها وتثبيتها بالجدول',
  },
  {
    key: 'manageBookings',
    label: 'إدارة الجدول والحجوزات',
    description: 'تعديل الحجوزات القائمة أو إلغاؤها أو حذفها',
  },
  {
    key: 'manageClassrooms',
    label: 'إدارة القاعات المجهزة',
    description: 'إضافة وتعديل القاعات وتغيير حالتها للصيانة',
  },
  {
    key: 'manageDepartments',
    label: 'إدارة الأقسام والشعب',
    description: 'إضافة وتعديل وتفعيل أقسام العتبة الحسينية المقدسة',
  },
  {
    key: 'viewReports',
    label: 'التقارير الدورية',
    description: 'استعراض وطباعة وتصدير التقارير الأسبوعية والشهرية والسنوية',
  },
  {
    key: 'manageSettings',
    label: 'الإعدادات والنسخ الاحتياطي',
    description: 'تعديل سياسات التشغيل وتصدير واستعادة النسخ الاحتياطية',
  },
];

export function defaultPermissionsForRole(role: UserRole): AccountPermissions {
  if (role === 'admin') {
    return {
      approveBookings: true,
      manageBookings: true,
      manageClassrooms: true,
      manageDepartments: true,
      viewReports: true,
      manageSettings: true,
    };
  }
  if (role === 'branch_supervisor') {
    return {
      approveBookings: true,
      manageBookings: true,
      manageClassrooms: false,
      manageDepartments: false,
      viewReports: true,
      manageSettings: false,
    };
  }
  if (role === 'viewer') {
    return {
      approveBookings: false,
      manageBookings: false,
      manageClassrooms: false,
      manageDepartments: false,
      viewReports: false,
      manageSettings: false,
    };
  }
  return {
    approveBookings: false,
    manageBookings: false,
    manageClassrooms: false,
    manageDepartments: false,
    viewReports: true,
    manageSettings: false,
  };
}

export const COMPLEX_BRANCH_SUGGESTIONS = [
  'إدارة قسم مجمع سيد الشهداء (ع) الخدمي',
  'شعبة إدارة القاعات والتنسيق العلمي',
  'شعبة المتابعة والتخطيط',
  'شعبة التجهيزات الفنية والصيانة',
  'شعبة العلاقات والإعلام',
  'الوحدة الإدارية والخدمات',
] as const;

export const DEFAULT_SYSTEM_SETTINGS: SystemSettings = {
  id: 'system',
  organizationName: 'قسم مجمع سيد الشهداء (ع) الخدمي',
  complexSubtitle: 'إدارة القاعات الدراسية والجدول الدراسي',
  workStartHour: '08:00',
  workEndHour: '21:00',
  maxAdvanceDays: 90,
  requireAdminApproval: true,
  allowWeekendBookings: true,
  strictAccountAccess: false,
  reportHeaderTitle: 'العتبة الحسينية المقدسة — قسم مجمع سيد الشهداء (ع) الخدمي',
  reportFooterNote: 'صادر عن منظومة إدارة القاعات الدراسية والجدول الدراسي',
  lastBackupAt: '',
  lastBackupBy: '',
  updatedBy: '',
};

export interface EffectiveAccess {
  role: UserRole;
  isSuspended: boolean;
  isAccessBlocked: boolean;
  isBootstrappedAdmin: boolean;
  isFullAdmin: boolean;
  canCreateBookings: boolean;
  canApproveBookings: boolean;
  canManageBookings: boolean;
  canManageClassrooms: boolean;
  canManageDepartments: boolean;
  canViewReports: boolean;
  canViewAuditLog: boolean;
  canManageSettings: boolean;
  canManageAccounts: boolean;
  branchName: string;
}

export function resolveEffectiveAccess(params: {
  email?: string | null;
  emailVerified?: boolean;
  isPasswordProvider?: boolean;
  hasAdminsDoc: boolean;
  account: AccountRecord | null;
  settings: SystemSettings;
}): EffectiveAccess {
  const {
    email,
    emailVerified,
    isPasswordProvider = false,
    hasAdminsDoc,
    account,
    settings,
  } = params;
  const isBootstrappedAdmin =
    !isPasswordProvider &&
    Boolean(emailVerified) &&
    email?.toLowerCase() === BOOTSTRAPPED_ADMIN_EMAIL;

  if (isBootstrappedAdmin) {
    return {
      role: 'admin',
      isSuspended: false,
      isAccessBlocked: false,
      isBootstrappedAdmin: true,
      isFullAdmin: true,
      canCreateBookings: true,
      canApproveBookings: true,
      canManageBookings: true,
      canManageClassrooms: true,
      canManageDepartments: true,
      canViewReports: true,
      canViewAuditLog: true,
      canManageSettings: true,
      canManageAccounts: true,
      branchName: 'إدارة القاعات',
    };
  }

  if (account) {
    const isSuspended = account.status === 'suspended';
    if (isSuspended) {
      return {
        role: account.role,
        isSuspended: true,
        isAccessBlocked: true,
        isBootstrappedAdmin: false,
        isFullAdmin: false,
        canCreateBookings: false,
        canApproveBookings: false,
        canManageBookings: false,
        canManageClassrooms: false,
        canManageDepartments: false,
        canViewReports: false,
        canViewAuditLog: false,
        canManageSettings: false,
        canManageAccounts: false,
        branchName: account.branchName,
      };
    }

    if (account.role === 'admin' || hasAdminsDoc) {
      return {
        role: 'admin',
        isSuspended: false,
        isAccessBlocked: false,
        isBootstrappedAdmin: false,
        isFullAdmin: true,
        canCreateBookings: true,
        canApproveBookings: true,
        canManageBookings: true,
        canManageClassrooms: true,
        canManageDepartments: true,
        canViewReports: true,
        canViewAuditLog: true,
        canManageSettings: true,
        canManageAccounts: false,
        branchName: account.branchName,
      };
    }

    if (account.role === 'branch_supervisor') {
      const p = account.permissions;
      return {
        role: 'branch_supervisor',
        isSuspended: false,
        isAccessBlocked: false,
        isBootstrappedAdmin: false,
        isFullAdmin: false,
        canCreateBookings: true,
        canApproveBookings: Boolean(p.approveBookings),
        canManageBookings: Boolean(p.manageBookings || p.approveBookings),
        canManageClassrooms: Boolean(p.manageClassrooms),
        canManageDepartments: Boolean(p.manageDepartments),
        canViewReports: Boolean(p.viewReports),
        canViewAuditLog: Boolean(
          p.approveBookings ||
            p.manageBookings ||
            p.manageClassrooms ||
            p.manageDepartments ||
            p.viewReports ||
            p.manageSettings
        ),
        canManageSettings: Boolean(p.manageSettings),
        canManageAccounts: false,
        branchName: account.branchName,
      };
    }

    if (account.role === 'viewer') {
      return {
        role: 'viewer',
        isSuspended: false,
        isAccessBlocked: false,
        isBootstrappedAdmin: false,
        isFullAdmin: false,
        canCreateBookings: false,
        canApproveBookings: false,
        canManageBookings: false,
        canManageClassrooms: false,
        canManageDepartments: false,
        canViewReports: Boolean(account.permissions.viewReports),
        canViewAuditLog: Boolean(account.permissions.viewReports),
        canManageSettings: false,
        canManageAccounts: false,
        branchName: account.branchName,
      };
    }

    return {
      role: 'coordinator',
      isSuspended: false,
      isAccessBlocked: false,
      isBootstrappedAdmin: false,
      isFullAdmin: false,
      canCreateBookings: true,
      canApproveBookings: false,
      canManageBookings: false,
      canManageClassrooms: false,
      canManageDepartments: false,
      canViewReports: Boolean(account.permissions.viewReports),
      canViewAuditLog: Boolean(account.permissions.viewReports),
      canManageSettings: false,
      canManageAccounts: false,
      branchName: account.branchName,
    };
  }

  if (hasAdminsDoc) {
    return {
      role: 'admin',
      isSuspended: false,
      isAccessBlocked: false,
      isBootstrappedAdmin: false,
      isFullAdmin: true,
      canCreateBookings: true,
      canApproveBookings: true,
      canManageBookings: true,
      canManageClassrooms: true,
      canManageDepartments: true,
      canViewReports: true,
      canViewAuditLog: true,
      canManageSettings: true,
      canManageAccounts: false,
      branchName: 'إدارة القاعات والجدول',
    };
  }

  const blockedByCredentials = isPasswordProvider;
  return {
    role: 'coordinator',
    isSuspended: false,
    isAccessBlocked: blockedByCredentials || Boolean(settings.strictAccountAccess),
    isBootstrappedAdmin: false,
    isFullAdmin: false,
    canCreateBookings: !blockedByCredentials && !settings.strictAccountAccess,
    canApproveBookings: false,
    canManageBookings: false,
    canManageClassrooms: false,
    canManageDepartments: false,
    canViewReports: !blockedByCredentials && !settings.strictAccountAccess,
    canViewAuditLog: !blockedByCredentials && !settings.strictAccountAccess,
    canManageSettings: false,
    canManageAccounts: false,
    branchName: settings.organizationName,
  };
}
