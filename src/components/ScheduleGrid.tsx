import { useEffect, useMemo, useState } from 'react';
import {
  BellRing,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Plus,
  Printer,
  Wrench,
} from 'lucide-react';
import { Booking, Classroom } from '../types';
import {
  ARABIC_WEEKDAYS_SAT_START,
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  TIMELINE_HOURS,
  addDaysISO,
  calculateDurationHours,
  formatArabicDate,
  formatArabicMonthYear,
  formatShortArabicDate,
  formatTime12Ar,
  getMonthCalendarCells,
  getWeekDates,
  isActiveBooking,
  shiftMonthISO,
  timeToMinutes,
} from '../utils/schedule';

interface ScheduleGridProps {
  classrooms: Classroom[];
  bookings: Booking[];
  selectedDate: string;
  onDateChange: (dateISO: string) => void;
  onQuickBook: (roomId: string, date: string, startTime: string, endTime: string) => void;
  onSelectBooking: (booking: Booking) => void;
  isLoading: boolean;
  canQuickBook?: boolean;
  workStartHour?: string;
  workEndHour?: string;
  reportHeaderTitle?: string;
}

export function ScheduleGrid({
  classrooms,
  bookings,
  selectedDate,
  onDateChange,
  onQuickBook,
  onSelectBooking,
  isLoading,
  canQuickBook = true,
  workStartHour = '08:00',
  workEndHour = '21:00',
  reportHeaderTitle,
}: ScheduleGridProps) {
  const [mode, setMode] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [roomFilter, setRoomFilter] = useState<string>('all');
  const [nowTick, setNowTick] = useState<Date>(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNowTick(new Date());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const todayISO = useMemo(() => {
    const y = nowTick.getFullYear();
    const m = String(nowTick.getMonth() + 1).padStart(2, '0');
    const d = String(nowTick.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }, [nowTick]);

  const nowMinutes = nowTick.getHours() * 60 + nowTick.getMinutes();

  const weekDates = useMemo(() => getWeekDates(selectedDate), [selectedDate]);
  const monthCells = useMemo(() => getMonthCalendarCells(selectedDate), [selectedDate]);

  const visibleTimelineHours = useMemo(() => {
    const startMin = timeToMinutes(workStartHour);
    const endMin = timeToMinutes(workEndHour);
    const filtered = TIMELINE_HOURS.filter((h) => {
      const m = timeToMinutes(h);
      return m >= startMin && m < endMin;
    });
    return filtered.length > 0 ? filtered : TIMELINE_HOURS;
  }, [workStartHour, workEndHour]);

  const activeBookings = useMemo(
    () => bookings.filter(isActiveBooking),
    [bookings]
  );

  // Detect bookings starting within the next 60 minutes (inclusive of 0..60 min window)
  const { imminentByRoom, imminentBookingIds, imminentList } = useMemo(() => {
    const byRoom = new Map<string, { booking: Booking; minutesUntil: number }>();
    const bookingIds = new Map<string, number>();
    const list: { booking: Booking; minutesUntil: number }[] = [];

    for (const b of activeBookings) {
      if (b.date !== todayISO) continue;
      const diff = timeToMinutes(b.startTime) - nowMinutes;
      if (diff >= 0 && diff <= 60) {
        bookingIds.set(b.id, diff);
        list.push({ booking: b, minutesUntil: diff });
        const existing = byRoom.get(b.roomId);
        if (!existing || diff < existing.minutesUntil) {
          byRoom.set(b.roomId, { booking: b, minutesUntil: diff });
        }
      }
    }

    list.sort((a, b) => a.minutesUntil - b.minutesUntil);
    return {
      imminentByRoom: byRoom,
      imminentBookingIds: bookingIds,
      imminentList: list,
    };
  }, [activeBookings, todayISO, nowMinutes]);

  const dayBookings = useMemo(
    () =>
      activeBookings
        .filter((b) => b.date === selectedDate)
        .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime)),
    [activeBookings, selectedDate]
  );

  const weeklyFilteredBookings = useMemo(() => {
    const dateSet = new Set(weekDates);
    return activeBookings
      .filter(
        (b) =>
          dateSet.has(b.date) &&
          (roomFilter === 'all' || b.roomId === roomFilter)
      )
      .sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
  }, [activeBookings, weekDates, roomFilter]);

  const weeklyVisibleClassrooms = useMemo(
    () =>
      roomFilter === 'all'
        ? classrooms
        : classrooms.filter((r) => r.id === roomFilter),
    [classrooms, roomFilter]
  );

  const { weeklyByRoomAndDate, weeklyStats, weeklyStatsByRoom } = useMemo(() => {
    const cellMap = new Map<string, Booking[]>();
    const roomStats = new Map<string, { count: number; hours: number }>();
    let total = 0;
    let confirmed = 0;
    let pending = 0;
    let totalHours = 0;

    for (const b of weeklyFilteredBookings) {
      const key = `${b.roomId}__${b.date}`;
      const existing = cellMap.get(key) || [];
      existing.push(b);
      cellMap.set(key, existing);

      const dur = calculateDurationHours(b.startTime, b.endTime);
      total += 1;
      totalHours += dur;
      if (b.status === 'confirmed') confirmed += 1;
      else if (b.status === 'pending') pending += 1;

      const rs = roomStats.get(b.roomId) || { count: 0, hours: 0 };
      rs.count += 1;
      rs.hours = Math.round((rs.hours + dur) * 10) / 10;
      roomStats.set(b.roomId, rs);
    }

    return {
      weeklyByRoomAndDate: cellMap,
      weeklyStats: {
        total,
        confirmed,
        pending,
        totalHours: Math.round(totalHours * 10) / 10,
      },
      weeklyStatsByRoom: roomStats,
    };
  }, [weeklyFilteredBookings]);

  const monthlyBookingsByDate = useMemo(() => {
    const map = new Map<string, Booking[]>();
    const cellDates = new Set(monthCells.map((c) => c.dateISO));
    for (const b of activeBookings) {
      if (!cellDates.has(b.date)) continue;
      if (roomFilter !== 'all' && b.roomId !== roomFilter) continue;
      const existing = map.get(b.date) || [];
      existing.push(b);
      map.set(b.date, existing);
    }
    for (const [, list] of map) {
      list.sort((a, b) => timeToMinutes(a.startTime) - timeToMinutes(b.startTime));
    }
    return map;
  }, [activeBookings, monthCells, roomFilter]);

  const currentMonthStats = useMemo(() => {
    let total = 0;
    let confirmed = 0;
    let pending = 0;
    for (const cell of monthCells) {
      if (!cell.isCurrentMonth) continue;
      const list = monthlyBookingsByDate.get(cell.dateISO) || [];
      total += list.length;
      for (const b of list) {
        if (b.status === 'confirmed') confirmed += 1;
        else if (b.status === 'pending') pending += 1;
      }
    }
    return { total, confirmed, pending };
  }, [monthCells, monthlyBookingsByDate]);

  const handleOpenDaySchedule = (dateISO: string) => {
    onDateChange(dateISO);
    setMode('daily');
  };

  const handleStepPeriod = (direction: -1 | 1) => {
    if (mode === 'daily') {
      onDateChange(addDaysISO(selectedDate, direction));
    } else if (mode === 'weekly') {
      onDateChange(addDaysISO(selectedDate, direction * 7));
    } else {
      onDateChange(shiftMonthISO(selectedDate, direction));
    }
  };

  const findBookingAtHour = (roomId: string, hourStr: string): Booking | undefined => {
    const slotStart = timeToMinutes(hourStr);
    const slotEnd = slotStart + 60;
    return dayBookings.find((b) => {
      if (b.roomId !== roomId) return false;
      const bStart = timeToMinutes(b.startTime);
      const bEnd = timeToMinutes(b.endTime);
      return bStart < slotEnd && bEnd > slotStart;
    });
  };

  const nextHourString = (hourStr: string): string => {
    const [h] = hourStr.split(':').map(Number);
    return `${String(Math.min(21, h + 1)).padStart(2, '0')}:00`;
  };

  if (isLoading) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="h-8 bg-slate-100 rounded-lg w-64" />
        <div className="h-96 bg-slate-50 border border-slate-100 rounded-lg" />
      </div>
    );
  }

  return (
    <section className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div className="flex flex-wrap items-center gap-3">
          {/* Segmented View Switch */}
          <div className="inline-flex items-center p-1 bg-slate-100 rounded-lg">
            <button
              type="button"
              onClick={() => setMode('daily')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'daily'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الجدول اليومي
            </button>
            <button
              type="button"
              onClick={() => setMode('weekly')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'weekly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              الجدول الأسبوعي
            </button>
            <button
              type="button"
              onClick={() => setMode('monthly')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'monthly'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              التقويم الشهري
            </button>
          </div>

          {/* Date Stepper */}
          <div className="flex items-center gap-1 border border-slate-200 rounded-lg p-1 bg-white">
            <button
              type="button"
              onClick={() => handleStepPeriod(-1)}
              className="p-1.5 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label={mode === 'monthly' ? 'الشهر السابق' : 'الفترة السابقة'}
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => onDateChange(todayISO)}
              className="px-2.5 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50 rounded transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              اليوم
            </button>
            <button
              type="button"
              onClick={() => handleStepPeriod(1)}
              className="p-1.5 rounded text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
              aria-label={mode === 'monthly' ? 'الشهر التالي' : 'الفترة التالية'}
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && onDateChange(e.target.value)}
              className="text-xs font-mono-num border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-800 focus:outline-none focus:border-teal-700"
              aria-label="تاريخ الجدول"
            />
            <span className="hidden sm:inline text-sm font-medium text-slate-700">
              {mode === 'daily'
                ? formatArabicDate(selectedDate)
                : mode === 'weekly'
                ? `${formatShortArabicDate(weekDates[0])} — ${formatShortArabicDate(
                    weekDates[6]
                  )}`
                : formatArabicMonthYear(selectedDate)}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {(mode === 'weekly' || mode === 'monthly') && (
            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="text-xs border border-slate-200 rounded-lg px-3 py-2 bg-white text-slate-800 focus:outline-none focus:border-teal-700"
              aria-label="تصفية حسب القاعة"
            >
              <option value="all">جميع القاعات ({classrooms.length})</option>
              {classrooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          )}

          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span>طباعة الجدول</span>
          </button>
        </div>
      </div>

      {/* Print header */}
      <div className="hidden print:block mb-4 border-b border-slate-300 pb-3">
        <h1 className="font-display text-xl font-bold text-slate-900">
          {reportHeaderTitle || 'جدول القاعات الدراسية — قسم مجمع سيد الشهداء (ع) الخدمي'}
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          {mode === 'daily'
            ? formatArabicDate(selectedDate)
            : mode === 'weekly'
            ? `الأسبوع: ${formatShortArabicDate(weekDates[0])} إلى ${formatShortArabicDate(weekDates[6])}`
            : `التقويم الشهري: ${formatArabicMonthYear(selectedDate)}`}
        </p>
      </div>

      {/* Field Follow-Up Imminent Alerts Banner (Next 60 Minutes) */}
      {imminentList.length > 0 && (
        <div
          className="bg-amber-50/70 border border-amber-200 rounded-xl p-4 space-y-2.5 no-print"
          role="region"
          aria-label="تنبيهات المتابعة الميدانية خلال 60 دقيقة"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-amber-900">
              <BellRing className="w-4 h-4 text-amber-700 shrink-0" />
              <span>تنبيه المتابعة الميدانية: قاعات لديها حجز وشيك خلال 60 دقيقة</span>
            </div>
            <span className="font-mono-num text-xs font-semibold text-amber-800">
              {imminentList.length} {imminentList.length === 1 ? 'حجز وشيك' : 'حجوزات وشيكة'}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {imminentList.map(({ booking, minutesUntil }) => (
              <button
                key={booking.id}
                type="button"
                onClick={() => {
                  if (selectedDate !== todayISO) {
                    onDateChange(todayISO);
                  }
                  onSelectBooking(booking);
                }}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-amber-200 hover:border-amber-400 text-xs text-slate-900 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <BellRing className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                <span className="font-semibold">{booking.roomName}</span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="text-slate-600 truncate max-w-[180px]">
                  {booking.courseTitle}
                </span>
                <span aria-hidden="true" className="text-slate-300">
                  ·
                </span>
                <span className="font-mono-num font-semibold text-amber-800">
                  {minutesUntil === 0 ? 'يبدأ الآن' : `بعد ${minutesUntil} د`}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {classrooms.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
          <p className="text-sm font-medium text-slate-700">
            لا توجد قاعات مضافة في النظام حتى الآن.
          </p>
          <p className="text-xs text-slate-500 mt-1">
            يمكن لمدير القسم إضافة القاعات المجهزة من تبويب القاعات المجهزة.
          </p>
        </div>
      ) : mode === 'daily' ? (
        /* Daily Room x Hour Matrix */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[780px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-28 px-4 py-3 text-right text-xs font-semibold text-slate-600 border-l border-slate-200">
                    الساعة
                  </th>
                  {classrooms.map((room) => {
                    const imminent = imminentByRoom.get(room.id);
                    return (
                      <th
                        key={room.id}
                        className={`px-4 py-3 text-right border-l last:border-l-0 border-slate-200 min-w-[210px] ${
                          imminent ? 'bg-amber-50/50' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-display text-sm font-bold text-slate-900 truncate">
                              {room.name}
                            </span>
                            {imminent && (
                              <button
                                type="button"
                                onClick={() => onSelectBooking(imminent.booking)}
                                className="inline-flex items-center justify-center p-1 rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors shrink-0 cursor-pointer no-print"
                                title={`تنبيه حجز وشيك خلال ${imminent.minutesUntil} دقيقة: ${imminent.booking.courseTitle}`}
                                aria-label={`تنبيه متابعة ميدانية لقاعة ${room.name}: حجز وشيك خلال ${imminent.minutesUntil} دقيقة`}
                              >
                                <BellRing className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <span className="font-mono-num text-[11px] text-slate-500 shrink-0">
                            {room.code}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 font-normal mt-0.5 flex flex-wrap items-center gap-1.5">
                          <span>{room.capacity} مقعد</span>
                          <span aria-hidden="true">·</span>
                          {room.status === 'maintenance' ? (
                            <span className="text-red-700 inline-flex items-center gap-1">
                              <Wrench className="w-3 h-3" />
                              قيد الصيانة
                            </span>
                          ) : (
                            <span className="text-teal-800">جاهزة</span>
                          )}
                          {imminent && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="font-mono-num font-semibold text-amber-800">
                                {imminent.minutesUntil === 0
                                  ? 'حجز يبدأ الآن'
                                  : `حجز بعد ${imminent.minutesUntil} د`}
                              </span>
                            </>
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleTimelineHours.map((hour) => (
                  <tr key={hour} className="hover:bg-slate-50/40 transition-colors">
                    <td className="px-4 py-3 text-xs font-mono-num font-medium text-slate-600 border-l border-slate-200 bg-slate-50/40 whitespace-nowrap">
                      {formatTime12Ar(hour)}
                    </td>
                    {classrooms.map((room) => {
                      const booking = findBookingAtHour(room.id, hour);
                      const isStartSlot =
                        booking &&
                        timeToMinutes(booking.startTime) >= timeToMinutes(hour) &&
                        timeToMinutes(booking.startTime) < timeToMinutes(hour) + 60;

                      if (booking) {
                        const isConfirmed = booking.status === 'confirmed';
                        const imminentMins = imminentBookingIds.get(booking.id);
                        return (
                          <td
                            key={room.id}
                            className="p-1.5 border-l last:border-l-0 border-slate-100 align-top"
                          >
                            <button
                              type="button"
                              onClick={() => onSelectBooking(booking)}
                              className={`w-full text-right rounded-lg px-3 py-2 border transition-colors cursor-pointer ${
                                imminentMins !== undefined
                                  ? 'bg-amber-50/90 border-amber-300 hover:bg-amber-50'
                                  : isConfirmed
                                  ? 'bg-teal-50/80 border-teal-200 hover:bg-teal-50'
                                  : 'bg-amber-50/80 border-amber-200 hover:bg-amber-50'
                              }`}
                            >
                              {isStartSlot ? (
                                <>
                                  <div className="flex items-center justify-between gap-2 text-[11px]">
                                    <span className="font-mono-num text-slate-600">
                                      {formatTime12Ar(booking.startTime)} –{' '}
                                      {formatTime12Ar(booking.endTime)}
                                    </span>
                                    <span
                                      className={`inline-flex items-center gap-1 font-medium ${
                                        imminentMins !== undefined
                                          ? 'text-amber-800'
                                          : isConfirmed
                                          ? 'text-teal-800'
                                          : 'text-amber-800'
                                      }`}
                                    >
                                      {imminentMins !== undefined ? (
                                        <BellRing className="w-3 h-3" />
                                      ) : isConfirmed ? (
                                        <CheckCircle2 className="w-3 h-3" />
                                      ) : (
                                        <Clock className="w-3 h-3" />
                                      )}
                                      {imminentMins !== undefined
                                        ? imminentMins === 0
                                          ? 'يبدأ الآن'
                                          : `خلال ${imminentMins} د`
                                        : BOOKING_STATUS_LABEL[booking.status]}
                                    </span>
                                  </div>
                                  <div className="text-xs font-semibold text-slate-900 mt-1 line-clamp-1">
                                    {booking.courseTitle}
                                  </div>
                                  <div className="text-[11px] text-slate-600 mt-0.5 line-clamp-1">
                                    {booking.instructorName} · {booking.department}
                                  </div>
                                </>
                              ) : (
                                <div className="text-[11px] text-slate-600 flex items-center justify-between">
                                  <span className="truncate font-medium text-slate-800">
                                    استمرار: {booking.courseTitle}
                                  </span>
                                  <span className="font-mono-num text-[10px] text-slate-500 shrink-0 mr-2">
                                    حتى {formatTime12Ar(booking.endTime)}
                                  </span>
                                </div>
                              )}
                            </button>
                          </td>
                        );
                      }

                      if (room.status === 'maintenance') {
                        return (
                          <td
                            key={room.id}
                            className="p-1.5 border-l last:border-l-0 border-slate-100 bg-slate-50/70"
                          >
                            <div className="px-3 py-2 text-[11px] text-slate-400">
                              متوقفة للصيانة
                            </div>
                          </td>
                        );
                      }

                      return (
                        <td
                          key={room.id}
                          className="p-1.5 border-l last:border-l-0 border-slate-100"
                        >
                          {canQuickBook ? (
                            <button
                              type="button"
                              onClick={() =>
                                onQuickBook(
                                  room.id,
                                  selectedDate,
                                  hour,
                                  nextHourString(hour)
                                )
                              }
                              className="w-full h-11 rounded-lg border border-transparent hover:border-dashed hover:border-teal-400 hover:bg-teal-50/40 text-transparent hover:text-teal-800 flex items-center justify-center gap-1 text-xs font-medium transition-colors cursor-pointer group"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>حجز الفترة</span>
                            </button>
                          ) : (
                            <div className="h-11 flex items-center justify-center text-[11px] text-slate-300">
                              متاح
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : mode === 'weekly' ? (
        /* Detailed Classroom x 7-Day Week View */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Week Summary Header */}
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-display text-sm font-bold text-slate-900">
                أسبوع: {formatShortArabicDate(weekDates[0])} — {formatShortArabicDate(weekDates[6])}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="font-mono-num">
                {weeklyStats.total} حجوزات ({weeklyStats.totalHours} س)
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="font-mono-num text-teal-800">
                {weeklyStats.confirmed} موافق عليها
              </span>
              {weeklyStats.pending > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="font-mono-num text-amber-700">
                    {weeklyStats.pending} بانتظار الموافقة
                  </span>
                </>
              )}
            </div>
            <div className="text-[11px] text-slate-500 no-print">
              توزيع تفصيلي للحجوزات لكل قاعة · انقر على اسم اليوم لعرض جدوله الكامل
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse min-w-[1160px]">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="w-52 px-4 py-3 text-right text-xs font-semibold text-slate-700 border-l border-slate-200 bg-slate-50">
                    القاعة الدراسية
                  </th>
                  {weekDates.map((dateISO) => {
                    const isToday = dateISO === todayISO;
                    return (
                      <th
                        key={dateISO}
                        className={`px-3 py-2.5 text-right border-l last:border-l-0 border-slate-200 min-w-[148px] ${
                          isToday ? 'bg-teal-50/70' : ''
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleOpenDaySchedule(dateISO)}
                          className="w-full text-right group/day cursor-pointer"
                          title="الانتقال إلى الجدول اليومي لهذا اليوم"
                        >
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-xs font-bold text-slate-900 group-hover/day:text-teal-800 transition-colors">
                              {formatShortArabicDate(dateISO)}
                            </span>
                            {isToday && (
                              <span className="text-[10px] font-semibold text-teal-800">
                                اليوم
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-mono-num text-slate-500 font-normal mt-0.5">
                            {dateISO}
                          </div>
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {weeklyVisibleClassrooms.map((room) => {
                  const imminent = imminentByRoom.get(room.id);
                  const roomWeekStat = weeklyStatsByRoom.get(room.id) || { count: 0, hours: 0 };
                  return (
                    <tr key={room.id} className="align-top">
                      {/* Classroom Column */}
                      <td
                        className={`px-4 py-3 border-l border-slate-200 ${
                          imminent ? 'bg-amber-50/40' : 'bg-slate-50/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="font-display text-xs font-bold text-slate-900 truncate">
                              {room.name}
                            </span>
                            {imminent && (
                              <button
                                type="button"
                                onClick={() => onSelectBooking(imminent.booking)}
                                className="inline-flex items-center justify-center p-1 rounded-md bg-amber-100 text-amber-800 hover:bg-amber-200 transition-colors shrink-0 cursor-pointer no-print"
                                title={`تنبيه حجز وشيك خلال ${imminent.minutesUntil} دقيقة: ${imminent.booking.courseTitle}`}
                                aria-label={`تنبيه متابعة ميدانية لقاعة ${room.name}`}
                              >
                                <BellRing className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <span className="font-mono-num text-[10px] text-slate-500 shrink-0">
                            {room.code}
                          </span>
                        </div>

                        <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-1">
                          <span>{room.capacity} مقعد</span>
                          <span aria-hidden="true">·</span>
                          {room.status === 'maintenance' ? (
                            <span className="text-red-700 inline-flex items-center gap-1">
                              <Wrench className="w-3 h-3" />
                              صيانة
                            </span>
                          ) : (
                            <span className="text-teal-800">جاهزة</span>
                          )}
                        </div>

                        <div className="text-[11px] font-mono-num text-slate-600 mt-2 pt-2 border-t border-slate-200/70">
                          {roomWeekStat.count} {roomWeekStat.count === 1 ? 'حجز' : 'حجوزات'} ·{' '}
                          {roomWeekStat.hours} س
                        </div>
                      </td>

                      {/* 7 Days for this Classroom */}
                      {weekDates.map((dateISO) => {
                        const cellList =
                          weeklyByRoomAndDate.get(`${room.id}__${dateISO}`) || [];
                        const isToday = dateISO === todayISO;
                        return (
                          <td
                            key={dateISO}
                            className={`p-2 border-l last:border-l-0 border-slate-100 align-top min-h-[110px] ${
                              isToday ? 'bg-teal-50/20' : ''
                            }`}
                          >
                            <div className="space-y-1.5">
                              {cellList.map((b) => {
                                const isConfirmed = b.status === 'confirmed';
                                const imminentMins = imminentBookingIds.get(b.id);
                                return (
                                  <button
                                    key={b.id}
                                    type="button"
                                    onClick={() => onSelectBooking(b)}
                                    className={`w-full text-right p-2 rounded-lg border transition-colors cursor-pointer ${
                                      imminentMins !== undefined
                                        ? 'bg-amber-50/90 border-amber-300 hover:border-amber-500'
                                        : isConfirmed
                                        ? 'bg-teal-50/70 border-teal-200 hover:border-teal-400'
                                        : 'bg-amber-50/70 border-amber-200 hover:border-amber-400'
                                    }`}
                                  >
                                    <div className="flex items-center justify-between gap-1 text-[10px] font-mono-num font-medium">
                                      <span className="text-teal-900">
                                        {formatTime12Ar(b.startTime)} –{' '}
                                        {formatTime12Ar(b.endTime)}
                                      </span>
                                      {imminentMins !== undefined ? (
                                        <span className="inline-flex items-center gap-0.5 text-amber-800 font-semibold shrink-0">
                                          <BellRing className="w-2.5 h-2.5" />
                                          <span>
                                            {imminentMins === 0 ? 'الآن' : `${imminentMins} د`}
                                          </span>
                                        </span>
                                      ) : (
                                        <span
                                          className={`shrink-0 ${
                                            isConfirmed ? 'text-teal-800' : 'text-amber-800'
                                          }`}
                                        >
                                          {isConfirmed ? 'معتمد' : 'مراجعة'}
                                        </span>
                                      )}
                                    </div>
                                    <div className="text-xs font-semibold text-slate-900 mt-1 line-clamp-2">
                                      {b.courseTitle}
                                    </div>
                                    <div className="text-[11px] text-slate-600 mt-0.5 truncate">
                                      {b.instructorName}
                                    </div>
                                    <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                      {b.department} · {BOOKING_TYPE_LABEL[b.bookingType]}
                                    </div>
                                  </button>
                                );
                              })}

                              {room.status === 'maintenance' ? (
                                cellList.length === 0 && (
                                  <div className="py-4 text-center text-[11px] text-slate-400">
                                    صيانة
                                  </div>
                                )
                              ) : canQuickBook ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onQuickBook(room.id, dateISO, '09:00', '11:00')
                                  }
                                  className={`w-full rounded-lg border border-transparent hover:border-dashed hover:border-teal-400 hover:bg-teal-50/40 text-slate-400 hover:text-teal-800 flex items-center justify-center gap-1 text-[11px] font-medium transition-colors cursor-pointer no-print ${
                                    cellList.length === 0 ? 'py-5' : 'py-1.5'
                                  }`}
                                  title={`إضافة حجز في ${room.name} يوم ${dateISO}`}
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>حجز</span>
                                </button>
                              ) : (
                                cellList.length === 0 && (
                                  <div className="py-4 text-center text-[11px] text-slate-300">
                                    متاح
                                  </div>
                                )
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Monthly Calendar View */
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Month Summary Header */}
          <div className="px-4 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-slate-50/60">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
              <span className="font-display text-sm font-bold text-slate-900">
                {formatArabicMonthYear(selectedDate)}
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="font-mono-num">
                {currentMonthStats.total} حجوزات في الشهر
              </span>
              <span aria-hidden="true" className="text-slate-300">
                ·
              </span>
              <span className="font-mono-num text-teal-800">
                {currentMonthStats.confirmed} موافق عليها
              </span>
              {currentMonthStats.pending > 0 && (
                <>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="font-mono-num text-amber-700">
                    {currentMonthStats.pending} بانتظار الموافقة
                  </span>
                </>
              )}
            </div>
            <div className="text-[11px] text-slate-500 no-print">
              انقر على أي يوم للانتقال إلى الجدول اليومي
            </div>
          </div>

          <div className="overflow-x-auto">
            <div className="min-w-[820px]">
              {/* 7-Day Weekday Headers */}
              <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200">
                {ARABIC_WEEKDAYS_SAT_START.map((dayName) => (
                  <div
                    key={dayName}
                    className="px-3 py-2.5 text-center text-xs font-semibold text-slate-600 border-l last:border-l-0 border-slate-200"
                  >
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Calendar Grid Cells */}
              <div className="grid grid-cols-7">
                {monthCells.map((cell, index) => {
                  const list = monthlyBookingsByDate.get(cell.dateISO) || [];
                  const isToday = cell.dateISO === todayISO;
                  const isSelected = cell.dateISO === selectedDate;
                  const visibleBookings = list.slice(0, 3);
                  const hiddenCount = Math.max(0, list.length - visibleBookings.length);
                  const isLastRow = index >= monthCells.length - 7;

                  return (
                    <div
                      key={cell.dateISO}
                      onClick={() => handleOpenDaySchedule(cell.dateISO)}
                      className={`group min-h-[132px] p-2 border-l border-b border-slate-200 [&:nth-child(7n)]:border-l-0 ${
                        isLastRow ? 'border-b-0' : ''
                      } flex flex-col transition-colors cursor-pointer ${
                        isToday
                          ? 'bg-teal-50/40 hover:bg-teal-50/70'
                          : cell.isCurrentMonth
                          ? 'bg-white hover:bg-slate-50/70'
                          : 'bg-slate-50/60 hover:bg-slate-100/60'
                      } ${isSelected ? 'ring-1 ring-inset ring-teal-600' : ''}`}
                    >
                      {/* Cell Header: Day Number + Count + Quick Add */}
                      <div className="flex items-center justify-between gap-1 mb-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenDaySchedule(cell.dateISO);
                          }}
                          className={`inline-flex items-center gap-1.5 text-xs font-mono-num font-semibold transition-colors cursor-pointer ${
                            isToday
                              ? 'text-teal-800'
                              : cell.isCurrentMonth
                              ? 'text-slate-900 hover:text-teal-800'
                              : 'text-slate-400 hover:text-slate-700'
                          }`}
                          aria-label={`عرض الجدول اليومي ليوم ${formatArabicDate(cell.dateISO)}`}
                        >
                          <span>{cell.dayNumber}</span>
                          {isToday && (
                            <span className="font-sans text-[10px] font-medium text-teal-800">
                              اليوم
                            </span>
                          )}
                        </button>

                        <div className="flex items-center gap-1">
                          {list.length > 0 && (
                            <span className="text-[10px] font-mono-num text-slate-400">
                              {list.length}
                            </span>
                          )}
                          {canQuickBook && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onQuickBook(
                                  roomFilter !== 'all'
                                    ? roomFilter
                                    : classrooms[0]?.id || '',
                                  cell.dateISO,
                                  '09:00',
                                  '11:00'
                                );
                              }}
                              className="p-1 rounded text-slate-400 opacity-0 group-hover:opacity-100 focus:opacity-100 hover:text-teal-800 hover:bg-white transition-all cursor-pointer no-print"
                              title="إضافة حجز في هذا اليوم"
                              aria-label={`إضافة حجز في ${cell.dateISO}`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Bookings Preview List */}
                      <div className="space-y-1 flex-1">
                        {visibleBookings.map((b) => {
                          const isConfirmed = b.status === 'confirmed';
                          const imminentMins = imminentBookingIds.get(b.id);
                          return (
                            <button
                              key={b.id}
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectBooking(b);
                              }}
                              className={`w-full text-right px-2 py-1 rounded-md border text-[11px] transition-colors cursor-pointer block ${
                                imminentMins !== undefined
                                  ? 'bg-amber-50/90 border-amber-300 text-slate-900 hover:bg-amber-100/70'
                                  : isConfirmed
                                  ? 'bg-teal-50/80 border-teal-200 text-slate-900 hover:bg-teal-100/70'
                                  : 'bg-amber-50/80 border-amber-200 text-slate-900 hover:bg-amber-100/70'
                              }`}
                              title={`${b.courseTitle} — ${b.roomName} (${formatTime12Ar(
                                b.startTime
                              )} – ${formatTime12Ar(b.endTime)})`}
                            >
                              <div className="flex items-center justify-between gap-1">
                                <span className="font-mono-num text-[10px] text-slate-600 shrink-0">
                                  {formatTime12Ar(b.startTime)}
                                </span>
                                {imminentMins !== undefined ? (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-amber-800 shrink-0">
                                    <BellRing className="w-2.5 h-2.5" />
                                    <span>{imminentMins === 0 ? 'الآن' : `${imminentMins} د`}</span>
                                  </span>
                                ) : (
                                  <span
                                    className={`text-[10px] font-medium shrink-0 ${
                                      isConfirmed ? 'text-teal-800' : 'text-amber-800'
                                    }`}
                                  >
                                    {isConfirmed ? 'معتمد' : 'مراجعة'}
                                  </span>
                                )}
                              </div>
                              <div className="font-semibold text-slate-900 truncate mt-0.5">
                                {b.courseTitle}
                              </div>
                              <div className="text-[10px] text-slate-500 truncate">
                                {b.roomName}
                              </div>
                            </button>
                          );
                        })}

                        {hiddenCount > 0 && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenDaySchedule(cell.dateISO);
                            }}
                            className="w-full text-right px-2 py-1 text-[11px] font-medium text-teal-800 hover:text-teal-900 hover:bg-teal-50/60 rounded-md transition-colors cursor-pointer"
                          >
                            + {hiddenCount} حجوزات أخرى · عرض اليوم
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
