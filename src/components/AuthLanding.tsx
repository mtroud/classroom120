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
import { GoogleGLogo, WorkspaceEmblem } from './GoogleBrandMark';

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
    <div className="min-h-screen bg-[#F8FAFD] text-[#1F1F1F] flex flex-col" dir="rtl" id="top">
      {/* Signature Google 4-color top spectral bar */}
      <div className="h-[3px] w-full google-spectral-bar shrink-0" />

      {/* Top Bar Contract: 3 zones */}
      <header className="bg-white/95 backdrop-blur-sm border-b border-[#DADCE0] px-6 lg:px-10 py-3.5 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-8">
          <a
            href="#top"
            className="inline-flex items-center gap-3 whitespace-nowrap shrink-0 group"
          >
            <WorkspaceEmblem className="w-7 h-7 shrink-0 transition-transform duration-200 group-hover:scale-105" />
            <span className="font-display text-lg font-bold tracking-tight text-[#1F1F1F]">
              قاعات مجمع سيد الشهداء (ع)
            </span>
          </a>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#444746]">
            <a href="#overview" className="hover:text-[#0B57D0] transition-colors whitespace-nowrap shrink-0">
              المنظومة
            </a>
            <a href="#halls" className="hover:text-[#0B57D0] transition-colors whitespace-nowrap shrink-0">
              القاعات المجهزة
            </a>
            <a href="#features" className="hover:text-[#0B57D0] transition-colors whitespace-nowrap shrink-0">
              إدارة الجدول
            </a>
          </nav>

          <button
            type="button"
            onClick={focusLoginForm}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B57D0] text-white text-sm font-semibold hover:bg-[#0842A0] transition-colors whitespace-nowrap shrink-0 cursor-pointer g-elevation-1"
          >
            <LogIn className="w-4 h-4" />
            <span>دخول المنظومة</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-10 py-10 lg:py-14 space-y-14">
        {/* Hero Split with Google Workspace Sign-In Card */}
        <section id="overview" className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
          <div className="lg:col-span-7 flex flex-col justify-between space-y-7">
            <div className="space-y-5">
              <div className="text-xs font-semibold text-[#0B57D0] flex items-center gap-2">
                <span>قسم مجمع سيد الشهداء (ع) الخدمي</span>
                <span aria-hidden="true" className="text-[#DADCE0]">·</span>
                <span className="text-[#444746]">العتبة الحسينية المقدسة</span>
              </div>

              <h1 className="font-display text-3xl lg:text-4xl font-bold text-[#1F1F1F] leading-tight text-balance">
                تنسيق حجوزات القاعات الدراسية المجهزة بدقة وانسيابية
              </h1>

              <p className="text-sm sm:text-base text-[#444746] leading-relaxed max-w-xl">
                منصة موحدة لحجوزات أقسام العتبة الحسينية المقدسة وإدارة الجدول الدراسي اليومي والأسبوعي والشهري، مع نظام مراجعة وموافقة إدارية ومنع تعارض المواعيد.
              </p>

              <div className="flex flex-wrap items-center gap-4 pt-1">
                <a
                  href="#halls"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-[#DADCE0] text-[#1F1F1F] text-xs font-semibold hover:bg-[#F0F4F9] hover:border-[#AECBFA] transition-colors whitespace-nowrap shrink-0"
                >
                  <CalendarDays className="w-4 h-4 text-[#0B57D0]" />
                  <span>استعراض القاعات المتاحة</span>
                </a>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#444746]">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-[#137333]" />
                    كشف تلقائي لتعارض الأوقات
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#0B57D0]" />
                    صلاحيات مخصصة لكل شعبة
                  </span>
                </div>
              </div>
            </div>

            <div className="w-full rounded-2xl overflow-hidden border border-[#DADCE0] bg-white g-elevation-1">
              <ClassroomImage
                src={INITIAL_CLASSROOMS[0].imageUrl}
                alt="قاعة الشهيد الصدر (ع) الكبرى في مجمع سيد الشهداء (ع) الخدمي"
                className="w-full h-56 sm:h-64"
              />
            </div>
          </div>

          <div className="lg:col-span-5 flex" id="login-card">
            <div className="w-full bg-white border border-[#DADCE0] rounded-2xl overflow-hidden g-elevation-2 flex flex-col justify-between">
              <div className="h-[3px] w-full google-spectral-bar shrink-0" />

              <div className="p-6 sm:p-8 flex-1 flex flex-col justify-between space-y-6">
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-[#0B57D0]">
                    بوابة الدخول الموحدة
                  </div>
                  <h2 className="font-display text-xl font-bold text-[#1F1F1F]">
                    تسجيل الدخول إلى المنظومة
                  </h2>
                  <p className="text-xs text-[#444746] leading-relaxed">
                    أدخل اسم المستخدم (اليوزر) وكلمة المرور المخصصة لشعبتك أو للاطلاع على الجدول.
                  </p>
                </div>

                {visibleError && (
                  <div
                    role="alert"
                    className="bg-[#FCE8E6] border border-[#F6AEA9] rounded-xl px-3.5 py-2.5 text-xs text-[#A50E0E] flex items-start gap-2 leading-relaxed"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-[#C5221F]" />
                    <span>{visibleError}</span>
                  </div>
                )}

                <form onSubmit={handleCredentialsSubmit} className="space-y-4">
                  <div>
                    <label
                      htmlFor="login-username"
                      className="block text-xs font-medium text-[#1F1F1F] mb-1.5"
                    >
                      اسم المستخدم (اليوزر)
                    </label>
                    <div className="relative">
                      <UserCheck className="w-4 h-4 text-[#747775] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        ref={usernameInputRef}
                        id="login-username"
                        type="text"
                        dir="ltr"
                        autoComplete="username"
                        value={identifier}
                        onChange={(e) => setIdentifier(e.target.value)}
                        placeholder="courses أو branch1"
                        disabled={isBusy}
                        className="w-full rounded-xl border border-[#DADCE0] bg-white pr-10 pl-3.5 py-2.5 text-sm font-mono-num text-[#1F1F1F] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15 text-left disabled:bg-[#F0F4F9] transition-colors"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="login-password"
                      className="block text-xs font-medium text-[#1F1F1F] mb-1.5"
                    >
                      كلمة المرور
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-[#747775] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input
                        id="login-password"
                        type={showPassword ? 'text' : 'password'}
                        dir="ltr"
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        disabled={isBusy}
                        className="w-full rounded-xl border border-[#DADCE0] bg-white pr-10 pl-10 py-2.5 text-sm font-mono-num text-[#1F1F1F] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15 text-left disabled:bg-[#F0F4F9] transition-colors"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                        className="absolute left-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg text-[#747775] hover:text-[#1F1F1F] hover:bg-[#F0F4F9] cursor-pointer transition-colors"
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
                    className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[#0B57D0] text-white text-sm font-semibold hover:bg-[#0842A0] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer g-elevation-1"
                  >
                    <LogIn className="w-4 h-4" />
                    <span>{signingInCreds ? 'جاري تسجيل الدخول...' : 'دخول'}</span>
                  </button>
                </form>

                <div className="space-y-3">
                  <div className="relative flex items-center justify-center">
                    <div className="border-t border-[#E8EAED] w-full" />
                    <span className="bg-white px-3 text-[11px] font-medium text-[#747775] whitespace-nowrap">
                      دخول مدير المنظومة
                    </span>
                    <div className="border-t border-[#E8EAED] w-full" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    disabled={isBusy}
                    className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-2.5 rounded-xl border border-[#DADCE0] bg-white text-[#1F1F1F] text-sm font-medium hover:bg-[#F8FAFD] hover:border-[#AECBFA] disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <GoogleGLogo className="w-4 h-4 shrink-0" />
                    <span>
                      {signingInGoogle ? 'جاري الدخول عبر Google...' : 'دخول الإدارة بحساب Google'}
                    </span>
                  </button>
                </div>

                <div className="pt-3 border-t border-[#E8EAED] text-[11px] text-[#444746] leading-relaxed">
                  للحصول على يوزر وكلمة مرور للشعبة أو للاطلاع على جدول الدورات، يرجى مراجعة إدارة القاعات في المجمع.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 4-column Institutional Capabilities Strip (Google 4-Color Spectral Anchors) */}
        <section id="features" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <div className="bg-white border border-[#DADCE0] rounded-2xl p-5 hover:border-[#AECBFA] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="font-mono-num text-2xl font-semibold text-[#1F1F1F]">04</div>
              <span className="w-2.5 h-2.5 rounded-sm bg-[#4285F4]" aria-hidden="true" />
            </div>
            <div className="text-sm font-semibold text-[#1F1F1F] mb-1">قاعات ذكية مجهزة</div>
            <p className="text-xs text-[#444746] leading-relaxed">
              سبورات تفاعلية وأنظمة صوتية وعرض عالي الدقة مع متابعة حالة الصيانة.
            </p>
          </div>

          <div className="bg-white border border-[#DADCE0] rounded-2xl p-5 hover:border-[#CEEAD6] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="font-mono-num text-2xl font-semibold text-[#1F1F1F]">165</div>
              <span className="w-2.5 h-2.5 rounded-sm bg-[#34A853]" aria-hidden="true" />
            </div>
            <div className="text-sm font-semibold text-[#1F1F1F] mb-1">مقعداً دراسياً</div>
            <p className="text-xs text-[#444746] leading-relaxed">
              توزيع مرن بين المحاضرات المركزية والمختبرات التقنية والندوات.
            </p>
          </div>

          <div className="bg-white border border-[#DADCE0] rounded-2xl p-5 hover:border-[#FDE293] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="font-mono-num text-2xl font-semibold text-[#1F1F1F]">08:00 – 21:00</div>
              <span className="w-2.5 h-2.5 rounded-sm bg-[#FBBC04]" aria-hidden="true" />
            </div>
            <div className="text-sm font-semibold text-[#1F1F1F] mb-1">جدولة يومية وأسبوعية</div>
            <p className="text-xs text-[#444746] leading-relaxed">
              عرض زمني واضح لفترات الحجز الفارغة والمشغولة مع منع التداخل.
            </p>
          </div>

          <div className="bg-white border border-[#DADCE0] rounded-2xl p-5 hover:border-[#F6AEA9] transition-colors">
            <div className="flex items-center justify-between mb-2">
              <div className="font-mono-num text-2xl font-semibold text-[#1F1F1F]">CSV · PDF</div>
              <span className="w-2.5 h-2.5 rounded-sm bg-[#EA4335]" aria-hidden="true" />
            </div>
            <div className="text-sm font-semibold text-[#1F1F1F] mb-1">تصدير وطباعة الجدول</div>
            <p className="text-xs text-[#444746] leading-relaxed">
              إخراج الجداول الدراسية اليومية والأسبوعية للطباعة أو الأرشفة الفورية.
            </p>
          </div>
        </section>

        {/* Equipped Classrooms Showcase */}
        <section id="halls" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#DADCE0] pb-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-[#1F1F1F]">
                القاعات الدراسية المجهزة
              </h2>
              <p className="text-sm text-[#444746] mt-1">
                بيئة تعليمية متكاملة مصممة لخدمة الطلبة والدورات التطويرية في القسم
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {INITIAL_CLASSROOMS.map((room) => (
              <article
                key={room.id}
                className="bg-white border border-[#DADCE0] rounded-2xl overflow-hidden flex flex-col hover:border-[#AECBFA] transition-colors"
              >
                <div className="aspect-[4/3] w-full overflow-hidden border-b border-[#E8EAED]">
                  <ClassroomImage
                    src={room.imageUrl}
                    alt={room.name}
                    className="w-full h-full"
                  />
                </div>
                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-xs text-[#444746] flex items-center gap-1.5 mb-1.5">
                      <span className="font-mono-num font-semibold text-[#0B57D0]">{room.code}</span>
                      <span aria-hidden="true">·</span>
                      <span>{room.floor}</span>
                      <span aria-hidden="true">·</span>
                      <span className="tabular-nums">{room.capacity} مقعد</span>
                    </div>
                    <h3 className="font-display text-base font-bold text-[#1F1F1F]">
                      {room.name}
                    </h3>
                  </div>
                  <p className="text-xs text-[#444746] leading-relaxed">
                    {room.equipment.slice(0, 3).join(' · ')}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-[#DADCE0] px-6 lg:px-10 py-5">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-[#444746]">
          <span>قسم مجمع سيد الشهداء (ع) الخدمي — منظومة إدارة القاعات الدراسية</span>
          <span>يرجى تسجيل الدخول لإدارة الحجوزات وتحديث الجدول</span>
        </div>
      </footer>
    </div>
  );
}
