import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { Booking, Classroom } from '../types';
import {
  calculateDurationHours,
  getTodayISO,
  getWeekDates,
  isActiveBooking,
} from '../utils/schedule';

interface ClassroomOccupancyChartsProps {
  classrooms: Classroom[];
  bookings: Booking[];
}

type AnalyticsPeriod = 'today' | 'week' | 'all';

const DAILY_OPERATING_HOURS = 13; // 08:00 to 21:00
// Official Google Data Visualization Palette
const CHART_COLORS = [
  '#1A73E8', // Google Blue
  '#1E8E3E', // Google Green
  '#F9AB00', // Google Amber/Yellow
  '#D93025', // Google Red
  '#9334E6', // Google Purple
  '#0097A7', // Google Cyan
];

interface RoomStatItem {
  id: string;
  name: string;
  shortName: string;
  code: string;
  hours: number;
  sessions: number;
  occupancyRate: number;
  seatUtilization: number;
  sharePercent: number;
  color: string;
}

function CustomOccupancyTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: RoomStatItem }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div
      dir="rtl"
      className="bg-white border border-[#DADCE0] rounded-xl g-elevation-2 px-3.5 py-2.5 text-xs space-y-1 min-w-[180px]"
    >
      <div className="font-bold text-[#1F1F1F]">{item.name}</div>
      <div className="text-[#444746] font-mono-num">{item.code}</div>
      <div className="pt-1 border-t border-[#E8EAED] space-y-0.5 text-[#444746]">
        <div className="flex justify-between gap-4">
          <span>معدل الإشغال:</span>
          <strong className="font-mono-num text-[#0B57D0]">{item.occupancyRate}%</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span>الساعات المحجوزة:</span>
          <strong className="font-mono-num text-[#1F1F1F]">{item.hours} س</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span>عدد الجلسات:</span>
          <strong className="font-mono-num text-[#1F1F1F]">{item.sessions}</strong>
        </div>
        <div className="flex justify-between gap-4">
          <span>متوسط إشغال المقاعد:</span>
          <strong className="font-mono-num text-[#1F1F1F]">{item.seatUtilization}%</strong>
        </div>
      </div>
    </div>
  );
}

function CustomShareTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: RoomStatItem }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0].payload;
  return (
    <div
      dir="rtl"
      className="bg-white border border-[#DADCE0] rounded-xl g-elevation-2 px-3.5 py-2.5 text-xs space-y-1"
    >
      <div className="font-bold text-[#1F1F1F]">{item.name}</div>
      <div className="flex justify-between gap-4 text-[#444746]">
        <span>نسبة من إجمالي الاستخدام:</span>
        <strong className="font-mono-num text-[#0B57D0]">{item.sharePercent}%</strong>
      </div>
      <div className="flex justify-between gap-4 text-[#444746]">
        <span>إجمالي الساعات:</span>
        <strong className="font-mono-num text-[#1F1F1F]">{item.hours} ساعة</strong>
      </div>
    </div>
  );
}

export function ClassroomOccupancyCharts({
  classrooms,
  bookings,
}: ClassroomOccupancyChartsProps) {
  const [period, setPeriod] = useState<AnalyticsPeriod>('week');

  const todayISO = getTodayISO();
  const weekSet = useMemo(() => new Set(getWeekDates(todayISO)), [todayISO]);

  const filteredBookings = useMemo(() => {
    return bookings.filter((b) => {
      if (!isActiveBooking(b)) return false;
      if (period === 'today') return b.date === todayISO;
      if (period === 'week') return weekSet.has(b.date);
      return true;
    });
  }, [bookings, period, todayISO, weekSet]);

  const { stats, totalHours, totalSessions, avgOccupancy } = useMemo(() => {
    const activeDatesCount =
      period === 'today'
        ? 1
        : period === 'week'
          ? 7
          : Math.max(
              1,
              new Set(filteredBookings.map((b) => b.date)).size || 1
            );

    const maxAvailableHoursPerRoom = DAILY_OPERATING_HOURS * activeDatesCount;

    const raw = classrooms.map((room, index) => {
      const roomBookings = filteredBookings.filter((b) => b.roomId === room.id);
      const hours = roomBookings.reduce(
        (sum, b) => sum + calculateDurationHours(b.startTime, b.endTime),
        0
      );
      const roundedHours = Math.round(hours * 10) / 10;
      const occupancyRate = Math.min(
        100,
        Math.round((hours / maxAvailableHoursPerRoom) * 1000) / 10
      );

      const avgAttendees =
        roomBookings.length > 0
          ? roomBookings.reduce((sum, b) => sum + b.attendeesCount, 0) /
            roomBookings.length
          : 0;
      const seatUtilization =
        room.capacity > 0
          ? Math.min(100, Math.round((avgAttendees / room.capacity) * 100))
          : 0;

      const shortName =
        room.name.length > 22 ? `${room.name.slice(0, 20)}…` : room.name;

      return {
        id: room.id,
        name: room.name,
        shortName,
        code: room.code,
        hours: roundedHours,
        sessions: roomBookings.length,
        occupancyRate,
        seatUtilization,
        sharePercent: 0,
        color: CHART_COLORS[index % CHART_COLORS.length],
      };
    });

    const sumHours = raw.reduce((s, r) => s + r.hours, 0);
    const sumSessions = raw.reduce((s, r) => s + r.sessions, 0);
    const avgOcc =
      raw.length > 0
        ? Math.round(
            (raw.reduce((s, r) => s + r.occupancyRate, 0) / raw.length) * 10
          ) / 10
        : 0;

    const withShare: RoomStatItem[] = raw.map((item) => ({
      ...item,
      sharePercent:
        sumHours > 0 ? Math.round((item.hours / sumHours) * 1000) / 10 : 0,
    }));

    return {
      stats: withShare,
      totalHours: Math.round(sumHours * 10) / 10,
      totalSessions: sumSessions,
      avgOccupancy: avgOcc,
    };
  }, [classrooms, filteredBookings, period]);

  const pieData = useMemo(
    () => stats.filter((s) => s.hours > 0),
    [stats]
  );

  if (classrooms.length === 0) return null;

  return (
    <section
      aria-label="إحصائيات إشغال القاعات"
      className="bg-white border border-[#DADCE0] rounded-2xl p-5 lg:p-6 space-y-6"
    >
      {/* Header & Period Switch */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E8EAED] pb-4">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#E8F0FE] border border-[#AECBFA] flex items-center justify-center shrink-0 text-[#0B57D0]">
            <BarChart3 className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-display text-base font-bold text-[#1F1F1F]">
              إحصائيات الإشغال ونسب استخدام القاعات
            </h3>
            <p className="text-xs text-[#444746] mt-0.5 flex flex-wrap items-center gap-2">
              <span>متوسط الإشغال: <strong className="font-mono-num text-[#1F1F1F]">{avgOccupancy}%</strong></span>
              <span aria-hidden="true">·</span>
              <span>إجمالي الساعات: <strong className="font-mono-num text-[#1F1F1F]">{totalHours} س</strong></span>
              <span aria-hidden="true">·</span>
              <span>الجلسات الفعالة: <strong className="font-mono-num text-[#1F1F1F]">{totalSessions}</strong></span>
            </p>
          </div>
        </div>

        <div className="inline-flex items-center p-1 bg-[#F0F4F9] rounded-xl self-start sm:self-auto">
          {(
            [
              ['today', 'اليوم'],
              ['week', 'الأسبوع الحالي'],
              ['all', 'كل الفترات'],
            ] as const
          ).map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setPeriod(val)}
              className={`px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                period === val
                  ? 'bg-white text-[#0B57D0] font-semibold g-elevation-1'
                  : 'text-[#444746] font-medium hover:text-[#1F1F1F]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
        {/* Bar Chart: Occupancy % per classroom */}
        <div className="xl:col-span-7 min-w-0 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#1F1F1F]">
              معدل الإشغال الزمني لكل قاعة (%)
            </h4>
            <span className="text-[11px] text-[#747775]">
              محسوب على أساس 13 ساعة تشغيل يومياً
            </span>
          </div>

          <div className="h-[270px] w-full min-w-0" dir="ltr">
            <ResponsiveContainer width="100%" height="100%" minWidth={0}>
              <BarChart
                data={stats}
                margin={{ top: 10, right: 16, left: 0, bottom: 12 }}
                barCategoryGap="24%"
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E8EAED" />
                <XAxis
                  dataKey="code"
                  tick={{ fill: '#444746', fontSize: 12, fontFamily: 'IBM Plex Mono' }}
                  axisLine={{ stroke: '#DADCE0' }}
                  tickLine={false}
                />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={(v) => `${v}%`}
                  tick={{ fill: '#747775', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  cursor={{ fill: '#F0F4F9' }}
                  content={<CustomOccupancyTooltip />}
                />
                <Bar
                  dataKey="occupancyRate"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={52}
                >
                  {stats.map((entry) => (
                    <Cell key={entry.id} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart + Numeric Breakdown: Usage Distribution */}
        <div className="xl:col-span-5 min-w-0 space-y-3 border-t xl:border-t-0 xl:border-r border-[#E8EAED] pt-5 xl:pt-0 xl:pr-6">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-[#1F1F1F]">
              توزيع حصص الاستخدام حسب القاعة
            </h4>
            <span className="text-[11px] text-[#747775] font-mono-num">
              {totalHours} س إجمالاً
            </span>
          </div>

          {pieData.length === 0 ? (
            <div className="h-[240px] flex flex-col items-center justify-center text-center bg-[#F8FAFD] border border-[#E8EAED] rounded-xl px-4">
              <p className="text-xs font-medium text-[#444746]">
                لا توجد ساعات محجوزة في هذه الفترة لعرض التوزيع النسبي
              </p>
              <p className="text-[11px] text-[#747775] mt-1">
                جرّب التبديل إلى «الأسبوع الحالي» أو «كل الفترات».
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center">
              <div className="sm:col-span-5 h-[210px] min-w-0" dir="ltr">
                <ResponsiveContainer width="100%" height="100%" minWidth={0}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="hours"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={48}
                      outerRadius={78}
                      paddingAngle={2}
                    >
                      {pieData.map((entry) => (
                        <Cell key={entry.id} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomShareTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="sm:col-span-7 divide-y divide-[#E8EAED]">
                {stats.map((item) => (
                  <div
                    key={item.id}
                    className="py-2 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: item.color }}
                        aria-hidden="true"
                      />
                      <span className="text-[#1F1F1F] font-medium truncate">
                        {item.shortName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0 font-mono-num">
                      <span className="text-[#444746]">{item.hours} س</span>
                      <span className="font-semibold text-[#1F1F1F] w-11 text-left">
                        {item.sharePercent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
