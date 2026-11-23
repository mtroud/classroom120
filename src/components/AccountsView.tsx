import { useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  PauseCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { AccountRecord, Department, UserRole } from '../types';
import {
  PERMISSION_ITEMS,
  ROLE_LABEL_AR,
  formatAccountLoginIdentifier,
} from '../utils/permissions';
import { getTodayISO } from '../utils/schedule';

export interface CreatedCredentialsNotice {
  displayName: string;
  username: string;
  password: string;
  branchName: string;
  role: UserRole;
}

interface AccountsViewProps {
  accounts: AccountRecord[];
  departments?: Department[];
  isLoading: boolean;
  lastCreatedCredentials?: CreatedCredentialsNotice | null;
  onDismissCreatedCredentials?: () => void;
  batchCreatedCredentials?: CreatedCredentialsNotice[] | null;
  onDismissBatchCreated?: () => void;
  onAddAccount: () => void;
  onCreateUnifiedViewer?: () => void;
  onCreateCoordinatorForDept?: (dept: Department) => void;
  onBatchCreateCoordinators?: (depts: Department[]) => Promise<void>;
  onEditAccount: (account: AccountRecord) => void;
  onToggleStatus: (account: AccountRecord) => Promise<void>;
  onDeleteAccount: (account: AccountRecord) => Promise<void>;
}

export function AccountsView({
  accounts,
  departments = [],
  isLoading,
  lastCreatedCredentials,
  onDismissCreatedCredentials,
  batchCreatedCredentials,
  onDismissBatchCreated,
  onAddAccount,
  onCreateUnifiedViewer,
  onCreateCoordinatorForDept,
  onBatchCreateCoordinators,
  onEditAccount,
  onToggleStatus,
  onDeleteAccount,
}: AccountsViewProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedCreds, setCopiedCreds] = useState(false);
  const [copiedBatch, setCopiedBatch] = useState(false);
  const [showMissingDepts, setShowMissingDepts] = useState(false);
  const [batchCreating, setBatchCreating] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);

  const counts = useMemo(() => {
    return {
      total: accounts.length,
      supervisors: accounts.filter((a) => a.role === 'branch_supervisor').length,
      viewers: accounts.filter((a) => a.role === 'viewer').length,
      suspended: accounts.filter((a) => a.status === 'suspended').length,
    };
  }, [accounts]);

  const hasActiveViewerAccount = useMemo(
    () => accounts.some((a) => a.role === 'viewer' && a.status === 'active'),
    [accounts]
  );

  const activeDepartments = useMemo(
    () => departments.filter((d) => d.status === 'active'),
    [departments]
  );

  const coordinatorBranches = useMemo(
    () =>
      new Set(
        accounts
          .filter((a) => a.role === 'coordinator')
          .map((a) => a.branchName.trim())
      ),
    [accounts]
  );

  const missingCoordinatorDepts = useMemo(
    () =>
      activeDepartments.filter(
        (d) => !coordinatorBranches.has(d.name.trim())
      ),
    [activeDepartments, coordinatorBranches]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (roleFilter !== 'all' && a.role !== roleFilter) return false;
      if (q) {
        const hay = `${a.displayName} ${a.email} ${a.username || ''} ${a.branchName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [accounts, roleFilter, search]);

  const handleCopyCredentials = async () => {
    if (!lastCreatedCredentials) return;
    const text = `بيانات الدخول إلى منظومة قاعات مجمع سيد الشهداء (ع)\nالاسم: ${lastCreatedCredentials.displayName}\nالشعبة: ${lastCreatedCredentials.branchName}\nاليوزر: ${lastCreatedCredentials.username}\nكلمة المرور: ${lastCreatedCredentials.password}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedCreds(true);
      setTimeout(() => setCopiedCreds(false), 2500);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const handleCopyBatchCredentials = async () => {
    if (!batchCreatedCredentials || batchCreatedCredentials.length === 0) return;
    const lines = batchCreatedCredentials.map(
      (item, idx) =>
        `${idx + 1}. ${item.branchName}\nاليوزر: ${item.username} | كلمة المرور: ${item.password}`
    );
    const text = `بيانات دخول منسقي الأقسام — منظومة قاعات مجمع سيد الشهداء (ع)\n\n${lines.join('\n\n')}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedBatch(true);
      setTimeout(() => setCopiedBatch(false), 2500);
    } catch {
      // Clipboard fallback ignored cleanly
    }
  };

  const handleExportBatchCsv = () => {
    if (!batchCreatedCredentials || batchCreatedCredentials.length === 0) return;
    const headers = ['القسم', 'الاسم', 'اليوزر', 'كلمة المرور', 'الدور'];
    const rows = batchCreatedCredentials.map((item) => [
      item.branchName,
      item.displayName,
      item.username,
      item.password,
      ROLE_LABEL_AR[item.role],
    ]);
    const csv =
      '\uFEFF' +
      [headers, ...rows]
        .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(','))
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `coordinators-accounts-${getTodayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleRunBatchCoordinators = async () => {
    if (!onBatchCreateCoordinators || missingCoordinatorDepts.length === 0) return;
    setBatchError(null);
    setBatchCreating(true);
    try {
      await onBatchCreateCoordinators(missingCoordinatorDepts);
      setShowMissingDepts(false);
    } catch (err) {
      setBatchError(
        err instanceof Error ? err.message : 'تعذر إنشاء حسابات منسقي الأقسام.'
      );
    } finally {
      setBatchCreating(false);
    }
  };

  const summarizePermissions = (acc: AccountRecord): string => {
    if (acc.role === 'admin') return 'صلاحية إدارة شاملة';
    if (acc.role === 'viewer') {
      return acc.permissions.viewReports
        ? 'اطلاع على الجدول · التقارير'
        : 'اطلاع على جدول الدورات فقط';
    }
    if (acc.role === 'coordinator') {
      return 'رفع طلبات حجز · متابعة طلباته';
    }
    const active = PERMISSION_ITEMS.filter((p) => acc.permissions[p.key]).map(
      (p) => p.label
    );
    return active.length > 0 ? active.join(' · ') : 'اطلاع ومراجعة فقط';
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-12 bg-slate-50 border border-slate-100 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0 text-teal-800">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              إدارة حسابات الشعب والمنتسبين والصلاحيات
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تخصيص صلاحيات مسؤولي شعب المجمع وإضافة حسابات المنتسبين للاطلاع على جدول الدورات
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onAddAccount}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة حساب جديد</span>
        </button>
      </div>

      {/* Department Coordinators Provisioning Panel */}
      {activeDepartments.length > 0 &&
        (onCreateCoordinatorForDept || onBatchCreateCoordinators) && (
          <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 space-y-3">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0 text-teal-800">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-900">
                    حسابات منسقي الأقسام للحجز السريع
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                    {missingCoordinatorDepts.length > 0
                      ? `يوجد ${missingCoordinatorDepts.length} قسم فعّال بدون حساب منسق حجز حتى الآن (من أصل ${activeDepartments.length} قسماً).`
                      : `جميع الأقسام الفعّالة (${activeDepartments.length}) لديها حسابات منسقين جاهزة لرفع طلبات الحجز.`}
                  </p>
                </div>
              </div>

              {missingCoordinatorDepts.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {onCreateCoordinatorForDept && (
                    <button
                      type="button"
                      onClick={() => setShowMissingDepts((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors cursor-pointer"
                    >
                      {showMissingDepts ? (
                        <ChevronUp className="w-3.5 h-3.5" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5" />
                      )}
                      <span>
                        {showMissingDepts ? 'إخفاء الأقسام' : 'تخصيص لكل قسم'}
                      </span>
                    </button>
                  )}

                  {onBatchCreateCoordinators && (
                    <button
                      type="button"
                      disabled={batchCreating}
                      onClick={() => void handleRunBatchCoordinators()}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-60 transition-colors cursor-pointer"
                    >
                      <UserPlus className="w-3.5 h-3.5" />
                      <span>
                        {batchCreating
                          ? 'جاري تجهيز الحسابات...'
                          : `إنشاء حسابات الأقسام الناقصة (${missingCoordinatorDepts.length})`}
                      </span>
                    </button>
                  )}
                </div>
              )}
            </div>

            {batchError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{batchError}</span>
              </div>
            )}

            {showMissingDepts && missingCoordinatorDepts.length > 0 && (
              <div className="pt-2 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-2">
                {missingCoordinatorDepts.map((dept) => (
                  <div
                    key={dept.id}
                    className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900 truncate">
                        {dept.name}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex items-center gap-2">
                        <span className="font-mono-num text-teal-800">{dept.code}</span>
                        {dept.headName && <span>· {dept.headName}</span>}
                      </div>
                    </div>
                    {onCreateCoordinatorForDept && (
                      <button
                        type="button"
                        onClick={() => onCreateCoordinatorForDept(dept)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-white border border-teal-200 text-teal-800 text-[11px] font-semibold hover:bg-teal-50 shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3 h-3" />
                        <span>إنشاء حساب</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      {/* Batch Created Coordinators Table */}
      {batchCreatedCredentials && batchCreatedCredentials.length > 0 && (
        <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-teal-900">
                تم إنشاء {batchCreatedCredentials.length} حساب منسق قسم بنجاح — يرجى حفظ البيانات أو تصديرها لتسليمها للأقسام
              </div>
              <p className="text-[11px] text-teal-800 mt-0.5">
                لن تظهر كلمات المرور مرة أخرى بعد إغلاق هذه البطاقة لأسباب أمنية.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleCopyBatchCredentials()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 cursor-pointer"
              >
                {copiedBatch ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBatch ? 'تم النسخ' : 'نسخ الكل'}</span>
              </button>
              <button
                type="button"
                onClick={handleExportBatchCsv}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-teal-300 bg-white text-teal-900 text-xs font-semibold hover:bg-teal-50 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تصدير CSV</span>
              </button>
              {onDismissBatchCreated && (
                <button
                  type="button"
                  onClick={onDismissBatchCreated}
                  aria-label="إغلاق"
                  className="p-1.5 rounded-md text-teal-700 hover:bg-teal-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div className="bg-white border border-teal-200 rounded-lg overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[580px] text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="px-3 py-2">القسم</th>
                  <th className="px-3 py-2">الاسم التعريفي</th>
                  <th className="px-3 py-2">اليوزر</th>
                  <th className="px-3 py-2">كلمة المرور</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {batchCreatedCredentials.map((item) => (
                  <tr key={item.username}>
                    <td className="px-3 py-2 font-medium text-slate-900">{item.branchName}</td>
                    <td className="px-3 py-2 text-slate-600">{item.displayName}</td>
                    <td className="px-3 py-2 font-mono-num font-semibold text-teal-900" dir="ltr">
                      {item.username}
                    </td>
                    <td className="px-3 py-2 font-mono-num font-semibold text-slate-900" dir="ltr">
                      {item.password}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Unified Viewer Quick-Setup Banner */}
      {!hasActiveViewerAccount && onCreateUnifiedViewer && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 text-teal-800">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900">
                إنشاء حساب اطلاع موحّد للمنتسبين
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">
                بدلاً من إضافة حساب منفصل لكل منتسب، أنشئ حساباً واحداً بصلاحية «اطلاع فقط» (مثل اليوزر{' '}
                <span className="font-mono-num font-semibold text-slate-800" dir="ltr">courses</span>
                ) ومشاركته مع المنتسبين للاطلاع على جدول الدورات.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onCreateUnifiedViewer}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer self-start sm:self-center"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إنشاء حساب اطلاع موحّد</span>
          </button>
        </div>
      )}

      {/* Newly Created Credentials Notice */}
      {lastCreatedCredentials && (
        <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-4 sm:p-5 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs font-bold text-teal-900">
                تم إنشاء حساب الدخول العادي بنجاح — يرجى تسليم البيانات للمستفيد
              </div>
              <p className="text-[11px] text-teal-800 mt-0.5">
                {lastCreatedCredentials.displayName} · {lastCreatedCredentials.branchName} · {ROLE_LABEL_AR[lastCreatedCredentials.role]}
              </p>
            </div>
            {onDismissCreatedCredentials && (
              <button
                type="button"
                onClick={onDismissCreatedCredentials}
                aria-label="إغلاق"
                className="p-1 rounded-md text-teal-700 hover:bg-teal-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-teal-200 rounded-lg px-4 py-2.5">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs">
              <span>
                <span className="text-slate-500">اليوزر: </span>
                <strong className="font-mono-num text-slate-900" dir="ltr">
                  {lastCreatedCredentials.username}
                </strong>
              </span>
              <span>
                <span className="text-slate-500">كلمة المرور: </span>
                <strong className="font-mono-num text-slate-900" dir="ltr">
                  {lastCreatedCredentials.password}
                </strong>
              </span>
            </div>

            <button
              type="button"
              onClick={() => void handleCopyCredentials()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {copiedCreds ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCreds ? 'تم النسخ' : 'نسخ بيانات الدخول'}</span>
            </button>
          </div>
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">إجمالي الحسابات المضافة</div>
          <div className="font-mono-num text-2xl font-semibold text-slate-900 mt-1">
            {counts.total}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">مسؤولو شعب المجمع</div>
          <div className="font-mono-num text-2xl font-semibold text-teal-800 mt-1">
            {counts.supervisors}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">حسابات المنتسبين (اطلاع)</div>
          <div className="font-mono-num text-2xl font-semibold text-slate-900 mt-1">
            {counts.viewers}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="text-xs text-slate-500">حسابات معلقة</div>
          <div className="font-mono-num text-2xl font-semibold text-amber-700 mt-1">
            {counts.suspended}
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex flex-wrap items-center p-1 bg-slate-100 rounded-lg">
            {(
              [
                ['all', 'الكل'],
                ['branch_supervisor', 'مسؤولو الشعب'],
                ['viewer', 'المنتسبون (اطلاع)'],
                ['coordinator', 'منسقو الحجز'],
                ['admin', 'المدراء'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setRoleFilter(val)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  roleFilter === val
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، البريد، أو الشعبة..."
              className="w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
            />
          </div>
        </div>
      </div>

      {/* Accounts Table / Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <p className="text-sm font-medium text-slate-800">
            {accounts.length === 0
              ? 'لم يتم إضافة حسابات للشعب أو المنتسبين بعد'
              : 'لا توجد حسابات مطابقة لمعايير البحث'}
          </p>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            أضف حساباً بسيطاً (يوزر وكلمة مرور) لمسؤول كل شعبة حسب صلاحياته، أو أنشئ حساب اطلاع موحّد للمنتسبين للاطلاع على جدول الدورات.
          </p>
          {accounts.length === 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onAddAccount}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة أول حساب</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">المستخدم والبريد الإلكتروني</th>
                  <th className="px-4 py-3">الشعبة / الجهة</th>
                  <th className="px-4 py-3">الدور</th>
                  <th className="px-4 py-3">الصلاحيات المخولة</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((acc) => {
                  const isActive = acc.status === 'active';
                  const isBusy = busyId === acc.id;
                  return (
                    <tr key={acc.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-slate-900">
                          {acc.displayName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="font-mono-num text-slate-700" dir="ltr">
                            {formatAccountLoginIdentifier(acc)}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>
                            {acc.authType === 'credentials'
                              ? 'دخول عادي (يوزر)'
                              : 'حساب Google'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {acc.branchName}
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-slate-800 whitespace-nowrap">
                        {ROLE_LABEL_AR[acc.role]}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-[300px]">
                        {summarizePermissions(acc)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            نشط
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                            <PauseCircle className="w-3.5 h-3.5" />
                            معلق
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-left whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setBusyId(acc.id);
                              try {
                                await onToggleStatus(acc);
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className="px-2.5 py-1 rounded-md border border-slate-200 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            {isActive ? 'تعليق' : 'تفعيل'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditAccount(acc)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                            title="تعديل الصلاحيات"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={async () => {
                              setBusyId(acc.id);
                              try {
                                await onDeleteAccount(acc);
                              } finally {
                                setBusyId(null);
                              }
                            }}
                            className="p-1.5 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                            title="حذف الحساب"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
