import React, { useEffect, useState } from 'react';
import { AlertCircle, Eye, EyeOff, RefreshCw, X } from 'lucide-react';
import {
  AccountAuthType,
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
  formatAccountLoginIdentifier,
  generateReadablePassword,
  isValidUsername,
  normalizeUsername,
  usernameToAuthEmail,
} from '../utils/permissions';

export interface AccountDraft {
  id?: string;
  email: string;
  username: string;
  authType: AccountAuthType;
  authUid?: string;
  password?: string;
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
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setForm(initialDraft);
    setShowPassword(!initialDraft.id);
    setErrorMsg(null);
  }, [initialDraft, isOpen]);

  if (!isOpen) return null;

  const isEditing = Boolean(form.id);

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

    let normalizedEmail = form.email.trim().toLowerCase();
    let normalizedUsername = normalizeUsername(form.username || '');

    if (!isEditing) {
      if (form.authType === 'credentials') {
        if (!normalizedUsername) {
          setErrorMsg('يرجى إدخال اسم المستخدم (اليوزر).');
          return;
        }
        if (normalizedUsername.includes('@')) {
          if (normalizedUsername.length < 5) {
            setErrorMsg('يرجى إدخال بريد إلكتروني صالح للدخول.');
            return;
          }
          normalizedEmail = normalizedUsername;
        } else {
          if (!isValidUsername(normalizedUsername)) {
            setErrorMsg(
              'اسم المستخدم يجب أن يتكون من 3 إلى 40 حرفاً إنجليزياً أو أرقام أو الرموز (. _ -) فقط.'
            );
            return;
          }
          normalizedEmail = usernameToAuthEmail(normalizedUsername);
        }

        const pwd = form.password || '';
        if (pwd.length < 6) {
          setErrorMsg('كلمة المرور يجب أن لا تقل عن 6 أحرف.');
          return;
        }
      } else {
        if (!normalizedEmail.includes('@') || normalizedEmail.length < 5) {
          setErrorMsg('يرجى إدخال بريد إلكتروني (Google) صالح.');
          return;
        }
        normalizedUsername = '';
      }
    }

    if (form.displayName.trim().length < 2) {
      setErrorMsg('يرجى إدخال اسم المنتسب أو مسؤول الشعبة (حرفين على الأقل).');
      return;
    }
    if (form.branchName.trim().length < 2) {
      setErrorMsg('يرجى تحديد اسم الشعبة أو القسم (حرفين على الأقل).');
      return;
    }

    setSaving(true);
    try {
      await onSave({
        ...form,
        email: normalizedEmail.slice(0, BLUEPRINT_LIMITS.EMAIL_MAX),
        username: normalizedUsername.slice(0, BLUEPRINT_LIMITS.USERNAME_MAX),
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
      className="fixed inset-0 z-50 bg-[#1F1F1F]/45 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="account-modal-title"
    >
      <div className="bg-white border border-[#DADCE0] rounded-2xl g-elevation-modal max-w-2xl w-full max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 bg-[#F8FAFD] border-b border-[#E8EAED]">
          <div>
            <h2
              id="account-modal-title"
              className="font-display text-lg font-bold text-[#1F1F1F]"
            >
              {isEditing ? 'تعديل صلاحيات الحساب' : 'إضافة حساب شعبة أو منتسب جديد'}
            </h2>
            <p className="text-xs text-[#747775] mt-0.5">
              تخصيص حساب دخول عادي (يوزر وكلمة مرور) أو ربط بريد Google مع تحديد الصلاحيات
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-[#444746] hover:bg-[#E8EAED]/60 hover:text-[#1F1F1F] transition-colors cursor-pointer"
            aria-label="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="bg-[#FCE8E6] border border-[#F6AEA9] rounded-xl px-4 py-3 text-sm text-[#C5221F] flex items-center gap-2" role="alert">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {!isEditing ? (
            <div className="flex flex-wrap items-center justify-between gap-2 bg-[#F8FAFD] border border-[#E8EAED] rounded-xl px-4 py-2.5">
              <span className="text-xs font-semibold text-[#1F1F1F]">
                {form.authType === 'credentials'
                  ? 'حساب دخول مباشر (يوزر + كلمة مرور)'
                  : 'حساب مرتبط ببريد Google'}
              </span>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({
                    ...prev,
                    authType: prev.authType === 'credentials' ? 'google' : 'credentials',
                  }))
                }
                className="text-[11px] font-semibold text-[#0B57D0] hover:text-[#0842A0] cursor-pointer"
              >
                {form.authType === 'credentials'
                  ? 'أو ربط بريد Google بدلاً من اليوزر'
                  : 'العودة إلى يوزر وكلمة مرور'}
              </button>
            </div>
          ) : (
            <div className="bg-[#F8FAFD] border border-[#E8EAED] rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="text-[#747775]">معرّف الدخول: </span>
                <span className="font-mono-num font-semibold text-[#1F1F1F]" dir="ltr">
                  {formatAccountLoginIdentifier(form)}
                </span>
              </div>
              <span className="text-[#444746] font-medium">
                {form.authType === 'credentials' ? 'دخول عادي (يوزر وكلمة مرور)' : 'حساب Google'}
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {!isEditing && form.authType === 'credentials' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-[#444746] mb-1.5">
                    اسم المستخدم (اليوزر)
                  </label>
                  <input
                    type="text"
                    dir="ltr"
                    maxLength={BLUEPRINT_LIMITS.USERNAME_MAX}
                    value={form.username}
                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                    placeholder="branch_media"
                    className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm font-mono-num text-[#1F1F1F] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15 text-left"
                    required
                  />
                  <p className="text-[11px] text-[#747775] mt-1">
                    أحرف إنجليزية وأرقام أو (. _ -) فقط
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-medium text-[#444746]">
                      كلمة المرور المعطاة
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({
                          ...prev,
                          password: generateReadablePassword(10),
                        }));
                        setShowPassword(true);
                      }}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-[#0B57D0] hover:text-[#0842A0] cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>توليد كلمة مرور</span>
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      minLength={6}
                      value={form.password || ''}
                      onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="6 أحرف على الأقل"
                      className="w-full rounded-xl border border-[#DADCE0] bg-white pr-3 pl-9 py-2.5 text-sm font-mono-num text-[#1F1F1F] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15 text-left"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'إخفاء' : 'إظهار'}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-[#747775] hover:text-[#1F1F1F] cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}

            {!isEditing && form.authType === 'google' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-[#444746] mb-1.5">
                  البريد الإلكتروني المعتمد (Google Email)
                </label>
                <input
                  type="email"
                  dir="ltr"
                  maxLength={BLUEPRINT_LIMITS.EMAIL_MAX}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="name@gmail.com"
                  className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm font-mono-num text-[#1F1F1F] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15 text-left"
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-[#444746] mb-1.5">
                اسم المسؤول أو المنتسب
              </label>
              <input
                type="text"
                maxLength={BLUEPRINT_LIMITS.DISPLAY_NAME_MAX}
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                placeholder="الاسم الكامل أو اللقب الإداري"
                className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm text-[#1F1F1F] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#444746] mb-1.5">
                الشعبة / القسم التابع له
              </label>
              <input
                type="text"
                list="branch-suggestions"
                maxLength={BLUEPRINT_LIMITS.BRANCH_NAME_MAX}
                value={form.branchName}
                onChange={(e) => setForm({ ...form, branchName: e.target.value })}
                placeholder="اختر أو اكتب اسم الشعبة"
                className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm text-[#1F1F1F] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
                required
              />
              <datalist id="branch-suggestions">
                {branchOptions.map((opt) => (
                  <option key={opt} value={opt} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#444746] mb-1.5">
                نوع الحساب (الدور)
              </label>
              <select
                value={form.role}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
                className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
              >
                {(Object.keys(ROLE_LABEL_AR) as UserRole[]).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABEL_AR[r]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#444746] mb-1.5">
                حالة الحساب
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  setForm({ ...form, status: e.target.value as AccountStatus })
                }
                className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2.5 text-sm text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
              >
                <option value="active">نشط (مصرح بالدخول)</option>
                <option value="suspended">معلق (إيقاف الصلاحية مؤقتاً)</option>
              </select>
            </div>
          </div>

          {/* Granular Permissions per Branch */}
          <div className="space-y-3 pt-2 border-t border-[#E8EAED]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1F1F1F]">
                الصلاحيات التفصيلية للشعبة / الحساب
              </span>
              <span className="text-[11px] text-[#747775]">
                {form.role === 'admin'
                  ? 'يمتلك مدير النظام جميع الصلاحيات تلقائياً'
                  : form.role === 'viewer'
                    ? 'حساب اطلاع فقط: يعرض صفحة الجدول الدراسي فقط بدون حجز أو تعديل'
                    : form.role === 'coordinator'
                      ? 'منسق حجز قسم: يحجز القاعات لقسمه فقط مع كشف التعارضات'
                      : 'حدد المهام المخولة لهذه الشعبة'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PERMISSION_ITEMS.map((item) => {
                const disabled =
                  form.role === 'admin' ||
                  form.role === 'viewer' ||
                  form.role === 'coordinator';
                const checked = form.permissions[item.key];
                return (
                  <label
                    key={item.key}
                    className={`flex items-start gap-2.5 p-3 rounded-xl border transition-colors ${
                      checked
                        ? 'border-[#AECBFA] bg-[#E8F0FE]/70'
                        : 'border-[#DADCE0] bg-white'
                    } ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:border-[#0B57D0]/50'}`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled}
                      onChange={() => togglePermission(item.key)}
                      className="mt-0.5 rounded border-[#DADCE0] text-[#0B57D0] focus:ring-[#0B57D0]"
                    />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold text-[#1F1F1F]">
                        {item.label}
                      </div>
                      <div className="text-[11px] text-[#747775] mt-0.5 leading-snug">
                        {item.description}
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#444746] mb-1.5">
              ملاحظات إدارية (اختياري)
            </label>
            <textarea
              rows={2}
              maxLength={BLUEPRINT_LIMITS.NOTES_MAX}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="ملاحظات حول نطاق مسؤولية الشعبة أو مدة التخويل..."
              className="w-full rounded-xl border border-[#DADCE0] bg-white px-3 py-2 text-sm text-[#1F1F1F] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15 resize-none"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 bg-[#F8FAFD] -mx-6 -mb-6 px-6 py-4 border-t border-[#E8EAED] rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#DADCE0] bg-white text-sm font-medium text-[#1F1F1F] hover:bg-[#F0F4F9] transition-colors cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-[#0B57D0] text-white text-sm font-semibold hover:bg-[#0842A0] g-elevation-1 disabled:opacity-50 transition-colors cursor-pointer"
            >
              {saving ? 'جاري الحفظ...' : form.id ? 'حفظ الصلاحيات' : 'إضافة الحساب'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
