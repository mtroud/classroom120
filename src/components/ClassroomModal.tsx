import React, { useEffect, useState } from 'react';
import { AlertCircle, Plus, Trash2, X } from 'lucide-react';
import { CLASSROOM_IMAGE_PRESETS } from '../data/seedData';
import { BLUEPRINT_LIMITS, ClassroomStatus } from '../types';
import { CLASSROOM_STATUS_LABEL } from '../utils/schedule';
import { ClassroomImage } from './ClassroomImage';

export interface ClassroomDraft {
  id?: string;
  name: string;
  code: string;
  floor: string;
  capacity: number;
  equipment: string[];
  status: ClassroomStatus;
  imageUrl: string;
  notes: string;
}

interface ClassroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: ClassroomDraft) => Promise<void>;
  initialDraft: ClassroomDraft;
}

export function ClassroomModal({
  isOpen,
  onClose,
  onSave,
  initialDraft,
}: ClassroomModalProps) {
  const [form, setForm] = useState<ClassroomDraft>(initialDraft);
  const [newEquipment, setNewEquipment] = useState('');
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setForm(initialDraft);
    setNewEquipment('');
    setErrorMsg(null);
  }, [initialDraft, isOpen]);

  if (!isOpen) return null;

  const handleAddEquipment = () => {
    const trimmed = newEquipment.trim().slice(0, BLUEPRINT_LIMITS.EQUIPMENT_ITEM_MAX);
    if (!trimmed) return;
    if (form.equipment.length >= BLUEPRINT_LIMITS.EQUIPMENT_MAX_ITEMS) {
      setErrorMsg('الحد الأقصى للتجهيزات هو 10 عناصر لكل قاعة.');
      return;
    }
    setForm({ ...form, equipment: [...form.equipment, trimmed] });
    setNewEquipment('');
    setErrorMsg(null);
  };

  const handleRemoveEquipment = (index: number) => {
    if (form.equipment.length <= 1) {
      setErrorMsg('يجب أن تحتوي القاعة على تجهيز واحد على الأقل.');
      return;
    }
    setForm({
      ...form,
      equipment: form.equipment.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (form.name.trim().length < 2) {
      setErrorMsg('يرجى إدخال اسم القاعة.');
      return;
    }
    if (form.code.trim().length < 2) {
      setErrorMsg('يرجى إدخال رمز القاعة (مثال: SH-101).');
      return;
    }
    if (form.equipment.length < 1) {
      setErrorMsg('يرجى إضافة وسيلة تعليمية أو تقنية واحدة على الأقل.');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...form,
        name: form.name.trim().slice(0, BLUEPRINT_LIMITS.ROOM_NAME_MAX),
        code: form.code.trim().slice(0, BLUEPRINT_LIMITS.ROOM_CODE_MAX),
        floor: form.floor.trim().slice(0, BLUEPRINT_LIMITS.FLOOR_MAX),
        notes: form.notes.trim().slice(0, BLUEPRINT_LIMITS.NOTES_MAX),
        imageUrl: form.imageUrl.trim().slice(0, BLUEPRINT_LIMITS.IMAGE_URL_MAX),
      });
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'تعذر حفظ بيانات القاعة.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="classroom-modal-title"
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="classroom-modal-title" className="font-display text-lg font-bold text-slate-900">
            {form.id ? 'تعديل بيانات القاعة المجهزة' : 'إضافة قاعة دراسية جديدة'}
          </h2>
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
                اسم القاعة الدراسية
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.ROOM_NAME_MAX}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="مثال: قاعة الشهيد الصدر (ع) الكبرى"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                الرمز التعريفي للقاعة
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.ROOM_CODE_MAX}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="SH-101"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                الطابق / الموقع
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.FLOOR_MAX}
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
                placeholder="الطابق الأول"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                السعة الاستيعابية (عدد الطلاب)
              </label>
              <input
                type="number"
                min={1}
                max={BLUEPRINT_LIMITS.CAPACITY_MAX}
                value={form.capacity}
                onChange={(e) =>
                  setForm({ ...form, capacity: Number(e.target.value) || 1 })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm font-mono-num text-slate-900 focus:outline-none focus:border-teal-700"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                حالة التشغيل
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as ClassroomStatus })
                }
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
              >
                {(Object.keys(CLASSROOM_STATUS_LABEL) as ClassroomStatus[]).map((s) => (
                  <option key={s} value={s}>
                    {CLASSROOM_STATUS_LABEL[s]}
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-2">
                صورة القاعة
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {CLASSROOM_IMAGE_PRESETS.map((preset) => {
                  const selected = form.imageUrl === preset.url;
                  return (
                    <button
                      key={preset.url}
                      type="button"
                      onClick={() => setForm({ ...form, imageUrl: preset.url })}
                      className={`rounded-lg overflow-hidden border text-right transition-colors cursor-pointer ${
                        selected
                          ? 'border-teal-700 ring-2 ring-teal-700/20'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="aspect-[4/3] w-full">
                        <ClassroomImage
                          src={preset.url}
                          alt={preset.label}
                          className="w-full h-full"
                        />
                      </div>
                      <div className="px-2 py-1.5 text-[11px] font-medium text-slate-700 truncate bg-white">
                        {preset.label}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                الوسائل التعليمية والتقنية المتوفرة ({form.equipment.length}/10)
              </label>
              <div className="flex gap-2 mb-2.5">
                <input
                  type="text"
                  maxLength={BLUEPRINT_LIMITS.EQUIPMENT_ITEM_MAX}
                  value={newEquipment}
                  onChange={(e) => setNewEquipment(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddEquipment();
                    }
                  }}
                  placeholder="أضف وسيلة تعليمية (مثال: سبورة ذكية تفاعلية)"
                  className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-teal-700"
                />
                <button
                  type="button"
                  onClick={handleAddEquipment}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>إضافة</span>
                </button>
              </div>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-slate-50/50">
                {form.equipment.map((item, idx) => (
                  <div
                    key={`${item}-${idx}`}
                    className="flex items-center justify-between px-3 py-2 text-sm text-slate-700"
                  >
                    <span>{item}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveEquipment(idx)}
                      className="text-slate-400 hover:text-red-600 transition-colors p-1 cursor-pointer"
                      aria-label={`حذف ${item}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                وصف وملاحظات إضافية
              </label>
              <textarea
                rows={2}
                maxLength={BLUEPRINT_LIMITS.NOTES_MAX}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="تفاصيل إضافية حول استخدام القاعة أو مواصفاتها..."
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
              {saving ? 'جاري الحفظ...' : form.id ? 'تحديث القاعة' : 'إضافة القاعة'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
