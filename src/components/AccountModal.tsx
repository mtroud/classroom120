import React, { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import {
  AccountPermissions,
  AccountStatus,
  BLUEPRINT_LIMITS,
  Department,
  UserRole,
} from '../types';
import {
  COMPLEX_BRANCH_SUGGESTIONS,
  PERMISSION_ITEMS,
  ROLE_LABEL_AR,
  defaultPermissionsForRole,
} from '../utils/permissions';

export interface AccountDraft {
  id?: string;
  email: string;
  displayName: string;
  branchName: string;
  role: UserRole;
  status: AccountStatus;
  permissions: AccountPermissions;
  notes: string;
}

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: AccountDraft) => Promise<void>;
  initialDraft: AccountDraft;
  departments: Department[];
}

export function AccountModal({
  isOpen,
  onClose,
  onSave,
  initialDraft,
  departments,
}: AccountModalProps) {
  const [form, setForm] = useState<AccountDraft>(initialDraft);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setForm(initialDraft);
    setErrorMsg(null);
  }, [initialDraft, isOpen]);

  if (!isOpen) return null;

  const handleRoleChange = (nextRole: UserRole) => {
    setForm((prev) => ({
      ...prev,
      role: nextRole,
      permissions: defaultPermissionsForRole(nextRole),
    }));
  };

  const togglePermission = (key: keyof AccountPermissions) => {
    setForm((prev) => ({
      ...prev,
      permissions: {
        ...prev.permissions,
        [key]: !prev.permissions[key],
      },
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const normalizedEmail = form.email.trim().toLowerCase();
    if (!normalizedEmail.includes('@') || normalizedEmail.length < 5) {
      setErrorMsg('يرجى إدخال بريد إلكتروني (Google) صالح.');
      return;
    }
    if (form.displayName.trim().length < 2) {
      setErrorMsg('يرجى إدخال اسم المنتسب أو مسؤول الشعبة (حرفين على الأقل).');
      return;
    }
    if (form.branchName.trim().length < 1) {
      setErrorMsg('يرجى تحديد الشعبة أو الوحدة الإدارية.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...form,
        email: normalizedEmail.slice(0, BLUEPRINT_LIMITS.EMAIL_MAX),
        displayName: form.displayName.trim().slice(0, BLUEPRINT_LIMITS.DISPLAY_NAME_MAX),
        branchName: form.branchName.trim().slice(0, BLUEPRINT_LIMITS.BRANCH_NAME_MAX),
        notes: form.notes.trim().slice(0, BLUEPRINT_LIMITS.NOTES_MAX),
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر حفظ بيانات الحساب.');
    } finally {
      setSaving(false);
    }
  };

  const branchOptions = Array.from(
    new Set([
      ...COMPLEX_BRANCH_SUGGESTIONS,
      ...departments.map((d) => d.name),
    ])
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2
              id="account-modal-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              {form.id ? 'تعديل صلاحيات الحساب' : 'إضافة حساب شعبة أو منتسب جديد'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              تخصيص الصلاحيات التشغيلية حسب الشعبة أو إتاحة الاطلاع للمنتسبين عبر حساب Google
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                البريد الإلكتروني المعتمد (Google Email)
              </label>
              <input
                type="email"
                dir="ltr"
                disabled={Boolean(form.id)}
                maxLength={BLUEPRINT_LIMITS.EMAIL_MAX}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="name@gmail.com"
                className="w-full rounded-lg border border-slate-200 bg-white disabled:bg-slate-50 disabled:text-slate-500 px-3 py-2.5 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-teal-700 text-left"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                اسم المسؤول أو المنتسب
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.DISPLAY_NAME_MAX}
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="الاسم الكامل أو اللقب الإداري"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                الشعبة / القسم التابع له
              </label>
              <input
                type="text"
                list="branch-suggestions"
                maxLength={BLUEPRINT_LIMITS.BRANCH_NAME_MAX}
                value={form.branchName}
                onChange={(e) => setForm({ ...form, branchName: e.target.value })}
                placeholder="اختر أو اكتب اسم الشعبة"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
              <datalist id="branch-suggestions">
                {branchOptions.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                نوع الحساب (الدور)
              </label>
              <select
                value={form.role}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
              >
                {(Object.keys(ROLE_LABEL_AR) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL_AR[r]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                حالة الحساب
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as AccountStatus })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
              >
                <option value="active">نشط (مصرح بالدخول)</option>
                <option value="suspended">معلق (إيقاف الصلاحية مؤقتاً)</option>
              </select>
            </div>
          </div>

          {/* Granular Permissions per Branch */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800">
                الصلاحيات التفصيلية للشعبة / الحساب
              </span>
              <span className="text-[11px] text-slate-500">
                {form.role === 'admin'
                  ? 'يمتلك مدير النظام جميع الصلاحيات تلقائياً'
                  : form.role === 'viewer'
                    ? 'حساب اطلاع على جدول الدورات (يمكن تفعيل التقارير أدناه)'
                    : 'حدد المهام المخولة لهذه الشعبة'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PERMISSION_ITEMS.map((item) => {
                const disabled =
                  form.role === 'admin' ||
                  (form.role === 'viewer' && item.key !== 'viewReports') ||
                  (form.role === 'coordinator' && item.key !== 'viewReports');
                const checked = form.permissions[item.key];
                return (
                  <label
                    key={item.key}
                    className={`flex items-start gap-2.5 p-3 rounded-lg border transition-colors ${
                      checked
                        ? 'border-teal-300 bg-teal-50/40'
                        : 'border-slate-200 bg-white'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-slate-300'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => togglePermission(item.key)}
                      className="mt-0.5 rounded border-slate-300 text-teal-700 focus:ring-teal-700"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-slate-900">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 leading-snug">
                        {item.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1.5">
              ملاحظات إدارية (اختياري)
            </label>
            <textarea
              rows={2}
              maxLength={BLUEPRINT_LIMITS.NOTES_MAX}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="ملاحظات حول نطاق مسؤولية الشعبة أو مدة التخويل..."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-700 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saving ? 'جاري الحفظ...' : form.id ? 'حفظ الصلاحيات' : 'إضافة الحساب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
