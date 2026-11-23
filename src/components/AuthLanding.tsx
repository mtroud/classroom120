import React, { useRef, useState } from 'react';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LogIn,
  ShieldCheck,
  UserCheck,
} from 'lucide-react';
import { INITIAL_CLASSROOMS } from '../data/seedData';
import { ClassroomImage } from './ClassroomImage';

interface AuthLandingProps {
  onSignIn: () => Promise<void>;
  onCredentialsSignIn: (identifier: string, password: string) => Promise<void>;
  authError: string | null;
}

export function AuthLanding({
  onSignIn,
  onCredentialsSignIn,
  authError,
}: AuthLandingProps) {
  const [signingInGoogle, setSigningInGoogle] = useState(false);
  const [signingInCreds, setSigningInCreds] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const usernameInputRef = useRef<HTMLInputElement | null>(null);

  const focusLoginForm = () => {
    usernameInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => usernameInputRef.current?.focus(), 200);
  };

  const handleGoogleLogin = async () => {
    setLocalError(null);
    setSigningInGoogle(true);
    try {
      await onSignIn();
    } finally {
      setSigningInGoogle(false);
    }
  };

  const handleCredentialsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmedId = identifier.trim();
    if (trimmedId.length < 3) {
      setLocalError('يرجى إدخال اسم المستخدم (اليوزر) أو البريد الإلكتروني.');
      return;
    }
    if (!trimmedId.includes('@') && !/^[a-zA-Z0-9._-]+$/.test(trimmedId)) {
      setLocalError('اسم المستخدم يجب أن يتكون من أحرف إنجليزية وأرقام أو الرموز (. _ -) فقط.');
      return;
    }
    if (password.length < 6) {
      setLocalError('يرجى إدخال كلمة المرور (6 أحرف على الأقل).');
      return;
    }

    setSigningInCreds(true);
    try {
      await onCredentialsSignIn(trimmedId, password);
    } finally {
      setSigningInCreds(false);
    }
  };

  const isBusy = signingInGoogle || signingInCreds;
  const visibleError = localError || authError;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col" dir="rtl">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="bg-white border-b border-slate-200 px-6 lg:px-10 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          <a
            href="#top"
            className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            قاعات مجمع سيد الشهداء (ع)
          </a>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <a href="#overview" className="hover:text-teal-800 transition-colors whitespace-nowrap shrink-0">
              المنظومة
            </a>
            <a href="#halls" className="hover:text-teal-800 transition-colors whitespace-nowrap shrink-0">
              القاعات المجهزة
            </a>
            <a href="#features" className="hover:text-teal-800 transition-colors whitespace-nowrap shrink-0">
              إدارة الجدول
            </a>
          </nav>

          <button
            type="button"
            onClick={focusLoginForm}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-medium hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>دخول المنظومة</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-10 py-10 lg:py-14 space-y-14">
        {/* Hero Split with Standard Login & Google Sign-In */}
        <section id="overview" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
            <div className="space-y-5">
              <div className="text-xs font-medium text-teal-800 flex items-center gap-2">
                <span>قسم مجمع سيد الشهداء (ع) الخدمي</span>
                <span aria-hidden="true">·</span>
                <span>العتبة الحسينية المقدسة</span>
              </div>

              <h1 className="font-display text-3xl lg:text-4xl font-bold text-slate-900 leading-tight text-balance">
                تنسيق حجوزات القاعات الدراسية المجهزة بدقة وانسيابية
              </h1>

              <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-xl">
                منصة موحدة لحجوزات أقسام العتبة الحسينية المقدسة وإدارة الجدول الدراسي اليومي والأسبوعي والشهري، مع نظام مراجعة وموافقة إدارية ومنع تعارض المواعيد.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <a
                  href="#halls"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0"
                >
                  <CalendarDays className="w-4 h-4 text-teal-700" />
                  <span>استعراض القاعات المتاحة</span>
                </a>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-teal-700" />
                    كشف تلقائي لتعارض الأوقات
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-teal-700" />
                    صلاحيات مخصصة لكل شعبة
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-white">
              <ClassroomImage
                src={INITIAL_CLASSROOMS[0].imageUrl}
                alt="قاعة الشهيد الصدر (ع) الكبرى في مجمع سيد الشهداء (ع) الخدمي"
                className="w-full h-56 sm:h-64"
              />
            </div>
          </div>

          <div className="lg:col-span-5 flex" id="login-card">
            <div className="w-full bg-white border border-slate-200 rounded-xl p-6 sm:p-8 flex flex-col justify-between space-y-6">
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-teal-800">
                  بوابة الدخول الموحدة
                </div>
                <h2 className="font-display text-xl font-bold text-slate-900">
                  تسجيل الدخول إلى المنظومة
                </h2>
                <p className="text-xs text-slate-500 leading-relaxed">
                  أدخل اسم المستخدم (اليوزر) وكلمة المرور المعطاة من الإدارة، أو سجّل الدخول عبر حساب Google المعتمد.
                </p>
              </div>

              {visibleError && (
                <div
                  role="alert"
                  className="bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5 text-xs text-red-800 flex items-start gap-2 leading-relaxed"
                >
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{visibleError}</span>
                </div>
              )}

              <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                <div>
                  <label
                    htmlFor="login-username"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    اسم المستخدم (اليوزر) أو البريد الإلكتروني
                  </label>
                  <div className="relative">
                    <UserCheck className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      ref={usernameInputRef}
                      id="login-username"
                      type="text"
                      dir="ltr"
                      autoComplete="username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      placeholder="username أو name@gmail.com"
                      disabled={isBusy}
                      className="w-full rounded-lg border border-slate-200 bg-white pr-9 pl-3 py-2.5 text-sm font-mono-num text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 text-left disabled:bg-slate-50"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="login-password"
                    className="block text-xs font-medium text-slate-700 mb-1.5"
                  >
                    كلمة المرور
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      dir="ltr"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      disabled={isBusy}
                      className="w-full rounded-lg border border-slate-200 bg-white pr-9 pl-9 py-2.5 text-sm font-mono-num text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-teal-700 focus:ring-1 focus:ring-teal-700 text-left disabled:bg-slate-50"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((prev) => !prev)}
                      aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isBusy}
                  className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{signingInCreds ? 'جاري التحقق من اليوزر...' : 'تسجيل الدخول'}</span>
                </button>
              </form>

              <div className="space-y-4">
                <div className="relative flex items-center justify-center">
                  <div className="border-t border-slate-200 w-full" />
                  <span className="bg-white px-3 text-[11px] font-medium text-slate-400 whitespace-nowrap">
                    أو عبر حساب Google
                  </span>
                  <div className="border-t border-slate-200 w-full" />
                </div>

                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={isBusy}
                  className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-800 text-sm font-medium hover:bg-slate-50 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-teal-700" />
                  <span>
                    {signingInGoogle ? 'جاري التحقق من Google...' : 'تسجيل الدخول بحساب Google'}
                  </span>
                </button>
              </div>

              <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 leading-relaxed">
                للحصول على يوزر وكلمة مرور مخصصة لشعبتك أو للاطلاع على جدول الدورات، يرجى مراجعة مسؤول إدارة القاعات في المجمع.
              </div>
            </div>
          </div>
        </section>

        {/* 4-column Institutional Capabilities Strip */}
        <section id="features" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="font-mono-num text-2xl font-semibold text-slate-900 mb-1">04</div>
            <div className="text-sm font-semibold text-slate-900 mb-1">قاعات ذكية مجهزة</div>
            <p className="text-xs text-slate-500 leading-relaxed">
              سبورات تفاعلية وأنظمة صوتية وعرض عالي الدقة مع متابعة حالة الصيانة.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="font-mono-num text-2xl font-semibold text-slate-900 mb-1">165</div>
            <div className="text-sm font-semibold text-slate-900 mb-1">مقعداً دراسياً</div>
            <p className="text-xs text-slate-500 leading-relaxed">
              توزيع مرن بين المحاضرات المركزية والمختبرات التقنية والندوات.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="font-mono-num text-2xl font-semibold text-slate-900 mb-1">08:00 – 21:00</div>
            <div className="text-sm font-semibold text-slate-900 mb-1">جدولة يومية وأسبوعية</div>
            <p className="text-xs text-slate-500 leading-relaxed">
              عرض زمني واضح لفترات الحجز الفارغة والمشغولة مع منع التداخل.
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <div className="font-mono-num text-2xl font-semibold text-slate-900 mb-1">CSV · PDF</div>
            <div className="text-sm font-semibold text-slate-900 mb-1">تصدير وطباعة الجدول</div>
            <p className="text-xs text-slate-500 leading-relaxed">
              إخراج الجداول الدراسية اليومية والأسبوعية للطباعة أو الأرشفة الفورية.
            </p>
          </div>
        </section>

        {/* Equipped Classrooms Showcase */}
        <section id="halls" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-slate-200 pb-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-slate-900">
                القاعات الدراسية المجهزة
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                بيئة تعليمية متكاملة مصممة لخدمة الطلبة والدورات التطويرية في القسم
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {INITIAL_CLASSROOMS.map((room) => (
              <article
                key={room.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col"
              >
                <div className="aspect-[4/3] w-full overflow-hidden border-b border-slate-200">
                  <ClassroomImage
                    src={room.imageUrl}
                    alt={room.name}
                    className="w-full h-full"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5 mb-1.5">
                      <span className="font-mono-num font-medium text-teal-800">{room.code}</span>
                      <span aria-hidden="true">·</span>
                      <span>{room.floor}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{room.capacity} مقعد</span>
                    </div>
                    <h3 className="font-display text-base font-bold text-slate-900">
                      {room.name}
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {room.equipment.slice(0, 3).join(' · ')}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-slate-200 px-6 lg:px-10 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
          <span>قسم مجمع سيد الشهداء (ع) الخدمي — منظومة إدارة القاعات الدراسية</span>
          <span>يرجى تسجيل الدخول لإدارة الحجوزات وتحديث الجدول</span>
        </div>
      </footer>
    </div>
  );
}

