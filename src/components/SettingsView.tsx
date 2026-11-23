import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  DatabaseBackup,
  Download,
  FileSpreadsheet,
  Save,
  Settings as SettingsIcon,
  Upload,
} from 'lucide-react';
import {
  AccountRecord,
  BLUEPRINT_LIMITS,
  Booking,
  Classroom,
  Department,
  SystemSettings,
} from '../types';
import {
  exportBookingsToCsv,
  getTodayISO,
  timeToMinutes,
} from '../utils/schedule';

export interface SystemBackupBundle {
  meta: {
    version: string;
    systemName: string;
    exportedAt: string;
    exportedBy: string;
  };
  settings?: Partial<SystemSettings>;
  classrooms: Partial<Classroom>[];
  departments: Partial<Department>[];
  bookings: Partial<Booking>[];
  accounts?: Partial<AccountRecord>[];
}

interface SettingsViewProps {
  settings: SystemSettings;
  classrooms: Classroom[];
  departments: Department[];
  bookings: Booking[];
  accounts: AccountRecord[];
  canManageAccounts: boolean;
  onSaveSettings: (next: SystemSettings) => Promise<void>;
  onRecordBackup: () => Promise<void>;
  onRestoreBackup: (bundle: SystemBackupBundle) => Promise<{
    classroomsCount: number;
    departmentsCount: number;
    bookingsCount: number;
    accountsCount: number;
  }>;
}

export function SettingsView({
  settings,
  classrooms,
  departments,
  bookings,
  accounts,
  canManageAccounts,
  onSaveSettings,
  onRecordBackup,
  onRestoreBackup,
}: SettingsViewProps) {
  const [form, setForm] = useState<SystemSettings>(settings);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [pendingRestore, setPendingRestore] = useState<SystemBackupBundle | null>(
    null
  );
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setForm(settings);
  }, [settings]);

  const handleSaveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (form.organizationName.trim().length < 2) {
      setErrorMsg('يرجى إدخال اسم القسم أو المؤسسة.');
      return;
    }
    if (timeToMinutes(form.workStartHour) >= timeToMinutes(form.workEndHour)) {
      setErrorMsg('يجب أن يكون وقت انتهاء الدوام بعد وقت البدء.');
      return;
    }
    if (
      form.maxAdvanceDays < 1 ||
      form.maxAdvanceDays > BLUEPRINT_LIMITS.MAX_ADVANCE_DAYS_MAX
    ) {
      setErrorMsg('مدة الحجز المسبق يجب أن تكون بين 1 و 365 يوماً.');
      return;
    }

    setSaving(true);
    try {
      await onSaveSettings({
        ...form,
        organizationName: form.organizationName
          .trim()
          .slice(0, BLUEPRINT_LIMITS.ORG_NAME_MAX),
        complexSubtitle: form.complexSubtitle
          .trim()
          .slice(0, BLUEPRINT_LIMITS.SUBTITLE_MAX),
        reportHeaderTitle: form.reportHeaderTitle
          .trim()
          .slice(0, BLUEPRINT_LIMITS.REPORT_HEADER_MAX),
        reportFooterNote: form.reportFooterNote
          .trim()
          .slice(0, BLUEPRINT_LIMITS.REPORT_FOOTER_MAX),
      });
      setSuccessMsg('تم حفظ إعدادات المنظومة وتطبيقها بنجاح.');
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : 'تعذر حفظ الإعدادات.'
      );
    } finally {
      setSaving(false);
    }
  };

  const handleExportJsonBackup = async () => {
    const cleanStrip = <T extends { createdAt?: unknown; updatedAt?: unknown }>(
      items: T[]
    ) =>
      items.map((item) => {
        const copy = { ...item };
        delete copy.createdAt;
        delete copy.updatedAt;
        return copy;
      });

    const bundle: SystemBackupBundle = {
      meta: {
        version: '1.0',
        systemName: form.organizationName,
        exportedAt: new Date().toISOString(),
        exportedBy: form.updatedBy || 'system-admin',
      },
      settings: {
        organizationName: form.organizationName,
        complexSubtitle: form.complexSubtitle,
        workStartHour: form.workStartHour,
        workEndHour: form.workEndHour,
        maxAdvanceDays: form.maxAdvanceDays,
        requireAdminApproval: form.requireAdminApproval,
        allowWeekendBookings: form.allowWeekendBookings,
        strictAccountAccess: form.strictAccountAccess,
        reportHeaderTitle: form.reportHeaderTitle,
        reportFooterNote: form.reportFooterNote,
      },
      classrooms: cleanStrip(classrooms),
      departments: cleanStrip(departments),
      bookings: cleanStrip(bookings),
      ...(canManageAccounts ? { accounts: cleanStrip(accounts) } : {}),
    };

    const blob = new Blob([JSON.stringify(bundle, null, 2)], {
      type: 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `backup-sayyid-alshuhada-${getTodayISO()}.json`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    await onRecordBackup();
  };

  const handleExportClassroomsCsv = () => {
    const headers = ['الرمز', 'اسم القاعة', 'الطابق', 'السعة', 'الحالة', 'التجهيزات', 'ملاحظات'];
    const rows = classrooms.map((r) => [
      r.code,
      r.name,
      r.floor,
      String(r.capacity),
      r.status === 'available' ? 'متاحة' : 'صيانة',
      r.equipment.join(' | '),
      r.notes,
    ]);
    const csv =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        )
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `classrooms-${getTodayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportDepartmentsCsv = () => {
    const headers = ['الرمز', 'اسم القسم', 'المرجعية', 'المخول بالتنسيق', 'الحالة', 'ملاحظات'];
    const rows = departments.map((d) => [
      d.code,
      d.name,
      d.sector,
      d.headName,
      d.status === 'active' ? 'مفعل' : 'موقوف',
      d.notes,
    ]);
    const csv =
      '\uFEFF' +
      [headers, ...rows]
        .map((row) =>
          row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
        )
        .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `departments-${getTodayISO()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBackupFileSelected = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setRestoreError(null);
    setRestoreSuccess(null);
    setPendingRestore(null);

    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as Partial<SystemBackupBundle>;
      if (
        !parsed ||
        typeof parsed !== 'object' ||
        !Array.isArray(parsed.classrooms) ||
        !Array.isArray(parsed.departments) ||
        !Array.isArray(parsed.bookings)
      ) {
        setRestoreError(
          'صيغة الملف غير صالحة. يرجى اختيار ملف نسخة احتياطية JSON صادر عن هذا النظام.'
        );
        return;
      }

      setPendingRestore({
        meta: parsed.meta || {
          version: '1.0',
          systemName: 'نسخة مستوردة',
          exportedAt: '',
          exportedBy: '',
        },
        settings: parsed.settings,
        classrooms: parsed.classrooms,
        departments: parsed.departments,
        bookings: parsed.bookings,
        accounts: Array.isArray(parsed.accounts) ? parsed.accounts : undefined,
      });
    } catch {
      setRestoreError('تعذر قراءة ملف النسخة الاحتياطية. تأكد من صحة ملف JSON.');
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingRestore) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const result = await onRestoreBackup(pendingRestore);
      setRestoreSuccess(
        `تمت الاستعادة بنجاح: ${result.classroomsCount} قاعة، ${result.departmentsCount} قسم، ${result.bookingsCount} حجز` +
          (result.accountsCount > 0 ? `، ${result.accountsCount} حساب` : '')
      );
      setPendingRestore(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setRestoreError(
        err instanceof Error ? err.message : 'حدث خطأ أثناء استعادة البيانات.'
      );
    } finally {
      setRestoring(false);
    }
  };

  return (
    <section className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center shrink-0 text-teal-800">
          <SettingsIcon className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            إعدادات المنظومة والنسخ الاحتياطي
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            تخصيص سياسات التشغيل وساعات الدوام وتصدير واستعادة النسخ الاحتياطية الشاملة لقاعدة البيانات
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* System & Policy Settings Form */}
        <form
          onSubmit={handleSaveSubmit}
          className="xl:col-span-7 bg-white border border-slate-200 rounded-xl p-6 space-y-5"
        >
          <div className="border-b border-slate-100 pb-3">
            <h3 className="font-display text-base font-bold text-slate-900">
              إعدادات التشغيل وسياسة الحجوزات
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              تنعكس هذه الإعدادات مباشرة على الجدول الدراسي، ترويسة التقارير، وصلاحيات الحجز
            </p>
          </div>

          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-xs text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 text-xs text-emerald-800 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                اسم القسم / المجمع الرئيسي
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.ORG_NAME_MAX}
                value={form.organizationName}
                onChange={(e) =>
                  setForm({ ...form, organizationName: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                العنوان الفرعي للمنظومة
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.SUBTITLE_MAX}
                value={form.complexSubtitle}
                onChange={(e) =>
                  setForm({ ...form, complexSubtitle: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                بداية الدوام اليومي للقاعات
              </label>
              <input
                type="time"
                value={form.workStartHour}
                onChange={(e) =>
                  setForm({ ...form, workStartHour: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                نهاية الدوام اليومي للقاعات
              </label>
              <input
                type="time"
                value={form.workEndHour}
                onChange={(e) =>
                  setForm({ ...form, workEndHour: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                أقصى مدة مسموحة للحجز المسبق (بالأيام)
              </label>
              <input
                type="number"
                min={1}
                max={BLUEPRINT_LIMITS.MAX_ADVANCE_DAYS_MAX}
                value={form.maxAdvanceDays}
                onChange={(e) =>
                  setForm({
                    ...form,
                    maxAdvanceDays: Number(e.target.value) || 30,
                  })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                ترويسة التقارير والطباعة الرسمية
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.REPORT_HEADER_MAX}
                value={form.reportHeaderTitle}
                onChange={(e) =>
                  setForm({ ...form, reportHeaderTitle: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                تذييل التقارير المطبوعة
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.REPORT_FOOTER_MAX}
                value={form.reportFooterNote}
                onChange={(e) =>
                  setForm({ ...form, reportFooterNote: e.target.value })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
              />
            </div>
          </div>

          <div className="space-y-2.5 pt-2 border-t border-slate-100">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.requireAdminApproval}
                onChange={(e) =>
                  setForm({ ...form, requireAdminApproval: e.target.checked })
                }
                className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  إخضاع طلبات الأقسام لموافقة الإدارة قبل التثبيت
                </div>
                <div className="text-[11px] text-slate-500">
                  تبقى الطلبات الجديدة بحالة «بانتظار الموافقة» لحين اعتمادها من الإدارة أو الشعبة المخولة
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.allowWeekendBookings}
                onChange={(e) =>
                  setForm({ ...form, allowWeekendBookings: e.target.checked })
                }
                className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  السماح بتسجيل الدورات والحجوزات في عطلة نهاية الأسبوع
                </div>
                <div className="text-[11px] text-slate-500">
                  إتاحة أيام الجمعة والسبت ضمن جدول القاعات للدورات المكثفة والندوات
                </div>
              </div>
            </label>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={form.strictAccountAccess}
                onChange={(e) =>
                  setForm({ ...form, strictAccountAccess: e.target.checked })
                }
                className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
              />
              <div>
                <div className="text-xs font-semibold text-slate-900">
                  حصر الدخول على الحسابات المضافة في صفحة الصلاحيات فقط
                </div>
                <div className="text-[11px] text-slate-500">
                  عند التفعيل، لا يُسمح لأي بريد إلكتروني غير مسجل بالوصول إلى المنظومة
                </div>
              </div>
            </label>
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'جاري الحفظ...' : 'حفظ إعدادات المنظومة'}</span>
            </button>
          </div>
        </form>

        {/* Backup & Restore Column */}
        <div className="xl:col-span-5 space-y-5">
          {/* Backup Export Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-slate-700">
                <DatabaseBackup className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  النسخ الاحتياطي وتصدير البيانات
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  احفظ نسخة احتياطية كاملة بصيغة JSON لاستعادتها مستقبلاً أو صدّر الجداول بصيغة CSV
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs border-y border-slate-100 py-3">
              <div>
                <span className="text-slate-500">القاعات المجهزة: </span>
                <strong className="font-mono-num text-slate-900">
                  {classrooms.length}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">الأقسام المعتمدة: </span>
                <strong className="font-mono-num text-slate-900">
                  {departments.length}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">سجل الحجوزات: </span>
                <strong className="font-mono-num text-slate-900">
                  {bookings.length}
                </strong>
              </div>
              <div>
                <span className="text-slate-500">الحسابات المضافة: </span>
                <strong className="font-mono-num text-slate-900">
                  {accounts.length}
                </strong>
              </div>
            </div>

            {settings.lastBackupAt && (
              <div className="text-[11px] text-slate-500">
                آخر نسخة احتياطية:{' '}
                <span className="font-mono-num text-slate-800">
                  {settings.lastBackupAt.slice(0, 16).replace('T', ' ')}
                </span>
                {settings.lastBackupBy ? ` · بواسطة ${settings.lastBackupBy}` : ''}
              </div>
            )}

            <button
              type="button"
              onClick={() => void handleExportJsonBackup()}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>تحميل نسخة احتياطية شاملة (JSON)</span>
            </button>

            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={handleExportClassroomsCsv}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                <span>القاعات CSV</span>
              </button>
              <button
                type="button"
                onClick={handleExportDepartmentsCsv}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                <span>الأقسام CSV</span>
              </button>
              <button
                type="button"
                onClick={() => exportBookingsToCsv(bookings)}
                className="inline-flex items-center justify-center gap-1 px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-[11px] font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-slate-500" />
                <span>الحجوزات CSV</span>
              </button>
            </div>
          </div>

          {/* Restore Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                استعادة من نسخة احتياطية
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                ارفع ملف النسخة الاحتياطية (JSON) لمعاينة محتوياته ودمجه بأمان مع قاعدة البيانات
              </p>
            </div>

            {restoreError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{restoreError}</span>
              </div>
            )}

            {restoreSuccess && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3.5 py-2.5 text-xs text-emerald-800 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{restoreSuccess}</span>
              </div>
            )}

            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleBackupFileSelected}
                className="block w-full text-xs text-slate-600 file:ml-3 file:py-2 file:px-3.5 file:rounded-lg file:border file:border-slate-200 file:text-xs file:font-semibold file:bg-slate-50 file:text-slate-700 hover:file:bg-slate-100 cursor-pointer"
              />
            </div>

            {pendingRestore && (
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <div className="text-xs font-semibold text-slate-900">
                  معاينة محتويات الملف المختار:
                </div>
                <div className="text-xs text-slate-600 space-y-1 font-mono-num">
                  <div>• القاعات الدراسية: {pendingRestore.classrooms.length}</div>
                  <div>• الأقسام المعتمدة: {pendingRestore.departments.length}</div>
                  <div>• سجلات الحجوزات: {pendingRestore.bookings.length}</div>
                  {pendingRestore.accounts && (
                    <div>• الحسابات: {pendingRestore.accounts.length}</div>
                  )}
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setPendingRestore(null);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-100 cursor-pointer"
                  >
                    إلغاء
                  </button>
                  <button
                    type="button"
                    disabled={restoring}
                    onClick={() => void handleConfirmRestore()}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-50 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{restoring ? 'جاري الاستعادة...' : 'تأكيد الاستعادة الآن'}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
