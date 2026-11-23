import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Users, X } from 'lucide-react';
import { ATABA_DEPARTMENTS } from '../data/seedData';
import {
  BLUEPRINT_LIMITS,
  Booking,
  BookingStatus,
  BookingType,
  Classroom,
  Department,
} from '../types';
import {
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  TIME_OPTIONS,
  findBookingConflicts,
  formatTime12Ar,
  isActiveBooking,
  timeToMinutes,
} from '../utils/schedule';

export interface BookingDraft {
  id?: string;
  roomId: string;
  courseTitle: string;
  instructorName: string;
  department: string;
  bookingType: BookingType;
  date: string;
  startTime: string;
  endTime: string;
  attendeesCount: number;
  status: BookingStatus;
  notes: string;
}

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: BookingDraft) => Promise<void>;
  classrooms: Classroom[];
  departments: Department[];
  existingBookings: Booking[];
  initialDraft: BookingDraft;
  isAdmin: boolean;
  coordinatorDepartment?: string;
  allowWeekendBookings?: boolean;
  maxAdvanceDays?: number;
}

export function BookingModal({
  isOpen,
  onClose,
  onSave,
  classrooms,
  departments,
  existingBookings,
  initialDraft,
  isAdmin,
  coordinatorDepartment,
  allowWeekendBookings = true,
  maxAdvanceDays = 365,
}: BookingModalProps) {
  const availableDepartments = useMemo(() => {
    if (departments.length === 0) {
      return [...ATABA_DEPARTMENTS];
    }
    return departments
      .filter((d) => d.status === 'active')
      .map((d) => d.name);
  }, [departments]);

  const [form, setForm] = useState<BookingDraft>(initialDraft);
  const [selectedDeptOption, setSelectedDeptOption] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setForm(initialDraft);
    const dept = initialDraft.department.trim();
    if (!dept) {
      const firstDept = availableDepartments[0] || '';
      setSelectedDeptOption(firstDept || '__other__');
      if (firstDept) {
        setForm((prev) => ({ ...prev, department: firstDept }));
      }
    } else if (availableDepartments.includes(dept)) {
      setSelectedDeptOption(dept);
    } else {
      setSelectedDeptOption('__other__');
    }
    setErrorMsg(null);
  }, [initialDraft, isOpen, availableDepartments]);

  const selectedRoom = useMemo(
    () => classrooms.find((r) => r.id === form.roomId),
    [classrooms, form.roomId]
  );

  const conflicts = useMemo(() => {
    if (!form.roomId || !form.date || !form.startTime || !form.endTime) return [];
    if (timeToMinutes(form.startTime) >= timeToMinutes(form.endTime)) return [];
    if (!isActiveBooking({ status: form.status })) return [];
    return findBookingConflicts(existingBookings, {
      id: form.id,
      roomId: form.roomId,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime,
    });
  }, [existingBookings, form]);

  const capacityExceeded =
    selectedRoom !== undefined && form.attendeesCount > selectedRoom.capacity;

  const isMaintenanceRoom = selectedRoom?.status === 'maintenance';

  const activeDurationMinutes = useMemo(() => {
    if (!form.startTime || !form.endTime) return 0;
    return timeToMinutes(form.endTime) - timeToMinutes(form.startTime);
  }, [form.startTime, form.endTime]);

  const applyDurationMinutes = (durationMinutes: number) => {
    const startMins = timeToMinutes(form.startTime || '09:00');
    const maxEndMins = timeToMinutes(TIME_OPTIONS[TIME_OPTIONS.length - 1]);
    const targetMins = Math.min(startMins + durationMinutes, maxEndMins);
    const matchingOption =
      TIME_OPTIONS.find((opt) => timeToMinutes(opt) === targetMins) ||
      TIME_OPTIONS[TIME_OPTIONS.length - 1];
    if (timeToMinutes(matchingOption) > startMins) {
      setForm((prev) => ({ ...prev, endTime: matchingOption }));
    }
  };

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.roomId) {
      setErrorMsg('يرجى اختيار القاعة الدراسية.');
      return;
    }
    if (isMaintenanceRoom && isActiveBooking({ status: form.status })) {
      setErrorMsg('هذه القاعة قيد الصيانة حالياً ولا يمكن حجزها.');
      return;
    }
    if (form.courseTitle.trim().length < 2) {
      setErrorMsg('يرجى إدخال عنوان المحاضرة أو النشاط (حرفين على الأقل).');
      return;
    }
    if (form.instructorName.trim().length < 2) {
      setErrorMsg('يرجى إدخال اسم الأستاذ أو المحاضر.');
      return;
    }
    if (form.department.trim().length < 2) {
      setErrorMsg('يرجى تحديد القسم أو الشعبة التابعة للعتبة الحسينية المقدسة.');
      return;
    }
    if (!BLUEPRINT_LIMITS.DATE_PATTERN.test(form.date)) {
      setErrorMsg('صيغة التاريخ غير صالحة.');
      return;
    }
    const [yr, mo, dy] = form.date.split('-').map(Number);
    const chosenDate = new Date(yr, mo - 1, dy);
    if (!allowWeekendBookings && !isAdmin) {
      const dow = chosenDate.getDay();
      if (dow === 5 || dow === 6) {
        setErrorMsg('إعدادات المجمع الحالية لا تسمح بالحجز أيام العطلة الأسبوعية (الجمعة والسبت).');
        return;
      }
    }
    if (!isAdmin && maxAdvanceDays > 0) {
      const now = new Date();
      const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffDays = Math.round(
        (chosenDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24)
      );
      if (diffDays > maxAdvanceDays) {
        setErrorMsg(`الحد الأقصى المسموح للحجز المسبق هو ${maxAdvanceDays} يوماً.`);
        return;
      }
    }
    if (timeToMinutes(form.startTime) >= timeToMinutes(form.endTime)) {
      setErrorMsg('يجب أن يكون وقت الانتهاء بعد وقت البدء.');
      return;
    }
    if (conflicts.length > 0) {
      setErrorMsg('يوجد تعارض زمني مع حجز آخر في نفس القاعة. يرجى اختيار وقت آخر.');
      return;
    }
    if (form.attendeesCount < 1 || form.attendeesCount > BLUEPRINT_LIMITS.CAPACITY_MAX) {
      setErrorMsg('يرجى إدخال عدد طلاب صحيح.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...form,
        courseTitle: form.courseTitle.trim().slice(0, BLUEPRINT_LIMITS.COURSE_TITLE_MAX),
        instructorName: form.instructorName.trim().slice(0, BLUEPRINT_LIMITS.INSTRUCTOR_MAX),
        department: form.department.trim().slice(0, BLUEPRINT_LIMITS.DEPARTMENT_MAX),
        notes: form.notes.trim().slice(0, BLUEPRINT_LIMITS.NOTES_MAX),
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر حفظ الحجز. يرجى المحاولة مجدداً.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2 id="booking-modal-title" className="font-display text-lg font-bold text-slate-900">
              {form.id ? 'تعديل طلب الحجز' : 'طلب حجز قاعة لأقسام العتبة الحسينية المقدسة'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {isAdmin
                ? 'صلاحية الإدارة: يمكنك الموافقة الفورية على الحجز أو إبقائه قيد المراجعة'
                : 'يخضع الطلب لمراجعة وموافقة إدارة قسم مجمع سيد الشهداء (ع) الخدمي قبل التثبيت'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-900 space-y-1">
              <div className="font-semibold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>تعارض زمني مكتشف في هذه القاعة</span>
              </div>
              {conflicts.map((c) => (
                <div key={c.id} className="text-xs text-amber-800 pr-6">
                  {c.courseTitle} ({formatTime12Ar(c.startTime)} – {formatTime12Ar(c.endTime)} · {c.instructorName})
                </div>
              ))}
            </div>
          )}

          {!form.id && coordinatorDepartment && (
            <div className="bg-teal-50/70 border border-teal-200 rounded-lg px-4 py-2.5 text-xs text-teal-900">
              تم تحديد قسمك (<strong className="font-semibold">{coordinatorDepartment}</strong>) تلقائياً للحجز السريع — اختر القاعة والتاريخ والوقت وأرسل الطلب.
            </div>
          )}

          {isMaintenanceRoom && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-xs text-red-800">
              تنبيه: القاعة المحددة قيد الصيانة الفنية حالياً.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                القاعة الدراسية
              </label>
              <select
                value={form.roomId}
                onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                required
              >
                <option value="">اختر القاعة...</option>
                {classrooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.name} ({room.code} · سعة {room.capacity} طالب
                    {room.status === 'maintenance' ? ' · قيد الصيانة' : ''})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                عنوان المحاضرة / الدورة / النشاط
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.COURSE_TITLE_MAX}
                value={form.courseTitle}
                onChange={(e) => setForm({ ...form, courseTitle: e.target.value })}
                placeholder="مثال: محاضرة تطبيقات الحاسوب المتقدمة"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                اسم الأستاذ / المحاضر
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.INSTRUCTOR_MAX}
                value={form.instructorName}
                onChange={(e) => setForm({ ...form, instructorName: e.target.value })}
                placeholder="د. / أ. الاسم الكامل"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                القسم الطالب (أقسام العتبة الحسينية المقدسة)
              </label>
              <select
                value={selectedDeptOption}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedDeptOption(val);
                  if (val !== '__other__') {
                    setForm({ ...form, department: val });
                  } else {
                    setForm({ ...form, department: '' });
                  }
                }}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                required
              >
                {availableDepartments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
                <option value="__other__">قسم / شعبة أخرى تابعة للعتبة الحسينية</option>
              </select>
              {selectedDeptOption === '__other__' && (
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.DEPARTMENT_MAX}
                  value={form.department}
                  onChange={(e) => setForm({ ...form, department: e.target.value })}
                  placeholder="اكتب اسم القسم أو الشعبة في العتبة الحسينية المقدسة"
                  className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                  required
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                نوع النشاط
              </label>
              <select
                value={form.bookingType}
                onChange={(e) =>
                  setForm({ ...form, bookingType: e.target.value as BookingType })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
              >
                {(Object.keys(BOOKING_TYPE_LABEL) as BookingType[]).map((t) => (
                  <option key={t} value={t}>
                    {BOOKING_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                التاريخ
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                وقت البدء
              </label>
              <select
                value={form.startTime}
                onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
              >
                {TIME_OPTIONS.slice(0, -1).map((t) => (
                  <option key={t} value={t}>
                    {formatTime12Ar(t)} ({t})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                وقت الانتهاء
              </label>
              <select
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
              >
                {TIME_OPTIONS.slice(1).map((t) => (
                  <option key={t} value={t}>
                    {formatTime12Ar(t)} ({t})
                  </option>
                ))}
              </select>
              <div className="mt-1.5 flex items-center gap-1.5">
                {[
                  { label: 'ساعة', mins: 60 },
                  { label: 'ساعتان', mins: 120 },
                  { label: '3 ساعات', mins: 180 },
                ].map((preset) => (
                  <button
                    key={preset.mins}
                    type="button"
                    onClick={() => applyDurationMinutes(preset.mins)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium border transition-colors cursor-pointer ${
                      activeDurationMinutes === preset.mins
                        ? 'border-teal-700 bg-teal-50 text-teal-900'
                        : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                عدد الطلاب المتوقع
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  max={BLUEPRINT_LIMITS.CAPACITY_MAX}
                  value={form.attendeesCount}
                  onChange={(e) =>
                    setForm({ ...form, attendeesCount: Number(e.target.value) || 1 })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-teal-700"
                  required
                />
                {selectedRoom && (
                  <span className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                    <Users className="w-3.5 h-3.5" />
                    السعة القصوى للقاعة: {selectedRoom.capacity} طالب
                  </span>
                )}
              </div>
              {capacityExceeded && (
                <p className="text-xs text-amber-700 mt-1">
                  تنبيه: العدد يتجاوز السعة الاستيعابية للقاعة.
                </p>
              )}
            </div>

            {isAdmin && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  حالة الحجز
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as BookingStatus })
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                >
                  {(Object.keys(BOOKING_STATUS_LABEL) as BookingStatus[]).map((s) => (
                    <option key={s} value={s}>
                      {BOOKING_STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                متطلبات تقنية أو ملاحظات (اختياري)
              </label>
              <textarea
                rows={2}
                maxLength={BLUEPRINT_LIMITS.NOTES_MAX}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="مثال: الحاجة إلى ميكروفون لاسلكي إضافي أو ربط العرض اللاسلكي..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-700 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving || conflicts.length > 0}
              className="px-5 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saving
                ? 'جاري الإرسال...'
                : form.id
                  ? 'حفظ التعديلات'
                  : isAdmin
                    ? 'حفظ وتثبيت الحجز'
                    : 'إرسال طلب الحجز للإدارة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
