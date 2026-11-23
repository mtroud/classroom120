import React, { useEffect, useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import { BLUEPRINT_LIMITS, DepartmentStatus } from '../types';

export interface DepartmentDraft {
  id?: string;
  name: string;
  code: string;
  headName: string;
  sector: string;
  status: DepartmentStatus;
  notes: string;
}

interface DepartmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: DepartmentDraft) => Promise<void>;
  initialDraft: DepartmentDraft;
}

export function DepartmentModal({
  isOpen,
  onClose,
  onSave,
  initialDraft,
}: DepartmentModalProps) {
  const [form, setForm] = useState<DepartmentDraft>(initialDraft);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setForm(initialDraft);
    setErrorMsg(null);
  }, [initialDraft, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (form.name.trim().length < 2) {
      setErrorMsg('يرجى إدخال اسم القسم أو الشعبة (حرفين على الأقل).');
      return;
    }
    if (form.code.trim().length < 2) {
      setErrorMsg('يرجى إدخال الرمز التعريفي للقسم (مثال: DEP-15).');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim().slice(0, BLUEPRINT_LIMITS.DEPARTMENT_MAX),
        code: form.code.trim().slice(0, BLUEPRINT_LIMITS.ROOM_CODE_MAX),
        headName: form.headName.trim().slice(0, BLUEPRINT_LIMITS.HEAD_NAME_MAX),
        sector:
          form.sector.trim().slice(0, BLUEPRINT_LIMITS.SECTOR_MAX) ||
          'العتبة الحسينية المقدسة',
        notes: form.notes.trim().slice(0, BLUEPRINT_LIMITS.NOTES_MAX),
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر حفظ بيانات القسم.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="department-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div>
            <h2
              id="department-modal-title"
              className="font-display text-lg font-bold text-slate-900"
            >
              {form.id ? 'تعديل بيانات القسم' : 'إضافة قسم جديد'}
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              إدارة أقسام وشعب العتبة الحسينية المقدسة المخولة بطلب حجز القاعات
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

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                اسم القسم أو الشعبة
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.DEPARTMENT_MAX}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: قسم الشؤون الفكرية والثقافية"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                رمز القسم
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.ROOM_CODE_MAX}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="DEP-15"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                الحالة
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as DepartmentStatus })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
              >
                <option value="active">مفعل (متاح للحجز)</option>
                <option value="inactive">موقوف مؤقتاً</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                مسؤول التنسيق / رئيس القسم (اختياري)
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.HEAD_NAME_MAX}
                value={form.headName}
                onChange={(e) => setForm({ ...form, headName: e.target.value })}
                placeholder="الاسم الكامل للمخول بالتنسيق"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                المرجعية الإدارية
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.SECTOR_MAX}
                value={form.sector}
                onChange={(e) => setForm({ ...form, sector: e.target.value })}
                placeholder="العتبة الحسينية المقدسة"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                ملاحظات (اختياري)
              </label>
              <textarea
                rows={2}
                maxLength={BLUEPRINT_LIMITS.NOTES_MAX}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="تفاصيل إضافية حول صلاحيات أو طبيعة دورات القسم..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-700 resize-none"
              />
            </div>
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
              {saving ? 'جاري الحفظ...' : form.id ? 'حفظ التعديلات' : 'إضافة القسم'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
