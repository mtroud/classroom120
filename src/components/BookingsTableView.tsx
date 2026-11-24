import { useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Clock,
  Download,
  Pencil,
  Plus,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { Booking, BookingStatus, Classroom } from '../types';
import {
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  exportBookingsToCsv,
  formatTime12Ar,
  timeToMinutes,
} from '../utils/schedule';

interface BookingsTableViewProps {
  bookings: Booking[];
  classrooms: Classroom[];
  currentUserId: string;
  isAdmin: boolean;
  canApprove?: boolean;
  canManageAll?: boolean;
  canCreate?: boolean;
  scopedDepartmentName?: string;
  isLoading: boolean;
  statusFilter: 'all' | BookingStatus;
  onStatusFilterChange: (status: 'all' | BookingStatus) => void;
  onCreateNew: () => void;
  onEdit: (booking: Booking) => void;
  onApprove: (booking: Booking) => Promise<void>;
  onReject: (booking: Booking) => Promise<void>;
  onCancel: (booking: Booking) => Promise<void>;
  onDelete: (booking: Booking) => Promise<void>;
}

export function BookingsTableView({
  bookings,
  classrooms,
  currentUserId,
  isAdmin,
  canApprove = isAdmin,
  canManageAll = isAdmin,
  canCreate = true,
  scopedDepartmentName,
  isLoading,
  statusFilter,
  onStatusFilterChange,
  onCreateNew,
  onEdit,
  onApprove,
  onReject,
  onCancel,
  onDelete,
}: BookingsTableViewProps) {
  const [search, setSearch] = useState('');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [busyId, setBusyId] = useState<string | null>(null);

  const pendingCount = useMemo(
    () => bookings.filter((b) => b.status === 'pending').length,
    [bookings]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings
      .filter((b) => {
        if (statusFilter !== 'all' && b.status !== statusFilter) return false;
        if (roomFilter !== 'all' && b.roomId !== roomFilter) return false;
        if (dateFilter && b.date !== dateFilter) return false;
        if (q) {
          const hay = `${b.courseTitle} ${b.instructorName} ${b.department} ${b.roomName}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return b.date.localeCompare(a.date);
        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
      });
  }, [bookings, statusFilter, roomFilter, dateFilter, search]);

  const handleAction = async (id: string, fn: () => Promise<void>) => {
    setBusyId(id);
    try {
      await fn();
    } finally {
      setBusyId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-11 bg-slate-50 border border-slate-100 rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {scopedDepartmentName && (
        <div className="bg-teal-50/70 border border-teal-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-teal-900">
          <div>
            تعرض هذه الصفحة حجوزات قسمك فقط (<strong className="font-semibold">{scopedDepartmentName}</strong>) لمتابعة حالة طلبات الحجز.
          </div>
          <span className="font-mono-num font-semibold text-teal-800 shrink-0">
            الإجمالي: {bookings.length}
          </span>
        </div>
      )}

      {canApprove && pendingCount > 0 && statusFilter !== 'pending' && (
        <div className="bg-amber-50/80 border border-amber-200 rounded-xl px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-xs text-amber-900 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-700 shrink-0" />
            <span>
              يوجد <strong className="font-mono-num">{pendingCount}</strong> طلب حجز من أقسام العتبة الحسينية المقدسة بانتظار موافقة الإدارة.
            </span>
          </div>
          <button
            type="button"
            onClick={() => onStatusFilterChange('pending')}
            className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-amber-900 hover:bg-amber-100/60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            مراجعة الطلبات المعلقة
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Status segmented control */}
          <div className="inline-flex flex-wrap items-center p-1 bg-slate-100 rounded-lg">
            {(
              [
                ['all', 'الكل'],
                ['pending', 'بانتظار الموافقة'],
                ['confirmed', 'موافق عليه'],
                ['rejected', 'مرفوض'],
                ['cancelled', 'ملغي'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => onStatusFilterChange(val)}
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

          <div className="relative min-w-[220px] flex-1 sm:flex-initial">
            <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالعنوان، المحاضر، القسم..."
              className="w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 py-2 text-xs text-slate-900 focus:outline-none focus:border-teal-700"
            />
          </div>

          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 focus:outline-none focus:border-teal-700"
            aria-label="تصفية القاعة"
          >
            <option value="all">كل القاعات</option>
            {classrooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs font-mono-num text-slate-800 focus:outline-none focus:border-teal-700"
              aria-label="تصفية التاريخ"
            />
            {dateFilter && (
              <button
                type="button"
                onClick={() => setDateFilter('')}
                className="text-xs text-slate-500 hover:text-slate-800 px-2 py-1 cursor-pointer"
              >
                مسح
              </button>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => exportBookingsToCsv(filtered)}
            disabled={filtered.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-500" />
            <span>تصدير CSV</span>
          </button>
          {canCreate && (
            <button
              type="button"
              onClick={onCreateNew}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>حجز جديد</span>
            </button>
          )}
        </div>
      </div>

      {/* Data Table */}
      {filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <p className="text-sm font-medium text-slate-800">
            لا توجد حجوزات مطابقة للمعايير المحددة
          </p>
          <p className="text-xs text-slate-500">
            {canCreate
              ? 'يمكنك تغيير خيارات التصفية أو إنشاء حجز قاعة جديد الآن.'
              : 'لا توجد دورات أو محاضرات مطابقة لخيارات التصفية الحالية.'}
          </p>
          {canCreate && (
            <div className="pt-1">
              <button
                type="button"
                onClick={onCreateNew}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إنشاء أول حجز</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[920px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="px-4 py-3">التاريخ والوقت</th>
                  <th className="px-4 py-3">القاعة</th>
                  <th className="px-4 py-3">النشاط والمحاضر</th>
                  <th className="px-4 py-3">القسم الطالب (العتبة الحسينية)</th>
                  <th className="px-4 py-3 text-left">الطلاب</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3 text-left">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filtered.map((b) => {
                  const isOwner = b.creatorId === currentUserId;
                  const canEdit =
                    canApprove || canManageAll || (canCreate && isOwner && b.status === 'pending');
                  const canCancel =
                    (b.status === 'pending' || b.status === 'confirmed') &&
                    (canApprove || canManageAll || (canCreate && isOwner));
                  const canDelete =
                    canApprove || canManageAll || (canCreate && isOwner && b.status === 'pending');
                  const isBusy = busyId === b.id;

                  return (
                    <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-mono-num text-xs font-semibold text-slate-900">
                          {b.date}
                        </div>
                        <div className="font-mono-num text-xs text-slate-500 mt-0.5">
                          {formatTime12Ar(b.startTime)} – {formatTime12Ar(b.endTime)}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-xs font-semibold text-slate-900">
                          {b.roomName}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {BOOKING_TYPE_LABEL[b.bookingType]}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-[260px]">
                        <div className="text-xs font-semibold text-slate-900 truncate">
                          {b.courseTitle}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          {b.instructorName}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700">
                        {b.department}
                      </td>
                      <td className="px-4 py-3 text-left font-mono-num text-xs font-medium text-slate-800 whitespace-nowrap">
                        {b.attendeesCount}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {b.status === 'confirmed' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            {BOOKING_STATUS_LABEL.confirmed}
                          </span>
                        )}
                        {b.status === 'pending' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                            <Clock className="w-3.5 h-3.5" />
                            {BOOKING_STATUS_LABEL.pending}
                          </span>
                        )}
                        {b.status === 'rejected' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-700">
                            <Ban className="w-3.5 h-3.5" />
                            {BOOKING_STATUS_LABEL.rejected}
                          </span>
                        )}
                        {b.status === 'cancelled' && (
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
                            <XCircle className="w-3.5 h-3.5" />
                            {BOOKING_STATUS_LABEL.cancelled}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-left whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {canApprove && b.status === 'pending' && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAction(b.id, () => onApprove(b))}
                                className="px-2.5 py-1 rounded-md bg-teal-700 text-white text-[11px] font-medium hover:bg-teal-800 disabled:opacity-50 transition-colors cursor-pointer"
                              >
                                موافقة
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => handleAction(b.id, () => onReject(b))}
                                className="px-2.5 py-1 rounded-md border border-red-200 bg-white text-red-700 text-[11px] font-medium hover:bg-red-50 disabled:opacity-50 transition-colors cursor-pointer"
                              >
                                رفض
                              </button>
                            </>
                          )}
                          {canEdit && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => onEdit(b)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
                              title="تعديل"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canCancel && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAction(b.id, () => onCancel(b))}
                              className="p-1.5 rounded-md text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors cursor-pointer"
                              title="إلغاء الحجز"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleAction(b.id, () => onDelete(b))}
                              className="p-1.5 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
                              title="حذف السجل"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
