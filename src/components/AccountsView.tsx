import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  PauseCircle,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { AccountRecord, UserRole } from '../types';
import { PERMISSION_ITEMS, ROLE_LABEL_AR } from '../utils/permissions';

interface AccountsViewProps {
  accounts: AccountRecord[];
  isLoading: boolean;
  onAddAccount: () => void;
  onEditAccount: (account: AccountRecord) => void;
  onToggleStatus: (account: AccountRecord) => Promise<void>;
  onDeleteAccount: (account: AccountRecord) => Promise<void>;
}

export function AccountsView({
  accounts,
  isLoading,
  onAddAccount,
  onEditAccount,
  onToggleStatus,
  onDeleteAccount,
}: AccountsViewProps) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');
  const [busyId, setBusyId] = useState<string | null>(null);

  const counts = useMemo(() => {
    return {
      total: accounts.length,
      supervisors: accounts.filter((a) => a.role === 'branch_supervisor').length,
      viewers: accounts.filter((a) => a.role === 'viewer').length,
      suspended: accounts.filter((a) => a.status === 'suspended').length,
    };
  }, [accounts]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return accounts.filter((a) => {
      if (roleFilter !== 'all' && a.role !== roleFilter) return false;
      if (q) {
        const hay = `${a.displayName} ${a.email} ${a.branchName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [accounts, roleFilter, search]);

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
            أضف البريد الإلكتروني لحساب Google الخاص بمسؤول كل شعبة وحدد صلاحياته، أو أضف حسابات المنتسبين للاطلاع على جدول الدورات.
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
                        <div className="text-[11px] font-mono-num text-slate-500 mt-0.5">
                          {acc.email}
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
