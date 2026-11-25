import { Booking, Classroom } from '../types';
import {
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  calculateDurationHours,
  formatArabicDate,
  formatArabicMonthYear,
  formatShortArabicDate,
  formatTime12Ar,
  getMonthCalendarCells,
  getWeekDates,
  isActiveBooking,
  timeToMinutes,
} from '../utils/schedule';

export type BulletinBoardMode = 'daily' | 'weekly' | 'monthly';

interface BulletinBoardSheetProps {
  mode: BulletinBoardMode;
  selectedDate: string;
  classrooms: Classroom[];
  bookings: Booking[];
  roomFilter: string;
  confirmedOnly: boolean;
  workStartHour: string;
  workEndHour: string;
  reportHeaderTitle?: string;
  organizationName?: string;
  reportFooterNote?: string;
  printedAtLabel: string;
}

export function BulletinBoardSheet({
  mode,
  selectedDate,
  classrooms,
  bookings,
  roomFilter,
  confirmedOnly,
  workStartHour,
  workEndHour,
  reportHeaderTitle,
  organizationName,
  reportFooterNote,
  printedAtLabel,
}: BulletinBoardSheetProps) {
  const weekDates = getWeekDates(selectedDate);
  const monthCells = getMonthCalendarCells(selectedDate);
  const monthPrefix = selectedDate.slice(0, 7);

  const visibleClassrooms =
    (mode === 'weekly' || mode === 'monthly') && roomFilter !== 'all'
      ? classrooms.filter((r) => r.id === roomFilter)
      : classrooms;

  const eligibleBookings = bookings.filter((b) => {
    if (!isActiveBooking(b)) return false;
    if (confirmedOnly && b.status !== 'confirmed') return false;
    if ((mode === 'weekly' || mode === 'monthly') && roomFilter !== 'all' && b.roomId !== roomFilter) {
      return false;
    }
    return true;
  });

  const scopedBookings = eligibleBookings
    .filter((b) => {
      if (mode === 'daily') return b.date === selectedDate;
      if (mode === 'weekly') return weekDates.includes(b.date);
      return b.date.startsWith(monthPrefix) || monthCells.some((c) => c.isCurrentMonth && c.dateISO === b.date);
    })
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
    });

  const totalHours =
    Math.round(
      scopedBookings.reduce(
        (sum, b) => sum + calculateDurationHours(b.startTime, b.endTime),
        0
      ) * 10
    ) / 10;

  const periodHeading =
    mode === 'daily'
      ? `الجدول اليومي — ${formatArabicDate(selectedDate)}`
      : mode === 'weekly'
        ? `الجدول الأسبوعي — من ${formatShortArabicDate(weekDates[0])} إلى ${formatShortArabicDate(weekDates[6])}`
        : `الجدول الشهري — ${formatArabicMonthYear(selectedDate)}`;

  return (
    <div
      dir="rtl"
      className="bg-white text-[#1F1F1F] p-5 sm:p-6 print:p-0 space-y-4 border border-[#DADCE0] print:border-0 rounded-2xl print:rounded-none"
    >
      {/* Top Official Google Spectral Accent Bar */}
      <div className="h-1 w-full google-spectral-bar rounded-sm" />

      {/* Bulletin Board Official Banner */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-3.5 border-b-2 border-[#1F1F1F]">
        <div className="space-y-1">
          <div className="text-xs font-semibold text-[#0B57D0]">
            {reportHeaderTitle ||
              'العتبة الحسينية المقدسة — قسم مجمع سيد الشهداء (ع) الخدمي'}
          </div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-[#1F1F1F] leading-snug">
            جدول المحاضرات والدورات للقاعات الدراسية
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-xs text-[#444746]">
            <span className="font-bold text-[#1F1F1F]">{periodHeading}</span>
            <span aria-hidden="true" className="text-[#DADCE0]">
              ·
            </span>
            <span className="font-mono-num">
              ساعات الدوام: {formatTime12Ar(workStartHour)} – {formatTime12Ar(workEndHour)}
            </span>
          </div>
        </div>

        {/* Summary Metrics Strip */}
        <div className="grid grid-cols-3 gap-3 border border-[#DADCE0] rounded-xl px-4 py-2.5 bg-[#F8FAFD] shrink-0 text-center">
          <div>
            <div className="text-[10px] text-[#747775]">القاعات</div>
            <div className="font-mono-num text-base font-bold text-[#1F1F1F]">
              {visibleClassrooms.length}
            </div>
          </div>
          <div className="border-r border-[#DADCE0] pr-3">
            <div className="text-[10px] text-[#747775]">الجلسات</div>
            <div className="font-mono-num text-base font-bold text-[#0B57D0]">
              {scopedBookings.length}
            </div>
          </div>
          <div className="border-r border-[#DADCE0] pr-3">
            <div className="text-[10px] text-[#747775]">الساعات</div>
            <div className="font-mono-num text-base font-bold text-[#137333]">
              {totalHours} س
            </div>
          </div>
        </div>
      </div>

      {/* Mode Specific Bulletin Content */}
      {visibleClassrooms.length === 0 ? (
        <div className="py-10 text-center text-sm text-[#747775] border border-dashed border-[#DADCE0] rounded-xl">
          لا توجد قاعات دراسية مسجلة لعرضها في لوحة الإعلانات.
        </div>
      ) : mode === 'daily' ? (
        /* Daily Bulletin Board: 2-Column Clean Classroom Poster Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 gap-4">
          {visibleClassrooms.map((room) => {
            const roomBookings = scopedBookings.filter((b) => b.roomId === room.id);
            const roomHours =
              Math.round(
                roomBookings.reduce(
                  (sum, b) => sum + calculateDurationHours(b.startTime, b.endTime),
                  0
                ) * 10
              ) / 10;

            return (
              <div
                key={room.id}
                className="bulletin-break-inside-avoid border border-[#DADCE0] rounded-xl overflow-hidden bg-white flex flex-col"
              >
                <div className="px-4 py-2.5 bg-[#F0F4F9] border-b border-[#DADCE0] flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-display text-sm font-bold text-[#1F1F1F] truncate">
                      {room.name}
                    </div>
                    <div className="text-[11px] text-[#444746] flex flex-wrap items-center gap-1.5 mt-0.5">
                      <span className="font-mono-num font-semibold text-[#0B57D0]">
                        {room.code}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{room.floor}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-num">{room.capacity} مقعد</span>
                    </div>
                  </div>

                  <div className="text-left shrink-0">
                    {room.status === 'maintenance' ? (
                      <span className="text-[11px] font-bold text-[#C5221F]">
                        قيد الصيانة
                      </span>
                    ) : (
                      <div className="text-[11px] font-mono-num font-semibold text-[#1F1F1F]">
                        {roomBookings.length} جلسة · {roomHours} س
                      </div>
                    )}
                  </div>
                </div>

                {room.status === 'maintenance' ? (
                  <div className="p-4 text-xs text-[#C5221F] bg-[#FCE8E6]/40 text-center font-medium">
                    هذه القاعة متوقفة مؤقتاً لأعمال الصيانة الفنية.
                  </div>
                ) : roomBookings.length === 0 ? (
                  <div className="p-4 text-xs text-[#747775] text-center">
                    لا توجد محاضرات أو دورات مجدولة في هذا اليوم — متاحة للحجز.
                  </div>
                ) : (
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#F8FAFD] border-b border-[#E8EAED] text-[11px] text-[#444746]">
                        <th className="px-3 py-1.5 text-right font-semibold w-32">الوقت</th>
                        <th className="px-3 py-1.5 text-right font-semibold">
                          المحاضرة / الدورة
                        </th>
                        <th className="px-3 py-1.5 text-right font-semibold w-40">
                          المحاضر والقسم
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E8EAED]">
                      {roomBookings.map((b) => (
                        <tr key={b.id} className="align-top">
                          <td className="px-3 py-2 font-mono-num font-semibold text-[#041E49] whitespace-nowrap">
                            <div>{formatTime12Ar(b.startTime)}</div>
                            <div className="text-[10px] font-normal text-[#747775]">
                              إلى {formatTime12Ar(b.endTime)}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-bold text-[#1F1F1F] leading-snug">
                              {b.courseTitle}
                            </div>
                            <div className="text-[10px] text-[#747775] mt-0.5 flex flex-wrap items-center gap-1">
                              <span>{BOOKING_TYPE_LABEL[b.bookingType]}</span>
                              {!confirmedOnly && (
                                <>
                                  <span aria-hidden="true">·</span>
                                  <span
                                    className={
                                      b.status === 'confirmed'
                                        ? 'text-[#137333] font-semibold'
                                        : 'text-[#B06000] font-semibold'
                                    }
                                  >
                                    {BOOKING_STATUS_LABEL[b.status]}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="font-medium text-[#1F1F1F]">{b.instructorName}</div>
                            <div className="text-[10px] text-[#444746] mt-0.5">
                              {b.department}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
        </div>
      ) : mode === 'weekly' ? (
        /* Weekly Bulletin Board: Compact 7-Day Landscape Matrix */
        <div className="border border-[#DADCE0] rounded-xl overflow-hidden">
          <table className="w-full border-collapse text-[11px]">
            <thead>
              <tr className="bg-[#F0F4F9] border-b border-[#DADCE0]">
                <th className="px-2.5 py-2 text-right font-bold text-[#1F1F1F] border-l border-[#DADCE0] w-36">
                  القاعة
                </th>
                {weekDates.map((d) => (
                  <th
                    key={d}
                    className="px-2 py-2 text-right font-bold text-[#1F1F1F] border-l last:border-l-0 border-[#DADCE0]"
                  >
                    <div>{formatShortArabicDate(d)}</div>
                    <div className="font-mono-num text-[10px] font-normal text-[#747775]">
                      {d}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DADCE0]">
              {visibleClassrooms.map((room) => (
                <tr key={room.id} className="align-top bulletin-break-inside-avoid">
                  <td className="px-2.5 py-2 bg-[#F8FAFD] border-l border-[#DADCE0]">
                    <div className="font-bold text-[#1F1F1F]">{room.name}</div>
                    <div className="font-mono-num text-[10px] text-[#0B57D0] mt-0.5">
                      {room.code} · {room.capacity} مقعد
                    </div>
                    {room.status === 'maintenance' && (
                      <div className="text-[10px] font-semibold text-[#C5221F] mt-0.5">
                        قيد الصيانة
                      </div>
                    )}
                  </td>
                  {weekDates.map((d) => {
                    const cellBookings = scopedBookings.filter(
                      (b) => b.roomId === room.id && b.date === d
                    );
                    return (
                      <td
                        key={d}
                        className="p-1.5 border-l last:border-l-0 border-[#E8EAED] align-top"
                      >
                        {cellBookings.length === 0 ? (
                          <div className="text-center text-[#BDC1C6] py-2">—</div>
                        ) : (
                          <div className="space-y-1.5">
                            {cellBookings.map((b) => (
                              <div
                                key={b.id}
                                className={`p-1.5 rounded-lg border text-[10px] leading-snug ${
                                  b.status === 'confirmed'
                                    ? 'bg-[#E8F0FE]/60 border-[#AECBFA]'
                                    : 'bg-[#FEF7E0]/70 border-[#FDE293]'
                                }`}
                              >
                                <div className="font-mono-num font-bold text-[#041E49]">
                                  {formatTime12Ar(b.startTime)} – {formatTime12Ar(b.endTime)}
                                </div>
                                <div className="font-semibold text-[#1F1F1F] mt-0.5">
                                  {b.courseTitle}
                                </div>
                                <div className="text-[#444746] mt-0.5">
                                  {b.instructorName} · {b.department}
                                </div>
                              </div>
                            ))}
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
      ) : (
        /* Monthly Bulletin Board: Full Chronological Bulletin Table (no clipped cells) */
        <div className="border border-[#DADCE0] rounded-xl overflow-hidden">
          {scopedBookings.length === 0 ? (
            <div className="py-8 text-center text-xs text-[#747775]">
              لا توجد محاضرات أو دورات مسجلة خلال هذا الشهر.
            </div>
          ) : (
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-[#F0F4F9] border-b border-[#DADCE0] text-[11px] text-[#1F1F1F]">
                  <th className="px-3 py-2 text-right font-bold">التاريخ</th>
                  <th className="px-3 py-2 text-right font-bold">الوقت</th>
                  <th className="px-3 py-2 text-right font-bold">القاعة</th>
                  <th className="px-3 py-2 text-right font-bold">المحاضرة / الدورة</th>
                  <th className="px-3 py-2 text-right font-bold">المحاضر</th>
                  <th className="px-3 py-2 text-right font-bold">القسم / الشعبة</th>
                  {!confirmedOnly && (
                    <th className="px-3 py-2 text-right font-bold">الحالة</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EAED]">
                {scopedBookings.map((b) => (
                  <tr key={b.id} className="bulletin-break-inside-avoid">
                    <td className="px-3 py-2 whitespace-nowrap font-medium text-[#1F1F1F]">
                      {formatShortArabicDate(b.date)}
                      <span className="block font-mono-num text-[10px] text-[#747775]">
                        {b.date}
                      </span>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap font-mono-num font-semibold text-[#041E49]">
                      {formatTime12Ar(b.startTime)} – {formatTime12Ar(b.endTime)}
                    </td>
                    <td className="px-3 py-2 font-semibold text-[#0B57D0] whitespace-nowrap">
                      {b.roomName}
                    </td>
                    <td className="px-3 py-2">
                      <span className="font-bold text-[#1F1F1F]">{b.courseTitle}</span>
                      <span className="block text-[10px] text-[#747775]">
                        {BOOKING_TYPE_LABEL[b.bookingType]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-[#1F1F1F]">{b.instructorName}</td>
                    <td className="px-3 py-2 text-[#444746]">{b.department}</td>
                    {!confirmedOnly && (
                      <td className="px-3 py-2 whitespace-nowrap font-semibold">
                        <span
                          className={
                            b.status === 'confirmed' ? 'text-[#137333]' : 'text-[#B06000]'
                          }
                        >
                          {BOOKING_STATUS_LABEL[b.status]}
                        </span>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Bulletin Board Official Footer & Approval Strip */}
      <div className="pt-3 border-t border-[#DADCE0] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-[#444746]">
        <div>
          <span className="font-semibold text-[#1F1F1F]">
            {organizationName || 'قسم مجمع سيد الشهداء (ع) الخدمي'}
          </span>
          <span aria-hidden="true" className="mx-1.5 text-[#DADCE0]">
            ·
          </span>
          <span>
            {reportFooterNote ||
              'صادر عن منظومة إدارة القاعات الدراسية — مخصص للنشر على لوحات الإعلانات'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-4 shrink-0 font-mono-num">
          <span>تاريخ الإصدار: {printedAtLabel}</span>
          <span>اعتماد الإدارة: ________________</span>
        </div>
      </div>
    </div>
  );
}
