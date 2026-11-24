import { useMemo, useState } from 'react';
import {
  Ban,
  CheckCircle2,
  Download,
  History,
  Pencil,
  PlusCircle,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import {
  AuditActionType,
  AuditEntityType,
  AuditLogEntry,
  SystemSettings,
} from '../types';
import { ROLE_LABEL_AR } from '../utils/permissions';
import { getTodayISO } from '../utils/schedule';

interface AuditLogViewProps {
  logs: AuditLogEntry[];
  isLoading: boolean;
  canViewAdminCategories: boolean;
  settings: SystemSettings;
}

const ENTITY_TYPE_LABEL: Record<AuditEntityType, string> = {
  booking: 'الحجوزات',
  classroom: 'القاعات المجهزة',
  department: 'الأقسام',
  account: 'الحسابات والصلاحيات',
  settings: 'الإعدادات والنسخ',
};

const ACTION_LABEL: Record<AuditActionType, string> = {
  create: 'إنشاء / حجز',
  update: 'تعديل',
  approve: 'موافقة واعتماد',
  reject: 'رفض طلب',
  cancel: 'إلغاء حجز',
  delete: 'حذف',
  restore: 'استعادة / نسخ',
};

const ACTION_COLOR_CLASS: Record<AuditActionType, string> = {
  create: 'text-[#0B57D0]',
  approve: 'text-[#137333]',
  update: 'text-[#0B57D0]',
  reject: 'text-[#B06000]',
  cancel: 'text-[#B06000]',
  delete: 'text-[#C5221F]',
  restore: 'text-[#444746]',
};

export function resolveAuditTimestampMs(ts: unknown): number {
  if (!ts) return 0;
  if (typeof ts === 'object') {
    const maybeTs = ts as { toDate?: () => Date; seconds?: number };
    if (typeof maybeTs.toDate === 'function') {
      return maybeTs.toDate().getTime();
    }
    if (typeof maybeTs.seconds === 'number') {
      return maybeTs.seconds * 1000;
    }
  }
  if (ts instanceof Date) return ts.getTime();
  if (typeof ts === 'string' || typeof ts === 'number') {
    const parsed = new Date(ts).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function toLocalDateISO(ms: number): string {
  if (!ms) return '';
  const dt = new Date(ms);
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, '0');
  const d = String(dt.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatAuditDatePart(ms: number): string {
  if (!ms) return 'قيد التزامن';
  return new Intl.DateTimeFormat('ar-IQ', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(ms));
}

function formatAuditTimePart(ms: number): string {
  if (!ms) return 'الآن';
  return new Intl.DateTimeFormat('ar-IQ', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  }).format(new Date(ms));
}

function renderActionIcon(action: AuditActionType) {
  switch (action) {
    case 'create':
      return <PlusCircle className="w-3.5 h-3.5 shrink-0" />;
    case 'approve':
      return <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />;
    case 'update':
      return <Pencil className="w-3.5 h-3.5 shrink-0" />;
    case 'reject':
      return <XCircle className="w-3.5 h-3.5 shrink-0" />;
    case 'cancel':
      return <Ban className="w-3.5 h-3.5 shrink-0" />;
    case 'delete':
      return <Trash2 className="w-3.5 h-3.5 shrink-0" />;
    case 'restore':
      return <RotateCcw className="w-3.5 h-3.5 shrink-0" />;
  }
}

export function AuditLogView({
  logs,
  isLoading,
  canViewAdminCategories,
  settings,
}: AuditLogViewProps) {
  const [searchText, setSearchText] = useState('');
  const [entityFilter, setEntityFilter] = useState<'all' | AuditEntityType>('all');
  const [actionFilter, setActionFilter] = useState<'all' | AuditActionType>('all');
  const [dateFilter, setDateFilter] = useState('');

  const todayISO = getTodayISO();

  const sortedLogs = useMemo(() => {
    return [...logs].sort((a, b) => {
      const aMs = resolveAuditTimestampMs(a.createdAt);
      const bMs = resolveAuditTimestampMs(b.createdAt);
      if (aMs === 0 && bMs !== 0) return -1;
      if (bMs === 0 && aMs !== 0) return 1;
      return bMs - aMs;
    });
  }, [logs]);

  const stats = useMemo(() => {
    let bookingOps = 0;
    let classroomOps = 0;
    let todayOps = 0;

    for (const item of sortedLogs) {
      if (item.entityType === 'booking') bookingOps += 1;
      if (item.entityType === 'classroom') classroomOps += 1;
      const ms = resolveAuditTimestampMs(item.createdAt);
      if (!ms || toLocalDateISO(ms) === todayISO) {
        todayOps += 1;
      }
    }

    return {
      total: sortedLogs.length,
      bookingOps,
      classroomOps,
      todayOps,
    };
  }, [sortedLogs, todayISO]);

  const filteredLogs = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return sortedLogs.filter((entry) => {
      if (entityFilter !== 'all' && entry.entityType !== entityFilter) return false;
      if (actionFilter !== 'all' && entry.action !== actionFilter) return false;
      if (dateFilter) {
        const ms = resolveAuditTimestampMs(entry.createdAt);
        const entryDateISO = ms ? toLocalDateISO(ms) : todayISO;
        if (entryDateISO !== dateFilter) return false;
      }
      if (q) {
        const hay = [
          entry.actorName,
          entry.branchName,
          entry.entityLabel,
          entry.summary,
          ENTITY_TYPE_LABEL[entry.entityType],
          ACTION_LABEL[entry.action],
        ]
          .join(' ')
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sortedLogs, entityFilter, actionFilter, dateFilter, searchText, todayISO]);

  const handleExportCsv = () => {
    const headers = [
      'التاريخ',
      'الوقت',
      'المنفذ',
      'الشعبة / الجهة',
      'الصفة',
      'القسم في النظام',
      'نوع العملية',
      'العنصر المتأثر',
      'التفاصيل',
    ];
    const rows = filteredLogs.map((entry) => {
      const ms = resolveAuditTimestampMs(entry.createdAt);
      return [
        formatAuditDatePart(ms),
        formatAuditTimePart(ms),
        entry.actorName,
        entry.branchName,
        ROLE_LABEL_AR[entry.actorRole] || entry.actorRole,
        ENTITY_TYPE_LABEL[entry.entityType],
        ACTION_LABEL[entry.action],
        entry.entityLabel,
        entry.summary,
      ];
    });
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
    link.setAttribute('download', `audit-log-${todayISO}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const entityTabs: { id: 'all' | AuditEntityType; label: string }[] = [
    { id: 'all', label: 'جميع العمليات' },
    { id: 'booking', label: 'الحجوزات' },
    { id: 'classroom', label: 'القاعات' },
    { id: 'department', label: 'الأقسام' },
    ...(canViewAdminCategories
      ? [
          { id: 'account' as AuditEntityType, label: 'الحسابات' },
          { id: 'settings' as AuditEntityType, label: 'الإعدادات' },
        ]
      : []),
  ];

  if (isLoading) {
    return (
      <div className="bg-white border border-[#DADCE0] rounded-2xl p-6 space-y-4">
        <div className="h-8 bg-[#F0F4F9] rounded-xl w-60" />
        <div className="space-y-2.5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-11 bg-[#F8FAFD] border border-[#E8EAED] rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section className="space-y-5">
      {/* Print Header */}
      <div className="hidden print:block border-b border-[#DADCE0] pb-3">
        <h1 className="font-display text-xl font-bold text-[#1F1F1F]">
          {settings.reportHeaderTitle} — سجل العمليات والتدقيق الإداري
        </h1>
        <p className="text-xs text-[#444746] mt-1">
          تاريخ الطباعة: {todayISO} · عدد السجلات المعروضة: {filteredLogs.length}
        </p>
      </div>

      {/* Header & Actions */}
      <div className="bg-white border border-[#DADCE0] rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 no-print">
        <div>
          <h2 className="font-display text-base font-bold text-[#1F1F1F]">
            سجل العمليات والتدقيق (Audit Log)
          </h2>
          <p className="text-xs text-[#747775] mt-1">
            توثيق زمني غير قابل للتعديل لعمليات حجز القاعات وتعديلها واعتمادها أو حذفها مع تحديد المنفذ والوقت الدقيق.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DADCE0] bg-white text-xs font-medium text-[#1F1F1F] hover:bg-[#F0F4F9] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#444746]" />
            <span>تصدير CSV</span>
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            disabled={filteredLogs.length === 0}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-[#DADCE0] bg-white text-xs font-medium text-[#1F1F1F] hover:bg-[#F0F4F9] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Printer className="w-4 h-4 text-[#444746]" />
            <span>طباعة السجل</span>
          </button>
        </div>
      </div>

      {/* Audit Summary Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 no-print">
        <div className="bg-white border border-[#DADCE0] rounded-2xl p-4">
          <div className="text-xs text-[#444746]">إجمالي العمليات المسجلة</div>
          <div className="font-mono-num text-2xl font-semibold text-[#1F1F1F] mt-1">
            {stats.total}
          </div>
        </div>
        <div className="bg-white border border-[#DADCE0] rounded-2xl p-4">
          <div className="text-xs text-[#444746]">عمليات الحجز والجدول</div>
          <div className="font-mono-num text-2xl font-semibold text-[#0B57D0] mt-1">
            {stats.bookingOps}
          </div>
        </div>
        <div className="bg-white border border-[#DADCE0] rounded-2xl p-4">
          <div className="text-xs text-[#444746]">عمليات القاعات المجهزة</div>
          <div className="font-mono-num text-2xl font-semibold text-[#137333] mt-1">
            {stats.classroomOps}
          </div>
        </div>
        <div className="bg-white border border-[#DADCE0] rounded-2xl p-4">
          <div className="text-xs text-[#444746]">عمليات اليوم</div>
          <div className="font-mono-num text-2xl font-semibold text-[#B06000] mt-1">
            {stats.todayOps}
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="bg-white border border-[#DADCE0] rounded-2xl p-4 space-y-3 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-[#F0F4F9] rounded-xl">
            {entityTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setEntityFilter(tab.id)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  entityFilter === tab.id
                    ? 'bg-white text-[#0B57D0] font-semibold g-elevation-1'
                    : 'text-[#444746] font-medium hover:text-[#1F1F1F]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="text-xs font-mono-num text-[#747775]">
            عرض {filteredLogs.length} من {sortedLogs.length}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-[#747775] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="ابحث باسم المستخدم، الشعبة، القاعة، عنوان الدورة، أو تفاصيل العملية..."
              className="w-full pr-9 pl-3 py-2 text-xs border border-[#DADCE0] bg-white text-[#1F1F1F] placeholder:text-[#747775] rounded-xl focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
            />
          </div>

          <div className="md:col-span-3">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value as 'all' | AuditActionType)}
              className="w-full px-3 py-2 text-xs border border-[#DADCE0] rounded-xl bg-white text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
              aria-label="تصفية حسب نوع العملية"
            >
              <option value="all">جميع أنواع العمليات</option>
              <option value="create">إنشاء / حجز</option>
              <option value="update">تعديل بيانات</option>
              <option value="approve">موافقة واعتماد</option>
              <option value="reject">رفض طلب</option>
              <option value="cancel">إلغاء حجز</option>
              <option value="delete">حذف</option>
              <option value="restore">استعادة / نسخ احتياطي</option>
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="flex-1 px-3 py-2 text-xs font-mono-num border border-[#DADCE0] rounded-xl bg-white text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
              aria-label="تصفية حسب تاريخ العملية"
            />
            {(dateFilter || searchText || actionFilter !== 'all' || entityFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setDateFilter('');
                  setSearchText('');
                  setActionFilter('all');
                  setEntityFilter('all');
                }}
                className="px-2.5 py-2 text-xs font-medium text-[#444746] hover:text-[#1F1F1F] border border-[#DADCE0] rounded-xl hover:bg-[#F0F4F9] whitespace-nowrap shrink-0 cursor-pointer"
              >
                مسح
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-[#DADCE0] rounded-2xl overflow-hidden">
        {filteredLogs.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <History className="w-8 h-8 text-[#9AA0A6] mx-auto" />
            <p className="text-sm font-medium text-[#1F1F1F]">
              {sortedLogs.length === 0
                ? 'لا توجد عمليات مسجلة في سجل التدقيق حتى الآن.'
                : 'لا توجد نتائج تطابق شروط البحث والتصفية المحددة.'}
            </p>
            <p className="text-xs text-[#747775]">
              تُسجّل تلقائياً جميع عمليات حجز القاعات وتعديلها والموافقة عليها وحذفها فور تنفيذها مع الطابع الزمني.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right border-collapse min-w-[920px]">
              <thead>
                <tr className="bg-[#F8FAFD] border-b border-[#DADCE0] text-[11px] font-semibold text-[#444746]">
                  <th className="px-4 py-3 whitespace-nowrap">الطابع الزمني</th>
                  <th className="px-4 py-3 whitespace-nowrap">نوع العملية</th>
                  <th className="px-4 py-3 whitespace-nowrap">القسم والعنصر</th>
                  <th className="px-4 py-3">تفاصيل الإجراء</th>
                  <th className="px-4 py-3 whitespace-nowrap">المستخدم المنفذ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EAED] text-xs">
                {filteredLogs.map((entry) => {
                  const ms = resolveAuditTimestampMs(entry.createdAt);
                  return (
                    <tr key={entry.id} className="hover:bg-[#F8FAFD] transition-colors">
                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        <div className="font-mono-num font-medium text-[#1F1F1F]">
                          {formatAuditDatePart(ms)}
                        </div>
                        <div className="font-mono-num text-[11px] text-[#747775] mt-0.5">
                          {formatAuditTimePart(ms)}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        <div
                          className={`inline-flex items-center gap-1.5 font-semibold ${ACTION_COLOR_CLASS[entry.action]}`}
                        >
                          {renderActionIcon(entry.action)}
                          <span>{ACTION_LABEL[entry.action]}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top max-w-[240px]">
                        <div className="text-[11px] text-[#747775]">
                          {ENTITY_TYPE_LABEL[entry.entityType]}
                        </div>
                        <div className="font-semibold text-[#1F1F1F] mt-0.5 truncate" title={entry.entityLabel}>
                          {entry.entityLabel}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top text-[#444746] leading-relaxed max-w-[340px]">
                        {entry.summary}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap align-top">
                        <div className="font-semibold text-[#1F1F1F]">
                          {entry.actorName}
                        </div>
                        <div className="text-[11px] text-[#747775] mt-0.5 flex items-center gap-1.5">
                          <span>{entry.branchName}</span>
                          <span aria-hidden="true">·</span>
                          <span>{ROLE_LABEL_AR[entry.actorRole] || entry.actorRole}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Print Footer */}
      {settings.reportFooterNote && (
        <div className="hidden print:block text-center text-xs text-[#747775] pt-4 border-t border-[#DADCE0]">
          {settings.reportFooterNote}
        </div>
      )}
    </section>
  );
}
