import { useMemo, useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  PauseCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { Booking, Department, DepartmentStatus } from '../types';
import { calculateDurationHours, isActiveBooking } from '../utils/schedule';

interface DepartmentsViewProps {
  departments: Department[];
  bookings: Booking[];
  isAdmin: boolean;
  canBook?: boolean;
  isLoading: boolean;
  onAddDepartment: () => void;
  onEditDepartment: (dept: Department) => void;
  onToggleStatus: (dept: Department) => Promise<void>;
  onDeleteDepartment: (dept: Department) => Promise<void>;
  onBookForDepartment: (departmentName: string) => void;
  onSeedDefaults: () => Promise<void>;
  coordinatorBranchNames?: Set<string>;
  onCreateCoordinator?: (dept: Department) => void;
}

export function DepartmentsView({
  departments,
  bookings,
  isAdmin,
  canBook = true,
  isLoading,
  onAddDepartment,
  onEditDepartment,
  onToggleStatus,
  onDeleteDepartment,
  onBookForDepartment,
  onSeedDefaults,
  coordinatorBranchNames,
  onCreateCoordinator,
}: DepartmentsViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | DepartmentStatus>('all');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const statsByDept = useMemo(() => {
    const map = new Map<string, { count: number; hours: number }>();
    for (const b of bookings) {
      if (!isActiveBooking(b)) continue;
      const prev = map.get(b.department) || { count: 0, hours: 0 };
      map.set(b.department, {
        count: prev.count + 1,
        hours:
          Math.round(
            (prev.hours + calculateDurationHours(b.startTime, b.endTime)) * 10
          ) / 10,
      });
    }
    return map;
  }, [bookings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return departments.filter((d) => {
      if (statusFilter !== 'all' && d.status !== statusFilter) return false;
      if (q) {
        const hay = `${d.name} ${d.code} ${d.headName} ${d.sector}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [departments, statusFilter, search]);

  if (isLoading) {
    return (
      <div className="bg-white border border-[#DADCE0] rounded-2xl p-6 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-[#F8FAFD] border border-[#E8EAED] rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-[#1F1F1F]">
            أقسام العتبة الحسينية المقدسة ({departments.length})
          </h2>
          <p className="text-xs text-[#444746] mt-0.5">
            إدارة الأقسام والشعب المعتمدة لطلب حجز القاعات الدراسية ومتابعة نشاط كل قسم
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2.5">
            {departments.length === 0 && (
              <button
                type="button"
                disabled={seeding}
                onClick={async () => {
                  setSeeding(true);
                  try {
                    await onSeedDefaults();
                  } finally {
                    setSeeding(false);
                  }
                }}
                className="px-4 py-2 rounded-xl border border-[#DADCE0] bg-white text-xs font-medium text-[#1F1F1F] hover:bg-[#F0F4F9] transition-colors cursor-pointer"
              >
                {seeding ? 'جاري التحميل...' : 'تحميل الأقسام الافتراضية'}
              </button>
            )}
            <button
              type="button"
              onClick={onAddDepartment}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-semibold hover:bg-[#0842A0] transition-colors whitespace-nowrap shrink-0 cursor-pointer g-elevation-1"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة قسم جديد</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-[#DADCE0] rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center p-1 bg-[#F0F4F9] rounded-xl">
            {(
              [
                ['all', 'الكل'],
                ['active', 'مفعل'],
                ['inactive', 'موقوف'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setStatusFilter(val)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === val
                    ? 'bg-white text-[#0B57D0] font-semibold g-elevation-1'
                    : 'text-[#444746] font-medium hover:text-[#1F1F1F]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[240px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-[#747775] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث باسم القسم، الرمز، أو المسؤول..."
              className="w-full rounded-xl border border-[#DADCE0] bg-white pr-9 pl-3 py-2 text-xs text-[#1F1F1F] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
            />
          </div>
        </div>

        <div className="text-xs text-[#444746] tabular-nums">
          الأقسام المفعلة:{' '}
          <strong className="font-mono-num text-[#1F1F1F]">
            {departments.filter((d) => d.status === 'active').length}
          </strong>{' '}
          من أصل <strong className="font-mono-num text-[#1F1F1F]">{departments.length}</strong>
        </div>
      </div>

      {/* Table / Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-[#DADCE0] rounded-2xl p-12 text-center space-y-3">
          <p className="text-sm font-medium text-[#1F1F1F]">
            {departments.length === 0
              ? 'لم يتم إضافة أي قسم بعد'
              : 'لا توجد أقسام مطابقة للبحث'}
          </p>
          <p className="text-xs text-[#444746]">
            {isAdmin
              ? 'أضف أقسام العتبة الحسينية المقدسة لتظهر مباشرة في نموذج طلب الحجز.'
              : 'بانتظار إضافة الأقسام المعتمدة من قبل إدارة القسم.'}
          </p>
          {isAdmin && departments.length === 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onAddDepartment}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-semibold hover:bg-[#0842A0] transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة أول قسم</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#DADCE0] rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-[#F8FAFD] border-b border-[#DADCE0] text-xs font-semibold text-[#444746]">
                  <th className="px-4 py-3.5">الرمز</th>
                  <th className="px-4 py-3.5">اسم القسم / الشعبة</th>
                  <th className="px-4 py-3.5">المرجعية الإدارية</th>
                  <th className="px-4 py-3.5">المخول بالتنسيق</th>
                  <th className="px-4 py-3.5 text-left">الحجوزات الفعالة</th>
                  <th className="px-4 py-3.5">الحالة</th>
                  <th className="px-4 py-3.5 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EAED] text-sm">
                {filtered.map((dept) => {
                  const deptStats = statsByDept.get(dept.name) || {
                    count: 0,
                    hours: 0,
                  };
                  const isActive = dept.status === 'active';
                  const isBusy = busyId === dept.id;

                  return (
                    <tr
                      key={dept.id}
                      className="hover:bg-[#F8FAFD] transition-colors"
                    >
                      <td className="px-4 py-3 font-mono-num text-xs font-semibold text-[#0B57D0] whitespace-nowrap">
                        {dept.code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-[#1F1F1F]">
                          {dept.name}
                        </div>
                        {dept.notes && (
                          <div className="text-[11px] text-[#747775] mt-0.5 line-clamp-1">
                            {dept.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#444746]">
                        {dept.sector || 'العتبة الحسينية المقدسة'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#1F1F1F]">
                        {dept.headName || '—'}
                      </td>
                      <td className="px-4 py-3 text-left font-mono-num text-xs text-[#1F1F1F] whitespace-nowrap">
                        {deptStats.count} حجز · {deptStats.hours} س
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#137333]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            مفعل
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#747775]">
                            <PauseCircle className="w-3.5 h-3.5" />
                            موقوف
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-left whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {canBook && (
                            <button
                              type="button"
                              disabled={!isActive}
                              onClick={() => onBookForDepartment(dept.name)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#0B57D0] text-white text-[11px] font-semibold hover:bg-[#0842A0] disabled:opacity-40 transition-colors cursor-pointer"
                            >
                              <CalendarPlus className="w-3 h-3" />
                              <span>حجز قاعة</span>
                            </button>
                          )}

                          {onCreateCoordinator && isActive && !coordinatorBranchNames?.has(dept.name) && (
                            <button
                              type="button"
                              onClick={() => onCreateCoordinator(dept)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[#AECBFA] bg-[#E8F0FE] text-[#0B57D0] text-[11px] font-semibold hover:bg-[#D3E3FD] transition-colors cursor-pointer"
                              title="إنشاء حساب منسق لهذا القسم"
                            >
                              <UserPlus className="w-3 h-3" />
                              <span>حساب منسق</span>
                            </button>
                          )}

                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={async () => {
                                  setBusyId(dept.id);
                                  try {
                                    await onToggleStatus(dept);
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                                className="px-2 py-1 rounded-lg border border-[#DADCE0] text-[11px] font-medium text-[#444746] hover:bg-[#F0F4F9] hover:text-[#1F1F1F] transition-colors cursor-pointer"
                              >
                                {isActive ? 'إيقاف' : 'تفعيل'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditDepartment(dept)}
                                className="p-1.5 rounded-lg text-[#444746] hover:text-[#1F1F1F] hover:bg-[#F0F4F9] transition-colors cursor-pointer"
                                title="تعديل القسم"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={async () => {
                                  setBusyId(dept.id);
                                  try {
                                    await onDeleteDepartment(dept);
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                                className="p-1.5 rounded-lg text-[#747775] hover:text-[#C5221F] hover:bg-[#FCE8E6] transition-colors cursor-pointer"
                                title="حذف القسم"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
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
