import { useMemo, useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  PauseCircle,
  Pencil,
  Plus,
  Search,
  Trash2,
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
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 bg-slate-50 border border-slate-100 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            أقسام العتبة الحسينية المقدسة ({departments.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
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
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {seeding ? 'جاري التحميل...' : 'تحميل الأقسام الافتراضية'}
              </button>
            )}
            <button
              type="button"
              onClick={onAddDepartment}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة قسم جديد</span>
            </button>
          </div>
        )}
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
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
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === val
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
              placeholder="بحث باسم القسم، الرمز، أو المسؤول..."
              className="w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
            />
          </div>
        </div>

        <div className="text-xs text-slate-500 tabular-nums">
          الأقسام المفعلة:{' '}
          <strong className="text-slate-900">
            {departments.filter((d) => d.status === 'active').length}
          </strong>{' '}
          من أصل <strong className="text-slate-900">{departments.length}</strong>
        </div>
      </div>

      {/* Table / Empty State */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <p className="text-sm font-medium text-slate-800">
            {departments.length === 0
              ? 'لم يتم إضافة أي قسم بعد'
              : 'لا توجد أقسام مطابقة للبحث'}
          </p>
          <p className="text-xs text-slate-500">
            {isAdmin
              ? 'أضف أقسام العتبة الحسينية المقدسة لتظهر مباشرة في نموذج طلب الحجز.'
              : 'بانتظار إضافة الأقسام المعتمدة من قبل إدارة القسم.'}
          </p>
          {isAdmin && departments.length === 0 && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onAddDepartment}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة أول قسم</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">الرمز</th>
                  <th className="px-4 py-3">اسم القسم / الشعبة</th>
                  <th className="px-4 py-3">المرجعية الإدارية</th>
                  <th className="px-4 py-3">المخول بالتنسيق</th>
                  <th className="px-4 py-3 text-left">الحجوزات الفعالة</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
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
                      className="hover:bg-slate-50/70 transition-colors"
                    >
                      <td className="px-4 py-3 font-mono-num text-xs font-semibold text-teal-800 whitespace-nowrap">
                        {dept.code}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-slate-900">
                          {dept.name}
                        </div>
                        {dept.notes && (
                          <div className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">
                            {dept.notes}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {dept.sector || 'العتبة الحسينية المقدسة'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {dept.headName || '—'}
                      </td>
                      <td className="px-4 py-3 text-left font-mono-num text-xs text-slate-800 whitespace-nowrap">
                        {deptStats.count} حجز · {deptStats.hours} س
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {isActive ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            مفعل
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
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
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-teal-700 text-white text-[11px] font-medium hover:bg-teal-800 disabled:opacity-40 transition-colors cursor-pointer"
                            >
                              <CalendarPlus className="w-3 h-3" />
                              <span>حجز قاعة</span>
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
                                className="px-2 py-1 rounded-md border border-slate-200 text-[11px] font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                              >
                                {isActive ? 'إيقاف' : 'تفعيل'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditDepartment(dept)}
                                className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
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
                                className="p-1.5 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
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
