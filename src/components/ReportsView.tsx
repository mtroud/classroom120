import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  CalendarRange,
  Download,
  FileBarChart2,
  Printer,
} from 'lucide-react';
import { Booking, Classroom, SystemSettings } from '../types';
import { DepartmentYearlyTrendsD3 } from './DepartmentYearlyTrendsD3';
import {
  BOOKING_STATUS_LABEL,
  BOOKING_TYPE_LABEL,
  calculateDurationHours,
  formatShortArabicDate,
  formatTime12Ar,
  getTodayISO,
  getWeekDates,
  isActiveBooking,
  timeToMinutes,
} from '../utils/schedule';

export type ReportPeriodType = 'weekly' | 'monthly' | 'semi_annual' | 'annual';

interface ReportsViewProps {
  bookings: Booking[];
  classrooms: Classroom[];
  settings: SystemSettings;
}

const ARABIC_MONTHS = [
  'كانون الثاني',
  'شباط',
  'آذار',
  'نيسان',
  'أيار',
  'حزيران',
  'تموز',
  'آب',
  'أيلول',
  'تشرين الأول',
  'تشرين الثاني',
  'كانون الأول',
];

const SERIES_COLORS = ['#1A73E8', '#1E8E3E', '#F9AB00', '#D93025', '#9334E6'];

interface TimelinePoint {
  label: string;
  hours: number;
  sessions: number;
  attendees: number;
}

function CustomTimelineTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: TimelinePoint }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div
      dir="rtl"
      className="bg-white border border-[#DADCE0] rounded-xl g-elevation-2 px-3.5 py-2.5 text-xs space-y-1 min-w-[170px]"
    >
      <div className="font-bold text-[#1F1F1F]">{item.label}</div>
      <div className="pt-1 border-t border-[#E8EAED] space-y-0.5 text-[#444746]">
        <div className="flex justify-between gap-4">
          <span>ساعات التشغيل:</span>
          <strong className="font-mono-num text-[#0B57D0]">{item.hours} س</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span>عدد الجلسات:</span>
          <strong className="font-mono-num text-[#1F1F1F]">{item.sessions}</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span>عدد المستفيدين:</span>
          <strong className="font-mono-num text-[#1F1F1F]">{item.attendees}</strong>
        </div>
      </div>
    </div>
  );
}

function getDaysBetweenInclusive(startISO: string, endISO: string): number {
  const [y1, m1, d1] = startISO.split('-').map(Number);
  const [y2, m2, d2] = endISO.split('-').map(Number);
  const dt1 = new Date(y1, m1 - 1, d1);
  const dt2 = new Date(y2, m2 - 1, d2);
  const diff = Math.round((dt2.getTime() - dt1.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diff + 1);
}

export function ReportsView({
  bookings,
  classrooms,
  settings,
}: ReportsViewProps) {
  const todayISO = getTodayISO();
  const currentYear = Number(todayISO.slice(0, 4));
  const currentMonth = todayISO.slice(0, 7); // YYYY-MM

  const [periodType, setPeriodType] = useState<ReportPeriodType>('monthly');
  const [weekAnchor, setWeekAnchor] = useState<string>(todayISO);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [trendYear, setTrendYear] = useState<number>(currentYear);
  const [selectedHalf, setSelectedHalf] = useState<'H1' | 'H2'>(
    Number(todayISO.slice(5, 7)) <= 6 ? 'H1' : 'H2'
  );
  const [roomFilter, setRoomFilter] = useState<string>('all');

  const availableYears = useMemo(() => {
    const years = new Set<number>([currentYear - 1, currentYear, currentYear + 1]);
    for (const b of bookings) {
      const y = Number(b.date.slice(0, 4));
      if (!Number.isNaN(y)) years.add(y);
    }
    return Array.from(years).sort((a, b) => b - a);
  }, [bookings, currentYear]);

  // Compute startDate, endDate, human label, and timeline buckets
  const range = useMemo(() => {
    if (periodType === 'weekly') {
      const days = getWeekDates(weekAnchor);
      const startDate = days[0];
      const endDate = days[6];
      return {
        startDate,
        endDate,
        title: `التقرير الأسبوعي (${formatShortArabicDate(startDate)} — ${formatShortArabicDate(endDate)})`,
        daysCount: 7,
        weekDays: days,
      };
    }

    if (periodType === 'monthly') {
      const [yStr, mStr] = selectedMonth.split('-');
      const y = Number(yStr) || currentYear;
      const m = Number(mStr) || 1;
      const lastDay = new Date(y, m, 0).getDate();
      const startDate = `${y}-${String(m).padStart(2, '0')}-01`;
      const endDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return {
        startDate,
        endDate,
        title: `التقرير الشهري — ${ARABIC_MONTHS[m - 1] || ''} ${y}`,
        daysCount: lastDay,
        monthDays: lastDay,
        yearNum: y,
        monthNum: m,
      };
    }

    if (periodType === 'semi_annual') {
      const startMonth = selectedHalf === 'H1' ? 1 : 7;
      const endMonth = selectedHalf === 'H1' ? 6 : 12;
      const lastDay = new Date(selectedYear, endMonth, 0).getDate();
      const startDate = `${selectedYear}-${String(startMonth).padStart(2, '0')}-01`;
      const endDate = `${selectedYear}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      return {
        startDate,
        endDate,
        title: `التقرير نصف السنوي (${selectedHalf === 'H1' ? 'النصف الأول: كانون الثاني – حزيران' : 'النصف الثاني: تموز – كانون الأول'}) ${selectedYear}`,
        daysCount: getDaysBetweenInclusive(startDate, endDate),
        monthsRange: Array.from({ length: 6 }, (_, i) => startMonth + i),
        yearNum: selectedYear,
      };
    }

    const startDate = `${selectedYear}-01-01`;
    const endDate = `${selectedYear}-12-31`;
    return {
      startDate,
      endDate,
      title: `التقرير السنوي الشامل لعام ${selectedYear}`,
      daysCount: getDaysBetweenInclusive(startDate, endDate),
      monthsRange: Array.from({ length: 12 }, (_, i) => i + 1),
      yearNum: selectedYear,
    };
  }, [periodType, weekAnchor, selectedMonth, selectedYear, selectedHalf, currentYear]);

  const dailyOperatingHours = useMemo(() => {
    const diff =
      (timeToMinutes(settings.workEndHour) - timeToMinutes(settings.workStartHour)) / 60;
    return diff > 0 ? diff : 13;
  }, [settings.workStartHour, settings.workEndHour]);

  // Filter bookings within range & roomFilter
  const periodBookings = useMemo(() => {
    return bookings
      .filter((b) => {
        if (b.date < range.startDate || b.date > range.endDate) return false;
        if (roomFilter !== 'all' && b.roomId !== roomFilter) return false;
        return true;
      })
      .sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return timeToMinutes(a.startTime) - timeToMinutes(b.startTime);
      });
  }, [bookings, range.startDate, range.endDate, roomFilter]);

  const activeBookings = useMemo(
    () => periodBookings.filter(isActiveBooking),
    [periodBookings]
  );

  const confirmedBookings = useMemo(
    () => periodBookings.filter((b) => b.status === 'confirmed'),
    [periodBookings]
  );

  // Aggregate KPIs
  const summary = useMemo(() => {
    const totalHours = activeBookings.reduce(
      (sum, b) => sum + calculateDurationHours(b.startTime, b.endTime),
      0
    );
    const totalAttendees = activeBookings.reduce(
      (sum, b) => sum + b.attendeesCount,
      0
    );
    const targetRoomsCount =
      roomFilter === 'all' ? Math.max(1, classrooms.length) : 1;
    const totalCapacityHours =
      targetRoomsCount * dailyOperatingHours * range.daysCount;
    const occupancyRate =
      totalCapacityHours > 0
        ? Math.min(100, Math.round((totalHours / totalCapacityHours) * 1000) / 10)
        : 0;

    return {
      totalRequests: periodBookings.length,
      confirmedCount: confirmedBookings.length,
      pendingCount: periodBookings.filter((b) => b.status === 'pending').length,
      activeCount: activeBookings.length,
      totalHours: Math.round(totalHours * 10) / 10,
      totalAttendees,
      occupancyRate,
    };
  }, [
    periodBookings,
    confirmedBookings,
    activeBookings,
    classrooms.length,
    roomFilter,
    dailyOperatingHours,
    range.daysCount,
  ]);

  // Timeline Chart Data
  const timelineData = useMemo<TimelinePoint[]>(() => {
    if (periodType === 'weekly' && range.weekDays) {
      return range.weekDays.map((dISO) => {
        const dayItems = activeBookings.filter((b) => b.date === dISO);
        const hrs = dayItems.reduce(
          (s, b) => s + calculateDurationHours(b.startTime, b.endTime),
          0
        );
        return {
          label: formatShortArabicDate(dISO),
          hours: Math.round(hrs * 10) / 10,
          sessions: dayItems.length,
          attendees: dayItems.reduce((s, b) => s + b.attendeesCount, 0),
        };
      });
    }

    if (periodType === 'monthly' && range.monthDays && range.yearNum && range.monthNum) {
      // Group into 4 weekly blocks of the month for crisp BarChart readability
      const buckets = [
        { label: 'الأسبوع 1 (1-7)', min: 1, max: 7 },
        { label: 'الأسبوع 2 (8-14)', min: 8, max: 14 },
        { label: 'الأسبوع 3 (15-21)', min: 15, max: 21 },
        { label: 'الأسبوع 4 (22-نهاية)', min: 22, max: 31 },
      ];
      return buckets.map((bucket) => {
        const items = activeBookings.filter((b) => {
          const day = Number(b.date.slice(8, 10));
          return day >= bucket.min && day <= bucket.max;
        });
        const hrs = items.reduce(
          (s, b) => s + calculateDurationHours(b.startTime, b.endTime),
          0
        );
        return {
          label: bucket.label,
          hours: Math.round(hrs * 10) / 10,
          sessions: items.length,
          attendees: items.reduce((s, b) => s + b.attendeesCount, 0),
        };
      });
    }

    const months = range.monthsRange || Array.from({ length: 12 }, (_, i) => i + 1);
    return months.map((m) => {
      const prefix = `${range.yearNum}-${String(m).padStart(2, '0')}`;
      const items = activeBookings.filter((b) => b.date.startsWith(prefix));
      const hrs = items.reduce(
        (s, b) => s + calculateDurationHours(b.startTime, b.endTime),
        0
      );
      return {
        label: ARABIC_MONTHS[m - 1] || String(m),
        hours: Math.round(hrs * 10) / 10,
        sessions: items.length,
        attendees: items.reduce((s, b) => s + b.attendeesCount, 0),
      };
    });
  }, [periodType, range, activeBookings]);

  // Room breakdown
  const roomBreakdown = useMemo(() => {
    const roomsToShow =
      roomFilter === 'all'
        ? classrooms
        : classrooms.filter((r) => r.id === roomFilter);
    const maxHours = dailyOperatingHours * range.daysCount;
    return roomsToShow.map((room) => {
      const items = activeBookings.filter((b) => b.roomId === room.id);
      const hrs = items.reduce(
        (s, b) => s + calculateDurationHours(b.startTime, b.endTime),
        0
      );
      const attendees = items.reduce((s, b) => s + b.attendeesCount, 0);
      const occ =
        maxHours > 0 ? Math.min(100, Math.round((hrs / maxHours) * 1000) / 10) : 0;
      return {
        id: room.id,
        name: room.name,
        code: room.code,
        capacity: room.capacity,
        sessions: items.length,
        hours: Math.round(hrs * 10) / 10,
        attendees,
        occupancyRate: occ,
      };
    });
  }, [classrooms, roomFilter, activeBookings, dailyOperatingHours, range.daysCount]);

  // Department breakdown
  const departmentBreakdown = useMemo(() => {
    const map = new Map<
      string,
      {
        department: string;
        total: number;
        confirmed: number;
        pending: number;
        hours: number;
        attendees: number;
      }
    >();
    for (const b of periodBookings) {
      const cur = map.get(b.department) || {
        department: b.department,
        total: 0,
        confirmed: 0,
        pending: 0,
        hours: 0,
        attendees: 0,
      };
      cur.total += 1;
      if (b.status === 'confirmed') cur.confirmed += 1;
      if (b.status === 'pending') cur.pending += 1;
      if (isActiveBooking(b)) {
        cur.hours =
          Math.round((cur.hours + calculateDurationHours(b.startTime, b.endTime)) * 10) /
          10;
        cur.attendees += b.attendeesCount;
      }
      map.set(b.department, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.hours - a.hours);
  }, [periodBookings]);

  // Activity Type distribution for compact chart
  const typeDistribution = useMemo(() => {
    const types = Object.keys(BOOKING_TYPE_LABEL) as Array<keyof typeof BOOKING_TYPE_LABEL>;
    return types.map((t, idx) => {
      const items = activeBookings.filter((b) => b.bookingType === t);
      const hrs = items.reduce(
        (s, b) => s + calculateDurationHours(b.startTime, b.endTime),
        0
      );
      return {
        type: t,
        label: BOOKING_TYPE_LABEL[t],
        sessions: items.length,
        hours: Math.round(hrs * 10) / 10,
        color: SERIES_COLORS[idx % SERIES_COLORS.length],
      };
    });
  }, [activeBookings]);

  const handleExportReportCsv = () => {
    const headers = [
      'التاريخ',
      'من',
      'إلى',
      'القاعة',
      'العنوان',
      'المحاضر',
      'القسم / الشعبة',
      'النوع',
      'الساعات',
      'الطلاب',
      'الحالة',
    ];
    const rows = periodBookings.map((b) => [
      b.date,
      b.startTime,
      b.endTime,
      b.roomName,
      b.courseTitle,
      b.instructorName,
      b.department,
      BOOKING_TYPE_LABEL[b.bookingType],
      String(Math.round(calculateDurationHours(b.startTime, b.endTime) * 10) / 10),
      String(b.attendeesCount),
      BOOKING_STATUS_LABEL[b.status],
    ]);

    const summaryRows = [
      [range.title],
      [`الفترة: من ${range.startDate} إلى ${range.endDate}`],
      [`الجلسات الفعالة: ${summary.activeCount}`, `إجمالي الساعات: ${summary.totalHours}`, `معدل الإشغال: ${summary.occupancyRate}%`, `إجمالي الطلاب: ${summary.totalAttendees}`],
      [],
      headers,
      ...rows,
    ];

    const csv =
      '\uFEFF' +
      summaryRows
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        )
        .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `report-${periodType}-${range.startDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-6">
      {/* Official Print Header */}
      <div className="hidden print:block border-b border-[#DADCE0] pb-4 mb-4">
        <h1 className="font-display text-xl font-bold text-[#1F1F1F]">
          {settings.reportHeaderTitle}
        </h1>
        <p className="text-sm font-semibold text-[#444746] mt-1">{range.title}</p>
        <p className="text-xs text-[#747775] mt-0.5 font-mono-num">
          الفترة من {range.startDate} إلى {range.endDate}
        </p>
      </div>

      {/* Header & Controls */}
      <div className="bg-white border border-[#DADCE0] rounded-2xl p-5 space-y-4 no-print">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#E8F0FE] border border-[#AECBFA] flex items-center justify-center shrink-0 text-[#0B57D0]">
              <FileBarChart2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-[#1F1F1F]">
                التقارير الدورية لإشغال القاعات والدورات
              </h2>
              <p className="text-xs text-[#747775] mt-0.5">
                {range.title} · من{' '}
                <span className="font-mono-num">{range.startDate}</span> إلى{' '}
                <span className="font-mono-num">{range.endDate}</span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleExportReportCsv}
              disabled={periodBookings.length === 0}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DADCE0] bg-white text-xs font-medium text-[#1F1F1F] hover:bg-[#F0F4F9] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#444746]" />
              <span>تصدير التقرير CSV</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-semibold hover:bg-[#0842A0] g-elevation-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>طباعة التقرير الرسمي</span>
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-[#E8EAED] flex flex-wrap items-center justify-between gap-4">
          {/* Period Type Segmented Switch */}
          <div className="inline-flex flex-wrap items-center p-1 bg-[#F0F4F9] rounded-xl">
            {(
              [
                ['weekly', 'تقرير أسبوعي'],
                ['monthly', 'تقرير شهري'],
                ['semi_annual', 'نصف سنوي'],
                ['annual', 'تقرير سنوي'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setPeriodType(val)}
                className={`px-3.5 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  periodType === val
                    ? 'bg-white text-[#0B57D0] font-semibold g-elevation-1'
                    : 'text-[#444746] font-medium hover:text-[#1F1F1F]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Dynamic Date/Period Selectors */}
          <div className="flex flex-wrap items-center gap-2.5">
            <CalendarRange className="w-4 h-4 text-[#747775]" />

            {periodType === 'weekly' && (
              <input
                type="date"
                value={weekAnchor}
                onChange={(e) => e.target.value && setWeekAnchor(e.target.value)}
                className="rounded-xl border border-[#DADCE0] bg-white px-3 py-1.5 text-xs font-mono-num text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
                aria-label="تاريخ ضمن الأسبوع"
              />
            )}

            {periodType === 'monthly' && (
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="rounded-xl border border-[#DADCE0] bg-white px-3 py-1.5 text-xs font-mono-num text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
                aria-label="الشهر"
              />
            )}

            {periodType === 'semi_annual' && (
              <>
                <select
                  value={selectedHalf}
                  onChange={(e) => setSelectedHalf(e.target.value as 'H1' | 'H2')}
                  className="rounded-xl border border-[#DADCE0] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
                >
                  <option value="H1">النصف الأول (كانون الثاني — حزيران)</option>
                  <option value="H2">النصف الثاني (تموز — كانون الأول)</option>
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => {
                    const y = Number(e.target.value);
                    setSelectedYear(y);
                    setTrendYear(y);
                  }}
                  className="rounded-xl border border-[#DADCE0] bg-white px-3 py-1.5 text-xs font-mono-num text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </>
            )}

            {periodType === 'annual' && (
              <select
                value={selectedYear}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setSelectedYear(y);
                  setTrendYear(y);
                }}
                className="rounded-xl border border-[#DADCE0] bg-white px-3 py-1.5 text-xs font-mono-num text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
              >
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    السنة {y}
                  </option>
                ))}
              </select>
            )}

            <select
              value={roomFilter}
              onChange={(e) => setRoomFilter(e.target.value)}
              className="rounded-xl border border-[#DADCE0] bg-white px-3 py-1.5 text-xs text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
              aria-label="تصفية القاعة"
            >
              <option value="all">جميع القاعات ({classrooms.length})</option>
              {classrooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Period Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-[#DADCE0] rounded-2xl p-4">
          <div className="text-xs text-[#444746]">الجلسات والدورات الفعالة</div>
          <div className="font-mono-num text-2xl font-semibold text-[#1F1F1F] mt-1">
            {summary.activeCount}
          </div>
          <div className="text-[11px] text-[#747775] mt-1">
            مؤكد: {summary.confirmedCount} · معلق: {summary.pendingCount}
          </div>
        </div>
        <div className="bg-white border border-[#DADCE0] rounded-2xl p-4">
          <div className="text-xs text-[#444746]">إجمالي ساعات التشغيل</div>
          <div className="font-mono-num text-2xl font-semibold text-[#0B57D0] mt-1">
            {summary.totalHours} س
          </div>
          <div className="text-[11px] text-[#747775] mt-1">
            ضمن {range.daysCount} يوم عمل
          </div>
        </div>
        <div className="bg-white border border-[#DADCE0] rounded-2xl p-4">
          <div className="text-xs text-[#444746]">إجمالي الطلبة والمستفيدين</div>
          <div className="font-mono-num text-2xl font-semibold text-[#137333] mt-1">
            {summary.totalAttendees}
          </div>
          <div className="text-[11px] text-[#747775] mt-1">
            عبر {departmentBreakdown.length} قسم وشعبة
          </div>
        </div>
        <div className="bg-white border border-[#DADCE0] rounded-2xl p-4">
          <div className="text-xs text-[#444746]">معدل الإشغال العام للفترة</div>
          <div className="font-mono-num text-2xl font-semibold text-[#B06000] mt-1">
            {summary.occupancyRate}%
          </div>
          <div className="text-[11px] text-[#747775] mt-1">
            على أساس {dailyOperatingHours} ساعة يومياً
          </div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white border border-[#DADCE0] rounded-2xl p-5 min-w-0 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-[#1F1F1F]">
              توزع ساعات التدريس والتشغيل خلال الفترة
            </h3>
            <span className="text-xs text-[#747775] font-mono-num">
              الإجمالي: {summary.totalHours} س
            </span>
          </div>
          <div className="h-[260px] w-full min-w-0" dir="ltr">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={timelineData}
                margin={{ top: 10, right: 16, left: 0, bottom: 16 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EAED" />
                <XAxis
                  dataKey="label"
                  tick={{ fill: '#444746', fontSize: 11 }}
                  axisLine={{ stroke: '#DADCE0' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#747775', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                />
                <Tooltip
                  cursor={{ fill: '#F0F4F9' }}
                  content={<CustomTimelineTooltip />}
                />
                <Bar dataKey="hours" fill="#1A73E8" radius={[6, 6, 0, 0]} maxBarSize={44} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="xl:col-span-4 bg-white border border-[#DADCE0] rounded-2xl p-5 min-w-0 space-y-4">
          <h3 className="font-display text-sm font-bold text-[#1F1F1F]">
            توزيع الأنشطة حسب النوع
          </h3>
          <div className="divide-y divide-[#E8EAED]">
            {typeDistribution.map((item) => {
              const pct =
                summary.totalHours > 0
                  ? Math.round((item.hours / summary.totalHours) * 100)
                  : 0;
              return (
                <div key={item.type} className="py-3 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-[#1F1F1F]">{item.label}</span>
                    <span className="font-mono-num text-[#444746]">
                      {item.sessions} جلسة · {item.hours} س ({pct}%)
                    </span>
                  </div>
                  <div className="w-full h-2 bg-[#E8EAED] rounded-sm overflow-hidden">
                    <div
                      className="h-full rounded-sm transition-all"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: item.color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* D3.js Interactive Yearly Department Booking Trends */}
      <DepartmentYearlyTrendsD3
        bookings={bookings}
        classrooms={classrooms}
        year={trendYear}
        onYearChange={setTrendYear}
        availableYears={availableYears}
        roomFilter={roomFilter}
      />

      {/* Room & Department Summary Tables */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Room Summary */}
        <div className="bg-white border border-[#DADCE0] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E8EAED] bg-[#F8FAFD] flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-[#1F1F1F]">
              ملخص تشغيل القاعات الدراسية
            </h3>
            <span className="text-xs text-[#747775] font-mono-num">
              {roomBreakdown.length} قاعة
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-[#F8FAFD] border-b border-[#DADCE0] text-xs font-semibold text-[#444746]">
                  <th className="px-4 py-2.5">القاعة</th>
                  <th className="px-4 py-2.5 text-left">الجلسات</th>
                  <th className="px-4 py-2.5 text-left">الساعات</th>
                  <th className="px-4 py-2.5 text-left">الإشغال</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EAED] text-xs">
                {roomBreakdown.map((r) => (
                  <tr key={r.id} className="hover:bg-[#F8FAFD] transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-[#1F1F1F]">{r.name}</div>
                      <div className="text-[11px] font-mono-num text-[#747775]">
                        {r.code} · سعة {r.capacity}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-left font-mono-num text-[#1F1F1F]">
                      {r.sessions}
                    </td>
                    <td className="px-4 py-2.5 text-left font-mono-num text-[#1F1F1F]">
                      {r.hours} س
                    </td>
                    <td className="px-4 py-2.5 text-left font-mono-num font-semibold text-[#0B57D0]">
                      {r.occupancyRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Department Summary */}
        <div className="bg-white border border-[#DADCE0] rounded-2xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E8EAED] bg-[#F8FAFD] flex items-center justify-between">
            <h3 className="font-display text-sm font-bold text-[#1F1F1F]">
              ملخص استفادة الأقسام والشعب
            </h3>
            <span className="text-xs text-[#747775] font-mono-num">
              {departmentBreakdown.length} جهة
            </span>
          </div>
          {departmentBreakdown.length === 0 ? (
            <div className="p-8 text-center text-xs text-[#747775]">
              لا توجد حجوزات مسجلة في هذه الفترة الزمنية.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-right border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFD] border-b border-[#DADCE0] text-xs font-semibold text-[#444746]">
                    <th className="px-4 py-2.5">القسم / الشعبة</th>
                    <th className="px-4 py-2.5 text-left">الطلبات</th>
                    <th className="px-4 py-2.5 text-left">الساعات</th>
                    <th className="px-4 py-2.5 text-left">المستفيدون</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8EAED] text-xs">
                  {departmentBreakdown.map((d) => (
                    <tr key={d.department} className="hover:bg-[#F8FAFD] transition-colors">
                      <td className="px-4 py-2.5 font-medium text-[#1F1F1F]">
                        {d.department}
                      </td>
                      <td className="px-4 py-2.5 text-left font-mono-num text-[#444746]">
                        {d.confirmed}/{d.total}
                      </td>
                      <td className="px-4 py-2.5 text-left font-mono-num text-[#1F1F1F]">
                        {d.hours} س
                      </td>
                      <td className="px-4 py-2.5 text-left font-mono-num text-[#1F1F1F]">
                        {d.attendees}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detailed Session Log for the Period */}
      <div className="bg-white border border-[#DADCE0] rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E8EAED] bg-[#F8FAFD] flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-[#1F1F1F]">
            السجل التفصيلي للدورات والمحاضرات خلال الفترة ({periodBookings.length})
          </h3>
        </div>
        {periodBookings.length === 0 ? (
          <div className="p-10 text-center text-xs text-[#747775]">
            لا توجد سجلات مطابقة للفترة المختارة.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[820px]">
              <thead>
                <tr className="bg-[#F8FAFD] border-b border-[#DADCE0] text-xs font-semibold text-[#444746]">
                  <th className="px-4 py-2.5">التاريخ</th>
                  <th className="px-4 py-2.5">الوقت</th>
                  <th className="px-4 py-2.5">القاعة</th>
                  <th className="px-4 py-2.5">العنوان</th>
                  <th className="px-4 py-2.5">القسم المستفيد</th>
                  <th className="px-4 py-2.5 text-left">الطلاب</th>
                  <th className="px-4 py-2.5">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EAED] text-xs">
                {periodBookings.map((b) => (
                  <tr key={b.id} className="hover:bg-[#F8FAFD] transition-colors">
                    <td className="px-4 py-2.5 font-mono-num text-[#1F1F1F] whitespace-nowrap">
                      {b.date}
                    </td>
                    <td className="px-4 py-2.5 font-mono-num text-[#444746] whitespace-nowrap">
                      {formatTime12Ar(b.startTime)} – {formatTime12Ar(b.endTime)}
                    </td>
                    <td className="px-4 py-2.5 text-[#1F1F1F]">{b.roomName}</td>
                    <td className="px-4 py-2.5">
                      <div className="font-semibold text-[#1F1F1F]">{b.courseTitle}</div>
                      <div className="text-[11px] text-[#747775]">{b.instructorName}</div>
                    </td>
                    <td className="px-4 py-2.5 text-[#444746]">{b.department}</td>
                    <td className="px-4 py-2.5 text-left font-mono-num text-[#1F1F1F]">
                      {b.attendeesCount}
                    </td>
                    <td className="px-4 py-2.5 text-[#444746] whitespace-nowrap">
                      {BOOKING_STATUS_LABEL[b.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {settings.reportFooterNote && (
        <div className="hidden print:block text-center text-xs text-[#747775] pt-4 border-t border-[#DADCE0]">
          {settings.reportFooterNote}
        </div>
      )}
    </section>
  );
}
