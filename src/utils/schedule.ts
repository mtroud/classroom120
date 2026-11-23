import { Booking, BookingStatus, BookingType, ClassroomStatus } from '../types';

export function getTodayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function addDaysISO(baseDateISO: string, days: number): string {
  const [y, m, d] = baseDateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getWeekDates(anchorDateISO: string): string[] {
  const [y, m, d] = anchorDateISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  // Start week on Saturday (day 6) in Iraqi academic calendar
  const dayOfWeek = dt.getDay(); // 0=Sun .. 6=Sat
  const offsetToSat = dayOfWeek === 6 ? 0 : -(dayOfWeek + 1);
  const sat = new Date(dt);
  sat.setDate(dt.getDate() + offsetToSat);
  return Array.from({ length: 7 }, (_, i) => {
    const cur = new Date(sat);
    cur.setDate(sat.getDate() + i);
    const yy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  });
}

export function formatArabicDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  if (!y || !m || !d) return dateISO;
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('ar-IQ', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(dt);
}

export function formatShortArabicDate(dateISO: string): string {
  const [y, m, d] = dateISO.split('-').map(Number);
  if (!y || !m || !d) return dateISO;
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat('ar-IQ', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(dt);
}

export function formatArabicMonthYear(dateISO: string): string {
  const [y, m] = dateISO.split('-').map(Number);
  if (!y || !m) return dateISO;
  const dt = new Date(y, m - 1, 1);
  return new Intl.DateTimeFormat('ar-IQ', {
    year: 'numeric',
    month: 'long',
  }).format(dt);
}

export function shiftMonthISO(baseDateISO: string, deltaMonths: number): string {
  const [y, m, d] = baseDateISO.split('-').map(Number);
  if (!y || !m || !d) return getTodayISO();
  const targetMonthDate = new Date(y, m - 1 + deltaMonths, 1);
  const targetYear = targetMonthDate.getFullYear();
  const targetMonthIndex = targetMonthDate.getMonth();
  const maxDayInTarget = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
  const clampedDay = Math.min(d, maxDayInTarget);
  return `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}-${String(clampedDay).padStart(2, '0')}`;
}

export interface MonthCalendarCell {
  dateISO: string;
  dayNumber: number;
  isCurrentMonth: boolean;
}

export const ARABIC_WEEKDAYS_SAT_START = [
  'السبت',
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
];

export function getMonthCalendarCells(anchorDateISO: string): MonthCalendarCell[] {
  const [y, m] = anchorDateISO.split('-').map(Number);
  const year = y || new Date().getFullYear();
  const monthIndex = (m || new Date().getMonth() + 1) - 1;

  const firstOfMonth = new Date(year, monthIndex, 1);
  const lastOfMonth = new Date(year, monthIndex + 1, 0);

  // Offset to Saturday (6) as first day of the Iraqi academic week
  const firstDayOfWeek = firstOfMonth.getDay(); // 0=Sun .. 6=Sat
  const leadingOffset = firstDayOfWeek === 6 ? 0 : firstDayOfWeek + 1;

  const totalMonthDays = lastOfMonth.getDate();
  const totalCells = Math.ceil((leadingOffset + totalMonthDays) / 7) * 7;

  const startDate = new Date(year, monthIndex, 1 - leadingOffset);

  return Array.from({ length: totalCells }, (_, i) => {
    const cur = new Date(startDate);
    cur.setDate(startDate.getDate() + i);
    const yy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    return {
      dateISO: `${yy}-${mm}-${dd}`,
      dayNumber: cur.getDate(),
      isCurrentMonth: cur.getMonth() === monthIndex && cur.getFullYear() === year,
    };
  });
}

export function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function formatTime12Ar(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const period = h >= 12 ? 'م' : 'ص';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(hour12).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

export function calculateDurationHours(startTime: string, endTime: string): number {
  const diff = timeToMinutes(endTime) - timeToMinutes(startTime);
  return Math.max(0, diff / 60);
}

export function hasTimeOverlap(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const a1 = timeToMinutes(startA);
  const a2 = timeToMinutes(endA);
  const b1 = timeToMinutes(startB);
  const b2 = timeToMinutes(endB);
  return a1 < b2 && a2 > b1;
}

export function isActiveBooking(b: Pick<Booking, 'status'>): boolean {
  return b.status !== 'cancelled' && b.status !== 'rejected';
}

export function findBookingConflicts(
  bookings: Booking[],
  candidate: {
    id?: string;
    roomId: string;
    date: string;
    startTime: string;
    endTime: string;
  }
): Booking[] {
  return bookings.filter((b) => {
    if (b.id === candidate.id) return false;
    if (!isActiveBooking(b)) return false;
    if (b.roomId !== candidate.roomId) return false;
    if (b.date !== candidate.date) return false;
    return hasTimeOverlap(candidate.startTime, candidate.endTime, b.startTime, b.endTime);
  });
}

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  confirmed: 'موافق عليه',
  pending: 'بانتظار الموافقة',
  rejected: 'مرفوض',
  cancelled: 'ملغي',
};

export const BOOKING_TYPE_LABEL: Record<BookingType, string> = {
  lecture: 'محاضرة دراسية',
  workshop: 'ورشة تقنية',
  exam: 'اختبار',
  seminar: 'ندوة علمية',
};

export const CLASSROOM_STATUS_LABEL: Record<ClassroomStatus, string> = {
  available: 'متاحة للتشغيل',
  maintenance: 'قيد الصيانة',
};

export const TIMELINE_HOURS = [
  '08:00',
  '09:00',
  '10:00',
  '11:00',
  '12:00',
  '13:00',
  '14:00',
  '15:00',
  '16:00',
  '17:00',
  '18:00',
  '19:00',
  '20:00',
];

export const TIME_OPTIONS = [
  '08:00',
  '08:30',
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '13:00',
  '13:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
  '18:00',
  '18:30',
  '19:00',
  '19:30',
  '20:00',
  '20:30',
  '21:00',
];

export function exportBookingsToCsv(bookings: Booking[]) {
  const headers = [
    'التاريخ',
    'من الساعة',
    'إلى الساعة',
    'القاعة',
    'عنوان الدرس أو المحاضرة',
    'المحاضر',
    'الشعبة / القسم',
    'النوع',
    'عدد الطلاب',
    'الحالة',
  ];
  const rows = bookings.map((b) => [
    b.date,
    b.startTime,
    b.endTime,
    b.roomName,
    b.courseTitle,
    b.instructorName,
    b.department,
    BOOKING_TYPE_LABEL[b.bookingType],
    String(b.attendeesCount),
    BOOKING_STATUS_LABEL[b.status],
  ]);
  const csvContent =
    '\uFEFF' +
    [headers, ...rows]
      .map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `schedule-sayyid-alshuhada-${getTodayISO()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
