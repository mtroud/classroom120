import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { TrendingUp } from 'lucide-react';
import { Booking, Classroom } from '../types';
import { calculateDurationHours, isActiveBooking } from '../utils/schedule';

interface DepartmentYearlyTrendsD3Props {
  bookings: Booking[];
  classrooms: Classroom[];
  year: number;
  onYearChange: (year: number) => void;
  availableYears: number[];
  roomFilter: string;
}

type TrendMetric = 'hours' | 'count' | 'attendees';

const SHORT_ARABIC_MONTHS = [
  'ك٢',
  'شباط',
  'آذار',
  'نيسان',
  'أيار',
  'حزيران',
  'تموز',
  'آب',
  'أيلول',
  'ت١',
  'ت٢',
  'ك١',
];

const FULL_ARABIC_MONTHS = [
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

const SERIES_PALETTE = [
  '#1A73E8', // Google Blue
  '#1E8E3E', // Google Green
  '#F9AB00', // Google Yellow/Amber
  '#9334E6', // Google Purple
  '#D93025', // Google Red
  '#0097A7', // Google Cyan
];

interface MonthlyDeptDatum {
  monthIndex: number; // 0..11
  shortLabel: string;
  fullLabel: string;
  values: Record<string, number>;
}

interface HoveredState {
  monthIndex: number;
  xPx: number;
  yPx: number;
}

export function DepartmentYearlyTrendsD3({
  bookings,
  classrooms,
  year,
  onYearChange,
  availableYears,
  roomFilter,
}: DepartmentYearlyTrendsD3Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [metric, setMetric] = useState<TrendMetric>('hours');
  const [chartWidth, setChartWidth] = useState<number>(760);
  const [hiddenDepts, setHiddenDepts] = useState<Set<string>>(new Set());
  const [hoveredMonth, setHoveredMonth] = useState<HoveredState | null>(null);

  const yearBookings = useMemo(() => {
    const yearPrefix = `${year}-`;
    return bookings.filter(
      (b) =>
        b.date.startsWith(yearPrefix) &&
        isActiveBooking(b) &&
        (roomFilter === 'all' || b.roomId === roomFilter)
    );
  }, [bookings, year, roomFilter]);

  const { departments, monthlyData, totalsByDept } = useMemo(() => {
    const deptTotals = new Map<string, number>();

    for (const b of yearBookings) {
      const val =
        metric === 'hours'
          ? calculateDurationHours(b.startTime, b.endTime)
          : metric === 'count'
          ? 1
          : b.attendeesCount;
      deptTotals.set(b.department, (deptTotals.get(b.department) || 0) + val);
    }

    const sortedDepts = Array.from(deptTotals.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([name]) => name);

    const rows: MonthlyDeptDatum[] = Array.from({ length: 12 }, (_, mIdx) => {
      const values: Record<string, number> = {};
      for (const d of sortedDepts) values[d] = 0;
      return {
        monthIndex: mIdx,
        shortLabel: SHORT_ARABIC_MONTHS[mIdx],
        fullLabel: FULL_ARABIC_MONTHS[mIdx],
        values,
      };
    });

    for (const b of yearBookings) {
      if (!sortedDepts.includes(b.department)) continue;
      const monthNum = Number(b.date.slice(5, 7));
      if (monthNum < 1 || monthNum > 12) continue;
      const val =
        metric === 'hours'
          ? calculateDurationHours(b.startTime, b.endTime)
          : metric === 'count'
          ? 1
          : b.attendeesCount;
      rows[monthNum - 1].values[b.department] =
        Math.round((rows[monthNum - 1].values[b.department] + val) * 10) / 10;
    }

    const cleanTotals: Record<string, number> = {};
    for (const d of sortedDepts) {
      cleanTotals[d] = Math.round((deptTotals.get(d) || 0) * 10) / 10;
    }

    return {
      departments: sortedDepts,
      monthlyData: rows,
      totalsByDept: cleanTotals,
    };
  }, [yearBookings, metric]);

  const visibleDepartments = useMemo(
    () => departments.filter((d) => !hiddenDepts.has(d)),
    [departments, hiddenDepts]
  );

  // Responsive container width observer
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateWidth = () => {
      const next = Math.max(320, Math.floor(el.getBoundingClientRect().width));
      setChartWidth(next);
    };
    updateWidth();
    const ro = new ResizeObserver(() => updateWidth());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // D3 rendering pipeline
  useEffect(() => {
    const svgEl = svgRef.current;
    if (!svgEl) return;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();

    if (departments.length === 0) return;

    const height = 300;
    const margin = { top: 20, right: 24, bottom: 34, left: 46 };
    const innerWidth = Math.max(200, chartWidth - margin.left - margin.right);
    const innerHeight = height - margin.top - margin.bottom;

    svg
      .attr('width', chartWidth)
      .attr('height', height)
      .attr('viewBox', `0 0 ${chartWidth} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const xScale = d3
      .scalePoint<number>()
      .domain(d3.range(12))
      .range([0, innerWidth])
      .padding(0.35);

    let maxValue = 0;
    for (const row of monthlyData) {
      for (const dept of visibleDepartments) {
        if (row.values[dept] > maxValue) {
          maxValue = row.values[dept];
        }
      }
    }
    const yMax = maxValue > 0 ? Math.ceil(maxValue * 1.15) : 10;

    const yScale = d3
      .scaleLinear()
      .domain([0, yMax])
      .nice()
      .range([innerHeight, 0]);

    // Horizontal dashed gridlines
    g.append('g')
      .attr('class', 'd3-grid')
      .call(
        d3
          .axisLeft(yScale)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .call((grid) => {
        grid.select('.domain').remove();
        grid
          .selectAll('line')
          .attr('stroke', '#E8EAED')
          .attr('stroke-dasharray', '3,3');
      });

    // Y axis
    g.append('g')
      .call(d3.axisLeft(yScale).ticks(5))
      .call((axis) => {
        axis.select('.domain').remove();
        axis.selectAll('line').remove();
        axis
          .selectAll('text')
          .attr('fill', '#747775')
          .attr('font-size', '11px')
          .attr('font-family', 'IBM Plex Mono, monospace');
      });

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .call(
        d3
          .axisBottom(xScale)
          .tickFormat((d) => SHORT_ARABIC_MONTHS[Number(d)] || '')
      )
      .call((axis) => {
        axis.select('.domain').attr('stroke', '#DADCE0');
        axis.selectAll('line').attr('stroke', '#DADCE0');
        axis
          .selectAll('text')
          .attr('fill', '#444746')
          .attr('font-size', '11px')
          .attr('font-family', 'IBM Plex Sans Arabic, sans-serif');
      });

    // Subtle area fill for primary visible series
    if (visibleDepartments.length === 1) {
      const singleDept = visibleDepartments[0];
      const idx = departments.indexOf(singleDept);
      const color = SERIES_PALETTE[idx % SERIES_PALETTE.length];
      const areaGen = d3
        .area<MonthlyDeptDatum>()
        .x((d) => xScale(d.monthIndex) ?? 0)
        .y0(innerHeight)
        .y1((d) => yScale(d.values[singleDept] || 0))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(monthlyData)
        .attr('fill', color)
        .attr('fill-opacity', 0.1)
        .attr('d', areaGen);
    }

    // Draw line and data points for each visible department
    visibleDepartments.forEach((dept) => {
      const colorIndex = departments.indexOf(dept);
      const color = SERIES_PALETTE[colorIndex % SERIES_PALETTE.length];

      const lineGen = d3
        .line<MonthlyDeptDatum>()
        .x((d) => xScale(d.monthIndex) ?? 0)
        .y((d) => yScale(d.values[dept] || 0))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(monthlyData)
        .attr('fill', 'none')
        .attr('stroke', color)
        .attr('stroke-width', 2.25)
        .attr('stroke-linecap', 'round')
        .attr('d', lineGen);

      g.selectAll(`.dot-${colorIndex}`)
        .data(monthlyData)
        .enter()
        .append('circle')
        .attr('cx', (d) => xScale(d.monthIndex) ?? 0)
        .attr('cy', (d) => yScale(d.values[dept] || 0))
        .attr('r', (d) =>
          hoveredMonth?.monthIndex === d.monthIndex ? 5 : 3.2
        )
        .attr('fill', '#FFFFFF')
        .attr('stroke', color)
        .attr('stroke-width', 2);
    });

    // Crosshair line on hover
    if (hoveredMonth) {
      const hx = xScale(hoveredMonth.monthIndex) ?? 0;
      g.append('line')
        .attr('x1', hx)
        .attr('x2', hx)
        .attr('y1', 0)
        .attr('y2', innerHeight)
        .attr('stroke', '#9AA0A6')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '4,3');
    }

    // Interactive invisible hover columns per month
    const colWidth = innerWidth / 12;
    g.selectAll('.hover-col')
      .data(monthlyData)
      .enter()
      .append('rect')
      .attr('x', (d) => (xScale(d.monthIndex) ?? 0) - colWidth / 2)
      .attr('y', 0)
      .attr('width', colWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .style('cursor', 'crosshair')
      .on('mouseenter mousemove', (_event, d) => {
        const cx = (xScale(d.monthIndex) ?? 0) + margin.left;
        setHoveredMonth({
          monthIndex: d.monthIndex,
          xPx: cx,
          yPx: margin.top + 8,
        });
      })
      .on('mouseleave', () => {
        setHoveredMonth(null);
      });
  }, [chartWidth, departments, visibleDepartments, monthlyData, hoveredMonth]);

  const toggleDeptVisibility = (dept: string) => {
    setHiddenDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) {
        next.delete(dept);
      } else if (departments.length - next.size > 1) {
        next.add(dept);
      }
      return next;
    });
  };

  const metricUnit =
    metric === 'hours' ? 'س' : metric === 'count' ? 'حجز' : 'طالب';

  const selectedRoomLabel =
    roomFilter === 'all'
      ? 'جميع القاعات'
      : classrooms.find((r) => r.id === roomFilter)?.name || 'قاعة محددة';

  const hoveredDatum =
    hoveredMonth !== null ? monthlyData[hoveredMonth.monthIndex] : null;

  return (
    <div className="bg-white border border-[#DADCE0] rounded-2xl p-5 space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#0B57D0] shrink-0" />
            <h3 className="font-display text-sm font-bold text-[#1F1F1F]">
              تحليل الاتجاهات السنوية لحجوزات الأقسام (D3.js)
            </h3>
          </div>
          <p className="text-xs text-[#747775] mt-1">
            التوزع الشهري لأكثر الأقسام نشاطاً على مدار سنة{' '}
            <span className="font-mono-num">{year}</span> · النطاق: {selectedRoomLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 no-print">
          <div className="inline-flex items-center p-1 bg-[#F0F4F9] rounded-xl">
            {(
              [
                ['hours', 'ساعات التشغيل'],
                ['count', 'عدد الحجوزات'],
                ['attendees', 'المستفيدون'],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMetric(key)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  metric === key
                    ? 'bg-white text-[#0B57D0] font-semibold g-elevation-1'
                    : 'text-[#444746] font-medium hover:text-[#1F1F1F]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <select
            value={year}
            onChange={(e) => onYearChange(Number(e.target.value))}
            className="rounded-xl border border-[#DADCE0] bg-white px-3 py-1.5 text-xs font-mono-num text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
            aria-label="سنة التحليل السنوي"
          >
            {availableYears.map((y) => (
              <option key={y} value={y}>
                السنة {y}
              </option>
            ))}
          </select>
        </div>
      </div>

      {departments.length === 0 ? (
        <div className="py-14 text-center text-xs text-[#747775] border border-dashed border-[#DADCE0] rounded-xl bg-[#F8FAFD]">
          لا توجد حجوزات فعالة مسجلة في سنة {year} لتحليل اتجاهات الأقسام.
        </div>
      ) : (
        <>
          {/* Interactive Department Legend Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {departments.map((dept, idx) => {
              const color = SERIES_PALETTE[idx % SERIES_PALETTE.length];
              const isHidden = hiddenDepts.has(dept);
              return (
                <button
                  key={dept}
                  type="button"
                  onClick={() => toggleDeptVisibility(dept)}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    isHidden
                      ? 'bg-[#F8FAFD] border-[#E8EAED] text-[#9AA0A6]'
                      : 'bg-white border-[#DADCE0] text-[#1F1F1F] hover:bg-[#F0F4F9]'
                  }`}
                  title={isHidden ? 'انقر لإظهار هذا القسم' : 'انقر لإخفاء هذا القسم'}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{
                      backgroundColor: isHidden ? '#DADCE0' : color,
                    }}
                  />
                  <span className={isHidden ? 'line-through' : 'font-medium'}>
                    {dept}
                  </span>
                  <span className="font-mono-num text-[11px] text-[#747775]">
                    ({totalsByDept[dept]} {metricUnit})
                  </span>
                </button>
              );
            })}
          </div>

          {/* D3 Responsive SVG Viewport */}
          <div ref={containerRef} className="relative w-full min-w-0" dir="ltr">
            <svg ref={svgRef} className="w-full block overflow-visible" />

            {hoveredMonth && hoveredDatum && (
              <div
                dir="rtl"
                className="pointer-events-none absolute z-20 bg-white border border-[#DADCE0] rounded-xl g-elevation-2 px-3.5 py-2.5 text-xs min-w-[210px] space-y-1.5"
                style={{
                  top: `${hoveredMonth.yPx}px`,
                  left:
                    hoveredMonth.xPx > chartWidth * 0.58
                      ? `${Math.max(8, hoveredMonth.xPx - 225)}px`
                      : `${Math.min(chartWidth - 225, hoveredMonth.xPx + 14)}px`,
                }}
              >
                <div className="font-bold text-[#1F1F1F] border-b border-[#E8EAED] pb-1">
                  {hoveredDatum.fullLabel} {year}
                </div>
                <div className="space-y-1">
                  {visibleDepartments.map((dept) => {
                    const colorIndex = departments.indexOf(dept);
                    const color = SERIES_PALETTE[colorIndex % SERIES_PALETTE.length];
                    return (
                      <div
                        key={dept}
                        className="flex items-center justify-between gap-4 text-[11px]"
                      >
                        <span className="inline-flex items-center gap-1.5 text-[#444746] truncate max-w-[140px]">
                          <span
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="truncate">{dept}</span>
                        </span>
                        <strong className="font-mono-num text-[#1F1F1F] shrink-0">
                          {hoveredDatum.values[dept] || 0} {metricUnit}
                        </strong>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
