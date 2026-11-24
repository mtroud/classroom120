import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, Building2, CheckCircle2, Clock, Users, Wrench, X } from 'lucide-react';
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
  const formBodyRef = useRef<HTMLDivElement | null>(null);

  const lockedDepartment = coordinatorDepartment?.trim() || '';

  useEffect(() => {
    const resolvedDept = lockedDepartment || initialDraft.department.trim();
    if (lockedDepartment) {
      setForm({ ...initialDraft, department: lockedDepartment });
      setSelectedDeptOption(lockedDepartment);
    } else {
      setForm(initialDraft);
      if (!resolvedDept) {
        const firstDept = availableDepartments[0] || '';
        setSelectedDeptOption(firstDept || '__other__');
        if (firstDept) {
          setForm((prev) => ({ ...prev, department: firstDept }));
        }
      } else if (availableDepartments.includes(resolvedDept)) {
        setSelectedDeptOption(resolvedDept);
      } else {
        setSelectedDeptOption('__other__');
      }
    }
    setErrorMsg(null);
  }, [initialDraft, isOpen, availableDepartments, lockedDepartment]);

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

  const roomConflictMap = useMemo(() => {
    const map = new Map<string, Booking[]>();
    if (!form.date || !form.startTime || !form.endTime) return map;
    if (timeToMinutes(form.startTime) >= timeToMinutes(form.endTime)) return map;
    for (const room of classrooms) {
      const list = findBookingConflicts(existingBookings, {
        id: form.id,
        roomId: room.id,
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
      });
      if (list.length > 0) {
        map.set(room.id, list);
      }
    }
    return map;
  }, [classrooms, existingBookings, form.date, form.endTime, form.id, form.startTime]);

  const selectedRoomDayBookings = useMemo(() => {
    if (!form.roomId || !form.date) return [];
    return existingBookings
      .filter(
        (b) =>
          b.roomId === form.roomId &&
          b.date === form.date &&
          b.id !== form.id &&
          isActiveBooking(b)
      )
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [existingBookings, form.date, form.id, form.roomId]);

  const validEndTimeOptions = useMemo(() => {
    const startMins = timeToMinutes(form.startTime || '08:00');
    return TIME_OPTIONS.filter((t) => timeToMinutes(t) > startMins);
  }, [form.startTime]);

  const capacityExceeded =
    selectedRoom !== undefined && form.attendeesCount > selectedRoom.capacity;

  const isMaintenanceRoom = selectedRoom?.status === 'maintenance';

  const activeDurationMinutes = useMemo(() => {
    if (!form.startTime || !form.endTime) return 0;
    return timeToMinutes(form.endTime) - timeToMinutes(form.startTime);
  }, [form.startTime, form.endTime]);

  const handleStartTimeChange = (nextStart: string) => {
    const nextStartMins = timeToMinutes(nextStart);
    const currentEndMins = timeToMinutes(form.endTime);
    if (currentEndMins <= nextStartMins) {
      const maxEndMins = timeToMinutes(TIME_OPTIONS[TIME_OPTIONS.length - 1]);
      const targetMins = Math.min(nextStartMins + 60, maxEndMins);
      const nextEnd =
        TIME_OPTIONS.find((opt) => timeToMinutes(opt) === targetMins) ||
        TIME_OPTIONS[TIME_OPTIONS.length - 1];
      setForm((prev) => ({ ...prev, startTime: nextStart, endTime: nextEnd }));
    } else {
      setForm((prev) => ({ ...prev, startTime: nextStart }));
    }
  };

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

  const handleSelectHourSlot = (hourStart: string) => {
    const startMins = timeToMinutes(hourStart);
    const maxEndMins = timeToMinutes(TIME_OPTIONS[TIME_OPTIONS.length - 1]);
    const twoHourEndMins = Math.min(startMins + 120, maxEndMins);
    const oneHourEndMins = Math.min(startMins + 60, maxEndMins);
    const twoHourEnd =
      TIME_OPTIONS.find((opt) => timeToMinutes(opt) === twoHourEndMins) ||
      TIME_OPTIONS[TIME_OPTIONS.length - 1];
    const oneHourEnd =
      TIME_OPTIONS.find((opt) => timeToMinutes(opt) === oneHourEndMins) ||
      TIME_OPTIONS[TIME_OPTIONS.length - 1];

    const twoHourFree =
      findBookingConflicts(existingBookings, {
        id: form.id,
        roomId: form.roomId,
        date: form.date,
        startTime: hourStart,
        endTime: twoHourEnd,
      }).length === 0;

    setForm((prev) => ({
      ...prev,
      startTime: hourStart,
      endTime: twoHourFree ? twoHourEnd : oneHourEnd,
    }));
  };

  if (!isOpen) return null;

  const showValidationError = (msg: string) => {
    setErrorMsg(msg);
    formBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const effectiveDepartment = (lockedDepartment || form.department).trim();

    if (!form.roomId) {
      showValidationError('يرجى اختيار القاعة الدراسية.');
      return;
    }
    if (isMaintenanceRoom && isActiveBooking({ status: form.status })) {
      showValidationError('هذه القاعة قيد الصيانة حالياً ولا يمكن حجزها.');
      return;
    }
    if (form.courseTitle.trim().length < 2) {
      showValidationError('يرجى إدخال عنوان المحاضرة أو النشاط (حرفين على الأقل).');
      return;
    }
    if (form.instructorName.trim().length < 2) {
      showValidationError('يرجى إدخال اسم الأستاذ أو المحاضر.');
      return;
    }
    if (effectiveDepartment.length < 2) {
      showValidationError('يرجى تحديد القسم أو الشعبة التابعة للعتبة الحسينية المقدسة.');
      return;
    }
    if (!BLUEPRINT_LIMITS.DATE_PATTERN.test(form.date)) {
      showValidationError('صيغة التاريخ غير صالحة.');
      return;
    }
    const [yr, mo, dy] = form.date.split('-').map(Number);
    const chosenDate = new Date(yr, mo - 1, dy);
    if (!allowWeekendBookings && !isAdmin) {
      const dow = chosenDate.getDay();
      if (dow === 5 || dow === 6) {
        showValidationError('إعدادات المجمع الحالية لا تسمح بالحجز أيام العطلة الأسبوعية (الجمعة والسبت).');
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
        showValidationError(`الحد الأقصى المسموح للحجز المسبق هو ${maxAdvanceDays} يوماً.`);
        return;
      }
    }
    if (timeToMinutes(form.startTime) >= timeToMinutes(form.endTime)) {
      showValidationError('يجب أن يكون وقت الانتهاء بعد وقت البدء.');
      return;
    }
    if (conflicts.length > 0) {
      const firstConflict = conflicts[0];
      showValidationError(
        `يوجد تعارض زمني في نفس الوقت: القاعة «${selectedRoom?.name || ''}» محجوزة بالفعل من ${formatTime12Ar(firstConflict.startTime)} إلى ${formatTime12Ar(firstConflict.endTime)}. يرجى اختيار وقت آخر متاح أو قاعة أخرى.`
      );
      return;
    }
    if (form.attendeesCount < 1 || form.attendeesCount > BLUEPRINT_LIMITS.CAPACITY_MAX) {
      showValidationError('يرجى إدخال عدد طلاب صحيح.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...form,
        courseTitle: form.courseTitle.trim().slice(0, BLUEPRINT_LIMITS.COURSE_TITLE_MAX),
        instructorName: form.instructorName.trim().slice(0, BLUEPRINT_LIMITS.INSTRUCTOR_MAX),
        department: effectiveDepartment.slice(0, BLUEPRINT_LIMITS.DEPARTMENT_MAX),
        notes: form.notes.trim().slice(0, BLUEPRINT_LIMITS.NOTES_MAX),
      });
      onClose();
    } catch (err) {
      showValidationError(err instanceof Error ? err.message : 'تعذر حفظ الحجز. يرجى المحاولة مجدداً.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-[#1F1F1F]/45 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-modal-title"
    >
      <div
        ref={formBodyRef}
        className="bg-white border border-[#DADCE0] rounded-2xl g-elevation-modal max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between px-6 py-4 bg-[#F8FAFD] border-b border-[#E8EAED]">
          <div>
            <h2 id="booking-modal-title" className="font-display text-lg font-bold text-[#1F1F1F]">
              {form.id ? 'تعديل طلب الحجز' : 'حجز قاعة دراسية'}
            </h2>
            <p className="text-xs text-[#747775] mt-0.5">
              {isAdmin
                ? 'صلاحية الإدارة: يمكنك الموافقة الفورية على الحجز أو إبقائه قيد المراجعة'
                : 'اختر القاعة والتاريخ والوقت المتاح لإرسال طلب الحجز لموافقة الإدارة'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#444746] hover:bg-[#E8EAED]/60 hover:text-[#1F1F1F] transition-colors cursor-pointer"
            aria-label="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="bg-[#FCE8E6] border border-[#F6AEA9] rounded-xl px-4 py-3 text-sm text-[#C5221F] flex items-start gap-2.5" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {conflicts.length > 0 && (
            <div className="bg-[#FEF7E0] border border-[#FDE293] rounded-xl px-4 py-3 text-sm text-[#1F1F1F] space-y-1">
              <div className="font-bold flex items-center gap-2 text-[#B06000]">
                <AlertCircle className="w-4 h-4 text-[#B06000] shrink-0" />
                <span>تنبيه تعارض: هذه القاعة محجوزة في نفس الوقت المحدد</span>
              </div>
              {conflicts.map((c) => (
                <div key={c.id} className="text-xs text-[#444746] pr-6 font-mono-num">
                  محجوزة من {formatTime12Ar(c.startTime)} إلى {formatTime12Ar(c.endTime)} — {c.courseTitle}
                </div>
              ))}
              <div className="text-[11px] text-[#B06000] pr-6">
                يرجى اختيار وقت آخر متاح من الجدول الزمني أدناه أو اختيار قاعة أخرى.
              </div>
            </div>
          )}

          {lockedDepartment && (
            <div className="bg-[#E8F0FE] border border-[#AECBFA] rounded-xl px-4 py-2.5 text-xs text-[#041E49] flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#0B57D0] shrink-0" />
              <span>
                الحجز مخصص لقسمك فقط: <strong className="font-semibold">{lockedDepartment}</strong>
              </span>
            </div>
          )}

          {isMaintenanceRoom && (
            <div className="bg-[#FCE8E6] border border-[#F6AEA9] rounded-xl px-4 py-2.5 text-xs text-[#C5221F]">
              تنبيه: القاعة المحددة قيد الصيانة الفنية حالياً.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Classroom Selection Cards + Dropdown */}
            <div className="sm:col-span-2 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-medium text-[#444746]">
                  القاعات المتاحة للحجز ({classrooms.length})
                </label>
                <span className="text-[11px] text-[#747775]">
                  اضغط على القاعة لاختيارها أو استعرض حالتها للوقت المحدد
                </span>
              </div>

              {classrooms.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-0.5">
                  {classrooms.map((room) => {
                    const isSelected = form.roomId === room.id;
                    const isMaint = room.status === 'maintenance';
                    const roomConflicts = roomConflictMap.get(room.id) || [];
                    const hasRoomConflict = roomConflicts.length > 0;
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => setForm({ ...form, roomId: room.id })}
                        className={`text-right rounded-xl border px-3 py-2.5 transition-colors cursor-pointer ${
                          isSelected
                            ? hasRoomConflict
                              ? 'border-[#B06000] bg-[#FEF7E0]'
                              : 'border-[#0B57D0] bg-[#E8F0FE]'
                            : 'border-[#DADCE0] bg-white hover:bg-[#F8FAFD]'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-bold text-[#1F1F1F] truncate">
                            {room.name}
                          </span>
                          <span className="font-mono-num text-[11px] text-[#747775] shrink-0">
                            {room.code}
                          </span>
                        </div>
                        <div className="mt-1 flex items-center justify-between gap-2 text-[11px]">
                          <span className="text-[#747775] font-mono-num">
                            {room.capacity} مقعد · {room.floor}
                          </span>
                          {isMaint ? (
                            <span className="inline-flex items-center gap-1 text-[#C5221F] font-medium shrink-0">
                              <Wrench className="w-3 h-3" />
                              صيانة
                            </span>
                          ) : hasRoomConflict ? (
                            <span className="inline-flex items-center gap-1 text-[#B06000] font-semibold shrink-0">
                              <AlertCircle className="w-3 h-3" />
                              متعارض بالوقت
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[#137333] font-medium shrink-0">
                              <CheckCircle2 className="w-3 h-3" />
                              متاحة
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              <select
                value={form.roomId}
                onChange={(e) => setForm({ ...form, roomId: e.target.value })}
                aria-label="اختيار القاعة الدراسية"
                className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2 text-xs text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
                required
              >
                <option value="">اختر القاعة...</option>
                {classrooms.map((room) => {
                  const hasRoomConflict = (roomConflictMap.get(room.id) || []).length > 0;
                  return (
                    <option key={room.id} value={room.id}>
                      {room.name} ({room.code} · سعة {room.capacity} طالب
                      {room.status === 'maintenance'
                        ? ' · قيد الصيانة'
                        : hasRoomConflict
                          ? ' · يوجد تعارض في هذا الوقت'
                          : ' · متاحة'}
                      )
                    </option>
                  );
                })}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-[#444746] mb-1.5">
                عنوان المحاضرة / الدورة / النشاط
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.COURSE_TITLE_MAX}
                value={form.courseTitle}
                onChange={(e) => setForm({ ...form, courseTitle: e.target.value })}
                placeholder="مثال: محاضرة تطبيقات الحاسوب المتقدمة"
                className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm text-[#1F1F1F] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#444746] mb-1.5">
                اسم الأستاذ / المحاضر
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.INSTRUCTOR_MAX}
                value={form.instructorName}
                onChange={(e) => setForm({ ...form, instructorName: e.target.value })}
                placeholder="د. / أ. الاسم الكامل"
                className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm text-[#1F1F1F] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#444746] mb-1.5">
                {lockedDepartment
                  ? 'القسم الطالب (قسمك فقط)'
                  : 'القسم الطالب (أقسام العتبة الحسينية المقدسة)'}
              </label>
              {lockedDepartment ? (
                <div className="w-full rounded-xl border border-[#E8EAED] bg-[#F8FAFD] px-3 py-2.5 text-sm font-semibold text-[#1F1F1F]">
                  {lockedDepartment}
                </div>
              ) : (
                <>
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
                    className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
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
                      className="mt-2 w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2 text-sm text-[#1F1F1F] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
                      required
                    />
                  )}
                </>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-[#444746] mb-1.5">
                نوع النشاط
              </label>
              <select
                value={form.bookingType}
                onChange={(e) =>
                  setForm({ ...form, bookingType: e.target.value as BookingType })
                }
                className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
              >
                {(Object.keys(BOOKING_TYPE_LABEL) as BookingType[]).map((t) => (
                  <option key={t} value={t}>
                    {BOOKING_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#444746] mb-1.5">
                التاريخ
              </label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm font-mono-num text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#444746] mb-1.5">
                وقت البدء
              </label>
              <select
                value={form.startTime}
                onChange={(e) => handleStartTimeChange(e.target.value)}
                className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
              >
                {TIME_OPTIONS.slice(0, -1).map((t) => (
                  <option key={t} value={t}>
                    {formatTime12Ar(t)} ({t})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#444746] mb-1.5">
                وقت الانتهاء
              </label>
              <select
                value={form.endTime}
                onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
              >
                {validEndTimeOptions.map((t) => (
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
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors cursor-pointer ${
                      activeDurationMinutes === preset.mins
                        ? 'border-[#0B57D0] bg-[#E8F0FE] text-[#0B57D0] font-semibold'
                        : 'border-[#DADCE0] bg-white text-[#444746] hover:bg-[#F0F4F9]'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Room Daily Times Strip (Shows available vs booked times) */}
            {form.roomId && form.date && (
              <div className="sm:col-span-2 bg-[#F8FAFD] border border-[#E8EAED] rounded-xl p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="font-semibold text-[#1F1F1F] flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#0B57D0]" />
                    <span>
                      أوقات القاعة في يوم <span className="font-mono-num">{form.date}</span>
                    </span>
                  </div>
                  <span className="text-[11px] text-[#747775]">
                    {selectedRoomDayBookings.length === 0
                      ? 'جميع الأوقات متاحة في هذا اليوم'
                      : `يوجد ${selectedRoomDayBookings.length} حجز قائم — اضغط على أي ساعة متاحة لاختيارها`}
                  </span>
                </div>

                <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                  {TIME_OPTIONS.slice(0, -1)
                    .filter((h) => h.endsWith(':00'))
                    .map((hourStr) => {
                      const slotStart = timeToMinutes(hourStr);
                      const slotEnd = slotStart + 60;
                      const busyBooking = selectedRoomDayBookings.find((b) => {
                        const bStart = timeToMinutes(b.startTime);
                        const bEnd = timeToMinutes(b.endTime);
                        return bStart < slotEnd && bEnd > slotStart;
                      });
                      const isInChosenRange =
                        slotStart >= timeToMinutes(form.startTime) &&
                        slotStart < timeToMinutes(form.endTime);

                      return (
                        <button
                          key={hourStr}
                          type="button"
                          onClick={() => handleSelectHourSlot(hourStr)}
                          className={`px-2 py-1.5 rounded-lg border text-[11px] font-mono-num text-center transition-colors cursor-pointer ${
                            busyBooking
                              ? isInChosenRange
                                ? 'border-[#B06000] bg-[#FEF7E0] text-[#B06000] font-semibold'
                                : 'border-[#F6AEA9] bg-[#FCE8E6]/80 text-[#C5221F]'
                              : isInChosenRange
                                ? 'border-[#0B57D0] bg-[#0B57D0] text-white font-semibold'
                                : 'border-[#DADCE0] bg-white text-[#1F1F1F] hover:border-[#0B57D0]/60 hover:bg-[#E8F0FE]/60'
                          }`}
                          title={
                            busyBooking
                              ? `محجوز (${formatTime12Ar(busyBooking.startTime)} – ${formatTime12Ar(busyBooking.endTime)})`
                              : `متاح — اختيار البدء من ${formatTime12Ar(hourStr)}`
                          }
                        >
                          <div>{formatTime12Ar(hourStr)}</div>
                          <div className="text-[10px] opacity-85">
                            {busyBooking ? 'محجوز' : 'متاح'}
                          </div>
                        </button>
                      );
                    })}
                </div>

                {conflicts.length > 0 && (
                  <div className="bg-[#FEF7E0] border border-[#FDE293] rounded-xl px-3 py-2 text-xs text-[#1F1F1F] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-[#B06000] shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold text-[#B06000]">تعارض في نفس الوقت: </span>
                      <span>
                        الفترة من {formatTime12Ar(form.startTime)} إلى {formatTime12Ar(form.endTime)} تتقاطع مع حجز قائم (
                        {formatTime12Ar(conflicts[0].startTime)} – {formatTime12Ar(conflicts[0].endTime)}). اختر ساعة «متاح» أعلاه.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#444746] mb-1.5">
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
                  className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm font-mono-num text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
                  required
                />
                {selectedRoom && (
                  <span className="mt-1 flex items-center gap-1 text-xs text-[#747775]">
                    <Users className="w-3.5 h-3.5" />
                    السعة القصوى للقاعة: {selectedRoom.capacity} طالب
                  </span>
                )}
              </div>
              {capacityExceeded && (
                <p className="text-xs text-[#B06000] mt-1">
                  تنبيه: العدد يتجاوز السعة الاستيعابية للقاعة.
                </p>
              )}
            </div>

            {isAdmin && (
              <div>
                <label className="block text-xs font-medium text-[#444746] mb-1.5">
                  حالة الحجز
                </label>
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm({ ...form, status: e.target.value as BookingStatus })
                  }
                  className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
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
              <label className="block text-xs font-medium text-[#444746] mb-1.5">
                متطلبات تقنية أو ملاحظات (اختياري)
              </label>
              <textarea
                rows={2}
                maxLength={BLUEPRINT_LIMITS.NOTES_MAX}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="مثال: الحاجة إلى ميكروفون لاسلكي إضافي أو ربط العرض اللاسلكي..."
                className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2 text-sm text-[#1F1F1F] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15 resize-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 bg-[#F8FAFD] -mx-6 -mb-6 px-6 py-4 border-t border-[#E8EAED] rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#DADCE0] bg-white text-sm font-medium text-[#1F1F1F] hover:bg-[#F0F4F9] transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className={`px-5 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-50 g-elevation-1 transition-colors cursor-pointer ${
                conflicts.length > 0
                  ? 'bg-[#B06000] hover:bg-[#8F4E00]'
                  : 'bg-[#0B57D0] hover:bg-[#0842A0]'
              }`}
            >
              {saving
                ? 'جاري الإرسال...'
                : conflicts.length > 0
                  ? 'يوجد تعارض زمني — راجع الوقت'
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
