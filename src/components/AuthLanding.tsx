import { useState } from 'react';
import { CalendarDays, CheckCircle2, LogIn, ShieldCheck } from 'lucide-react';
import { INITIAL_CLASSROOMS } from '../data/seedData';
import { ClassroomImage } from './ClassroomImage';

interface AuthLandingProps {
  onSignIn: () => Promise<void>;
  authError: string | null;
}

export function AuthLanding({ onSignIn, authError }: AuthLandingProps) {
  const [signingIn, setSigningIn] = useState(false);

  const handleLogin = async () => {
    setSigningIn(true);
    try {
      await onSignIn();
    } finally {
      setSigningIn(false);
    }
  };

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
            onClick={handleLogin}
            disabled={signingIn}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-medium hover:bg-teal-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <LogIn className="w-4 h-4" />
            <span>{signingIn ? 'جاري تسجيل الدخول...' : 'دخول المنظومة'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-6 lg:px-10 py-12 lg:py-16 space-y-16">
        {/* Hero Split */}
        <section id="overview" className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
          <div className="lg:col-span-6 flex flex-col justify-center space-y-6">
            <div className="text-xs font-medium text-teal-800 flex items-center gap-2">
              <span>قسم مجمع سيد الشهداء (ع) الخدمي</span>
              <span aria-hidden="true">·</span>
              <span>العتبة الحسينية المقدسة</span>
            </div>

            <h1 className="font-display text-3xl lg:text-5xl font-bold text-slate-900 leading-tight text-balance">
              تنسيق حجوزات القاعات الدراسية المجهزة بدقة وانسيابية
            </h1>

            <p className="text-base text-slate-600 leading-relaxed max-w-xl">
              منصة موحدة لحجوزات أقسام العتبة الحسينية المقدسة وإدارة الجدول الدراسي اليومي والأسبوعي، مع نظام مراجعة وموافقة إدارية ومنع تعارض المواعيد لضمان بيئة تعليمية متطورة.
            </p>

            {authError && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
                {authError}
              </div>
            )}

            <div className="flex flex-wrap items-center gap-4 pt-2">
              <button
                type="button"
                onClick={handleLogin}
                disabled={signingIn}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-lg bg-teal-700 text-white text-sm font-semibold hover:bg-teal-800 disabled:opacity-60 transition-colors cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>{signingIn ? 'جاري التحقق من الحساب...' : 'تسجيل الدخول بحساب Google'}</span>
              </button>
              <a
                href="#halls"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-white border border-slate-200 text-slate-700 text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <CalendarDays className="w-4 h-4 text-teal-700" />
                <span>استعراض القاعات المتاحة</span>
              </a>
            </div>

            <div className="pt-4 border-t border-slate-200 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-teal-700" />
                كشف تلقائي لتعارض الأوقات
              </span>
              <span className="inline-flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-teal-700" />
                حفظ فوري وآمن للسجلات
              </span>
            </div>
          </div>

          <div className="lg:col-span-6 flex">
            <div className="w-full rounded-xl overflow-hidden border border-slate-200 bg-white">
              <ClassroomImage
                src={INITIAL_CLASSROOMS[0].imageUrl}
                alt="قاعة الشهيد الصدر (ع) الكبرى في مجمع سيد الشهداء (ع) الخدمي"
                className="w-full h-72 lg:h-full min-h-[340px]"
              />
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
