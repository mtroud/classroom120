import { Cell, Pie, PieChart, Tooltip } from 'recharts';
import { formatShortArabicDate } from '../utils/schedule';

export interface RoomOccupancyStat {
  id: string;
  name: string;
  code: string;
  floor: string;
  capacity: number;
  isMaintenance: boolean;
  sessionsCount: number;
  confirmedHours: number;
  pendingHours: number;
  totalHours: number;
  confirmedPct: number;
  pendingPct: number;
  totalPct: number;
  remainingPct: number;
}

interface PieSliceDatum {
  name: string;
  value: number;
  pct: number;
  hours: number;
  color: string;
}

interface ScheduledHoursCardProps {
  selectedDate: string;
  scheduledHours: number;
  dailyOperatingHours: number;
  availableRoomsCount: number;
  overallOccupancyPct: number;
  rooms: RoomOccupancyStat[];
  isLoading: boolean;
  canQuickBook: boolean;
  onQuickBookRoom: (roomId: string) => void;
  compact?: boolean;
}

function PieSliceTooltip({
  active,
  payload,
  title,
}: {
  active?: boolean;
  payload?: Array<{ payload: PieSliceDatum }>;
  title: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const slice = payload[0].payload;
  return (
    <div
      dir="rtl"
      className="bg-white border border-[#DADCE0] rounded-xl g-elevation-2 px-3 py-2 text-xs space-y-1 min-w-[165px]"
    >
      <div className="font-bold text-[#1F1F1F]">{title}</div>
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-[#E8EAED] text-[#444746]">
        <span className="inline-flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-sm shrink-0"
            style={{ backgroundColor: slice.color }}
          />
          <span>{slice.name}:</span>
        </span>
        <strong className="font-mono-num text-[#1F1F1F]">
          {slice.pct}% ({slice.hours} س)
        </strong>
      </div>
    </div>
  );
}

export function ScheduledHoursCard({
  selectedDate,
  scheduledHours,
  dailyOperatingHours,
  availableRoomsCount,
  overallOccupancyPct,
  rooms,
  isLoading,
  canQuickBook,
  onQuickBookRoom,
  compact = false,
}: ScheduledHoursCardProps) {
  const availableRooms = rooms.filter((r) => !r.isMaintenance);
  const totalConfirmedHours =
    Math.round(
      availableRooms.reduce((sum, r) => sum + r.confirmedHours, 0) * 10
    ) / 10;
  const totalPendingHours =
    Math.round(
      availableRooms.reduce((sum, r) => sum + r.pendingHours, 0) * 10
    ) / 10;
  const totalCapacityHours =
    Math.round(availableRoomsCount * dailyOperatingHours * 10) / 10;
  const totalRemainingHours = Math.max(
    0,
    Math.round(
      (totalCapacityHours - totalConfirmedHours - totalPendingHours) * 10
    ) / 10
  );

  const overallConfirmedPct =
    totalCapacityHours > 0
      ? Math.min(
          overallOccupancyPct,
          Math.round((totalConfirmedHours / totalCapacityHours) * 100)
        )
      : 0;
  const overallPendingPct = Math.max(
    0,
    overallOccupancyPct - overallConfirmedPct
  );
  const overallRemainingPct = Math.max(0, 100 - overallOccupancyPct);

  const overallSlices: PieSliceDatum[] =
    totalCapacityHours > 0
      ? [
          ...(overallConfirmedPct > 0
            ? [
                {
                  name: 'حجز مؤكد',
                  value: overallConfirmedPct,
                  pct: overallConfirmedPct,
                  hours: totalConfirmedHours,
                  color: '#1A73E8',
                },
              ]
            : []),
          ...(overallPendingPct > 0
            ? [
                {
                  name: 'بانتظار الموافقة',
                  value: overallPendingPct,
                  pct: overallPendingPct,
                  hours: totalPendingHours,
                  color: '#F9AB00',
                },
              ]
            : []),
          ...(overallRemainingPct > 0
            ? [
                {
                  name: 'متاح للحجز',
                  value: overallRemainingPct,
                  pct: overallRemainingPct,
                  hours: totalRemainingHours,
                  color: '#E8EAED',
                },
              ]
            : []),
        ]
      : [
          {
            name: 'متاح للحجز',
            value: 100,
            pct: 0,
            hours: 0,
            color: '#E8EAED',
          },
        ];

  if (compact) {
    return (
      <div className="bg-white border border-[#DADCE0] rounded-2xl p-4 flex items-center justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#444746]">
              ساعات الدراسة المجدولة
            </span>
          </div>
          <div className="font-mono-num text-2xl font-semibold text-[#0B57D0] mt-1.5">
            {scheduledHours} س
          </div>
          <div className="mt-2 text-[11px] text-[#747775]">
            الإشغال العام:{' '}
            <span className="font-mono-num font-semibold text-[#1F1F1F]">
              {overallOccupancyPct}%
            </span>
          </div>
        </div>

        <div className="relative w-[68px] h-[68px] shrink-0" dir="ltr">
          <PieChart width={68} height={68}>
            <Pie
              data={overallSlices}
              dataKey="value"
              cx="50%"
              cy="50%"
              innerRadius={22}
              outerRadius={31}
              startAngle={90}
              endAngle={-270}
              stroke="none"
              paddingAngle={overallSlices.length > 1 ? 2 : 0}
              isAnimationActive={false}
            >
              {overallSlices.map((entry, idx) => (
                <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
              ))}
            </Pie>
          </PieChart>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center font-mono-num text-[11px] font-bold text-[#1F1F1F]">
            {overallOccupancyPct}%
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="sm:col-span-2 lg:col-span-12 bg-white border border-[#DADCE0] rounded-2xl p-5 space-y-4">
      {/* Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-sm bg-[#0B57D0] shrink-0" aria-hidden="true" />
            <h2 className="font-display text-sm font-bold text-[#1F1F1F]">
              ساعات الدراسة المجدولة ونسبة إشغال القاعات
            </h2>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#444746]">
            <span>{formatShortArabicDate(selectedDate)}</span>
            <span aria-hidden="true" className="text-[#DADCE0]">
              ·
            </span>
            <span>
              التشغيل اليومي:{' '}
              <span className="font-mono-num font-semibold text-[#1F1F1F]">
                {dailyOperatingHours} س/قاعة
              </span>
            </span>
            <span aria-hidden="true" className="text-[#DADCE0]">
              ·
            </span>
            <span>
              السعة الكلية المتاحة:{' '}
              <span className="font-mono-num font-semibold text-[#1F1F1F]">
                {totalCapacityHours} س
              </span>
            </span>
          </div>
        </div>

        {/* Clean Unboxed Legend */}
        <div className="flex flex-wrap items-center gap-4 text-[11px] font-medium text-[#444746] shrink-0">
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#1A73E8]" aria-hidden="true" />
            <span>حجز مؤكد</span>
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#F9AB00]" aria-hidden="true" />
            <span>بانتظار الموافقة</span>
          </span>
          <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="w-2.5 h-2.5 rounded-sm bg-[#E8EAED]" aria-hidden="true" />
            <span>متاح للحجز</span>
          </span>
          {rooms.some((r) => r.isMaintenance) && (
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#F6AEA9]" aria-hidden="true" />
              <span>قيد الصيانة</span>
            </span>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="pt-4 border-t border-[#E8EAED] grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          <div className="lg:col-span-3 flex items-center gap-4">
            <div className="w-[120px] h-[120px] rounded-full bg-[#F0F4F9] animate-pulse shrink-0" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-20 rounded bg-[#E8EAED] animate-pulse" />
              <div className="h-3 w-28 rounded bg-[#F0F4F9] animate-pulse" />
            </div>
          </div>
          <div className="lg:col-span-9 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center gap-2 py-2">
                <div className="w-[96px] h-[96px] rounded-full bg-[#F0F4F9] animate-pulse" />
                <div className="h-3 w-24 rounded bg-[#E8EAED] animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="pt-4 border-t border-[#E8EAED] grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          {/* Overall Scheduled Hours & Total Occupancy Pie Chart */}
          <div className="lg:col-span-4 lg:pl-6 lg:border-l lg:border-[#E8EAED] flex items-center gap-5">
            <div className="relative w-[124px] h-[124px] shrink-0" dir="ltr">
              <PieChart width={124} height={124}>
                <Pie
                  data={overallSlices}
                  dataKey="value"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={56}
                  startAngle={90}
                  endAngle={-270}
                  stroke="none"
                  paddingAngle={overallSlices.length > 1 ? 2 : 0}
                  isAnimationActive={false}
                >
                  {overallSlices.map((entry, idx) => (
                    <Cell key={`${entry.name}-${idx}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  wrapperStyle={{ zIndex: 40, pointerEvents: 'none' }}
                  content={<PieSliceTooltip title="الإشغال الإجمالي للقاعات" />}
                />
              </PieChart>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="font-mono-num text-xl font-bold text-[#1F1F1F] leading-none">
                  {overallOccupancyPct}%
                </span>
                <span className="text-[10px] text-[#747775] mt-1">
                  الإشغال العام
                </span>
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <div className="text-xs text-[#444746]">إجمالي الساعات المجدولة</div>
                <div className="font-mono-num text-3xl font-semibold text-[#0B57D0] leading-tight mt-0.5">
                  {scheduledHours} س
                </div>
              </div>

              <div className="space-y-1 text-[11px] text-[#444746] pt-1 border-t border-[#E8EAED]">
                <div className="flex items-center justify-between gap-2">
                  <span>مؤكد:</span>
                  <span className="font-mono-num font-semibold text-[#0B57D0]">
                    {totalConfirmedHours} س ({overallConfirmedPct}%)
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>بانتظار الموافقة:</span>
                  <span className="font-mono-num font-semibold text-[#B06000]">
                    {totalPendingHours} س ({overallPendingPct}%)
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span>المتاح اليوم:</span>
                  <span className="font-mono-num font-semibold text-[#137333]">
                    {totalRemainingHours} س
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Per-Classroom Recharts Pie Charts */}
          <div className="lg:col-span-8">
            {rooms.length === 0 ? (
              <div className="py-6 text-center text-xs text-[#747775]">
                لا توجد قاعات دراسية مسجلة حالياً لعرض نسب الإشغال.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {rooms.map((room) => {
                  const roomSlices: PieSliceDatum[] = room.isMaintenance
                    ? [
                        {
                          name: 'قيد الصيانة',
                          value: 100,
                          pct: 0,
                          hours: 0,
                          color: '#F6AEA9',
                        },
                      ]
                    : [
                        ...(room.confirmedPct > 0
                          ? [
                              {
                                name: 'حجز مؤكد',
                                value: room.confirmedPct,
                                pct: room.confirmedPct,
                                hours: room.confirmedHours,
                                color: '#1A73E8',
                              },
                            ]
                          : []),
                        ...(room.pendingPct > 0
                          ? [
                              {
                                name: 'بانتظار الموافقة',
                                value: room.pendingPct,
                                pct: room.pendingPct,
                                hours: room.pendingHours,
                                color: '#F9AB00',
                              },
                            ]
                          : []),
                        ...(room.remainingPct > 0 || room.totalPct === 0
                          ? [
                              {
                                name: 'متاح للحجز',
                                value: room.totalPct === 0 ? 100 : room.remainingPct,
                                pct: room.totalPct === 0 ? 100 : room.remainingPct,
                                hours: Math.max(
                                  0,
                                  Math.round(
                                    (dailyOperatingHours - room.totalHours) * 10
                                  ) / 10
                                ),
                                color: '#E8EAED',
                              },
                            ]
                          : []),
                      ];

                  const pctColorClass = room.isMaintenance
                    ? 'text-[#C5221F]'
                    : room.totalPct >= 80
                      ? 'text-[#C5221F]'
                      : room.totalPct >= 45
                        ? 'text-[#0B57D0]'
                        : room.totalPct > 0
                          ? 'text-[#137333]'
                          : 'text-[#747775]';

                  const interactive = canQuickBook && !room.isMaintenance;
                  const innerBody = (
                    <div className="flex flex-col items-center text-center">
                      <div className="relative w-[96px] h-[96px]" dir="ltr">
                        <PieChart width={96} height={96}>
                          <Pie
                            data={roomSlices}
                            dataKey="value"
                            cx="50%"
                            cy="50%"
                            innerRadius={30}
                            outerRadius={43}
                            startAngle={90}
                            endAngle={-270}
                            stroke="none"
                            paddingAngle={roomSlices.length > 1 ? 2 : 0}
                            isAnimationActive={false}
                          >
                            {roomSlices.map((entry, idx) => (
                              <Cell key={`${room.id}-${idx}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip
                            wrapperStyle={{ zIndex: 40, pointerEvents: 'none' }}
                            content={
                              <PieSliceTooltip title={`${room.name} (${room.code})`} />
                            }
                          />
                        </PieChart>
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                          <span
                            className={`font-mono-num text-sm font-bold leading-none ${pctColorClass}`}
                          >
                            {room.isMaintenance ? 'صيانة' : `${room.totalPct}%`}
                          </span>
                        </div>
                      </div>

                      <div className="mt-2 w-full min-w-0 space-y-0.5">
                        <div className="text-xs font-bold text-[#1F1F1F] truncate">
                          {room.name}
                        </div>
                        <div className="text-[11px] text-[#747775] font-mono-num truncate">
                          {room.code} · {room.capacity} مقعد
                        </div>
                        <div className="text-[11px] text-[#444746] font-mono-num">
                          {room.isMaintenance
                            ? 'متوقفة مؤقتاً'
                            : `${room.totalHours} / ${dailyOperatingHours} س · ${room.sessionsCount} جلسة`}
                        </div>
                      </div>
                    </div>
                  );

                  if (interactive) {
                    return (
                      <button
                        key={room.id}
                        type="button"
                        onClick={() => onQuickBookRoom(room.id)}
                        title={`حجز سريع في ${room.name}`}
                        className="p-2.5 rounded-xl hover:bg-[#F8FAFD] transition-colors cursor-pointer w-full text-center"
                      >
                        {innerBody}
                      </button>
                    );
                  }

                  return (
                    <div key={room.id} className="p-2.5">
                      {innerBody}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
