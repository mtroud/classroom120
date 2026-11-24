import { useMemo, useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  SlidersHorizontal,
  Trash2,
  Users,
  Wrench,
  X,
} from 'lucide-react';
import { Booking, Classroom, ClassroomStatus } from '../types';
import {
  CLASSROOM_STATUS_LABEL,
  getTodayISO,
  isActiveBooking,
} from '../utils/schedule';
import { ClassroomImage } from './ClassroomImage';
import { ClassroomOccupancyCharts } from './ClassroomOccupancyCharts';

interface ClassroomsViewProps {
  classrooms: Classroom[];
  bookings: Booking[];
  isAdmin: boolean;
  canBook?: boolean;
  isLoading: boolean;
  onAddClassroom: () => void;
  onEditClassroom: (room: Classroom) => void;
  onToggleMaintenance: (room: Classroom) => Promise<void>;
  onDeleteClassroom: (room: Classroom) => Promise<void>;
  onBookRoom: (roomId: string) => void;
  onSeedDefaults: () => Promise<void>;
}

interface EquipmentPreset {
  id: string;
  label: string;
  keywords: string[];
}

const EQUIPMENT_PRESETS: EquipmentPreset[] = [
  { id: 'smart-board', label: 'سبورة ذكية', keywords: ['سبور', 'ذكي'] },
  { id: 'display', label: 'عرض / شاشات', keywords: ['عرض', 'شاش', 'بروجكتر'] },
  { id: 'audio', label: 'نظام صوتي', keywords: ['صوت', 'مايك', 'ميكروفون'] },
  { id: 'computers', label: 'حواسيب', keywords: ['حاسوب', 'حاسب', 'كمبيوتر'] },
  { id: 'conference', label: 'ربط وبث مرئي', keywords: ['مؤتمر', 'مرئ', 'بث', 'تسجيل'] },
];

const CAPACITY_PRESETS = [25, 35, 45, 60] as const;

function normalizeArabicText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\u064B-\u065F\u0670]/g, '');
}

function matchesAllSearchTokens(haystack: string, query: string): boolean {
  const normalizedQuery = normalizeArabicText(query);
  if (!normalizedQuery) return true;
  const normalizedHaystack = normalizeArabicText(haystack);
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  return tokens.every((token) => normalizedHaystack.includes(token));
}

function equipmentMatchesPreset(equipmentText: string, preset: EquipmentPreset): boolean {
  const normalized = normalizeArabicText(equipmentText);
  if (preset.id === 'smart-board') {
    return normalized.includes('سبور') && normalized.includes('ذكي');
  }
  return preset.keywords.some((kw) => normalized.includes(normalizeArabicText(kw)));
}

export function ClassroomsView({
  classrooms,
  bookings,
  isAdmin,
  canBook = true,
  isLoading,
  onAddClassroom,
  onEditClassroom,
  onToggleMaintenance,
  onDeleteClassroom,
  onBookRoom,
  onSeedDefaults,
}: ClassroomsViewProps) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [minCapacityInput, setMinCapacityInput] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ClassroomStatus>('all');
  const [floorFilter, setFloorFilter] = useState<string>('all');
  const [selectedEquipmentExact, setSelectedEquipmentExact] = useState<string>('all');
  const [selectedPresets, setSelectedPresets] = useState<string[]>([]);

  const todayISO = getTodayISO();

  const todayCountForRoom = (roomId: string) =>
    bookings.filter(
      (b) => b.roomId === roomId && b.date === todayISO && isActiveBooking(b)
    ).length;

  const availableFloors = useMemo(() => {
    const unique = new Set<string>();
    classrooms.forEach((room) => {
      const f = room.floor.trim();
      if (f) unique.add(f);
    });
    return Array.from(unique);
  }, [classrooms]);

  const availableEquipmentItems = useMemo(() => {
    const unique = new Set<string>();
    classrooms.forEach((room) => {
      room.equipment.forEach((item) => {
        const clean = item.trim();
        if (clean) unique.add(clean);
      });
    });
    return Array.from(unique).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [classrooms]);

  const minCapacityValue = useMemo(() => {
    const parsed = Number.parseInt(minCapacityInput, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }, [minCapacityInput]);

  const hasActiveFilters =
    searchQuery.trim() !== '' ||
    minCapacityValue > 0 ||
    statusFilter !== 'all' ||
    floorFilter !== 'all' ||
    selectedEquipmentExact !== 'all' ||
    selectedPresets.length > 0;

  const togglePreset = (presetId: string) => {
    setSelectedPresets((prev) =>
      prev.includes(presetId)
        ? prev.filter((id) => id !== presetId)
        : [...prev, presetId]
    );
  };

  const resetFilters = () => {
    setSearchQuery('');
    setMinCapacityInput('');
    setStatusFilter('all');
    setFloorFilter('all');
    setSelectedEquipmentExact('all');
    setSelectedPresets([]);
  };

  const filteredClassrooms = useMemo(() => {
    return classrooms.filter((room) => {
      if (statusFilter !== 'all' && room.status !== statusFilter) {
        return false;
      }

      if (floorFilter !== 'all' && room.floor.trim() !== floorFilter) {
        return false;
      }

      if (minCapacityValue > 0 && room.capacity < minCapacityValue) {
        return false;
      }

      if (
        selectedEquipmentExact !== 'all' &&
        !room.equipment.some((eq) => eq.trim() === selectedEquipmentExact)
      ) {
        return false;
      }

      if (selectedPresets.length > 0) {
        const combinedEquipment = room.equipment.join(' ');
        const matchesAllPresets = selectedPresets.every((presetId) => {
          const preset = EQUIPMENT_PRESETS.find((p) => p.id === presetId);
          return preset ? equipmentMatchesPreset(combinedEquipment, preset) : true;
        });
        if (!matchesAllPresets) return false;
      }

      if (searchQuery.trim() !== '') {
        const searchable = [
          room.name,
          room.code,
          room.floor,
          room.notes || '',
          ...room.equipment,
        ].join(' ');
        if (!matchesAllSearchTokens(searchable, searchQuery)) {
          return false;
        }
      }

      return true;
    });
  }, [
    classrooms,
    statusFilter,
    floorFilter,
    minCapacityValue,
    selectedEquipmentExact,
    selectedPresets,
    searchQuery,
  ]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white border border-[#DADCE0] rounded-2xl h-64"
          />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-[#1F1F1F]">
            القاعات الدراسية المجهزة ({classrooms.length})
          </h2>
          <p className="text-xs text-[#444746] mt-0.5">
            مراقبة الجاهزية التقنية والسعة الاستيعابية والوسائل التعليمية في كل قاعة
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2.5">
            {classrooms.length === 0 && (
              <button
                type="button"
                disabled={seeding}
                onClick={async () => {
                  setSeeding(true);
                  try {
                    await onSeedDefaults();
                  } finally {
                    setSeeding(false);
                  }
                }}
                className="px-4 py-2 rounded-xl border border-[#DADCE0] bg-white text-xs font-medium text-[#1F1F1F] hover:bg-[#F0F4F9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {seeding ? 'جاري التهيئة...' : 'تحميل القاعات الافتراضية'}
              </button>
            )}
            <button
              type="button"
              onClick={onAddClassroom}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-semibold hover:bg-[#0842A0] transition-colors whitespace-nowrap shrink-0 cursor-pointer g-elevation-1"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة قاعة جديدة</span>
            </button>
          </div>
        )}
      </div>

      {classrooms.length === 0 ? (
        <div className="bg-white border border-[#DADCE0] rounded-2xl p-12 text-center space-y-3">
          <p className="text-sm font-medium text-[#1F1F1F]">
            لم يتم تسجيل أي قاعة دراسية بعد
          </p>
          <p className="text-xs text-[#444746]">
            {isAdmin
              ? 'ابدأ بإضافة قاعات مجمع سيد الشهداء (ع) الخدمي أو تحميل القاعات الافتراضية.'
              : 'بانتظار قيام إدارة القسم بإضافة القاعات الدراسية.'}
          </p>
        </div>
      ) : (
        <>
          <ClassroomOccupancyCharts
            classrooms={classrooms}
            bookings={bookings}
          />

          <div
            aria-label="شريط البحث والفلترة المتقدم للقاعات"
            className="bg-white border border-[#DADCE0] rounded-2xl p-4 sm:p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#1F1F1F]">
                <SlidersHorizontal className="w-4 h-4 text-[#0B57D0]" />
                <span>بحث وفلترة القاعات المجهزة</span>
              </div>

              <div className="flex items-center gap-3">
                <span className="text-xs text-[#444746] tabular-nums">
                  عرض{' '}
                  <strong className="font-mono-num text-[#1F1F1F]">
                    {filteredClassrooms.length}
                  </strong>{' '}
                  من أصل{' '}
                  <strong className="font-mono-num text-[#1F1F1F]">
                    {classrooms.length}
                  </strong>{' '}
                  قاعة
                </span>

                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#DADCE0] bg-[#F8FAFD] text-xs font-medium text-[#1F1F1F] hover:bg-[#F0F4F9] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>مسح الفلاتر</span>
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-12 gap-3">
              <div className="xl:col-span-5">
                <label
                  htmlFor="classroom-search-input"
                  className="block text-[11px] font-medium text-[#444746] mb-1"
                >
                  البحث في القاعات والتجهيزات
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-[#747775] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="classroom-search-input"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="مثال: سبورة ذكية، جهاز عرض، SH-101، النور..."
                    className="w-full pr-9 pl-8 py-2 rounded-xl border border-[#DADCE0] bg-white text-xs text-[#1F1F1F] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      aria-label="مسح نص البحث"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#747775] hover:text-[#1F1F1F] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="xl:col-span-3">
                <label
                  htmlFor="classroom-min-capacity-input"
                  className="block text-[11px] font-medium text-[#444746] mb-1"
                >
                  سعة القاعة الأدنى (مقعد)
                </label>
                <div className="relative">
                  <Users className="w-4 h-4 text-[#747775] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="classroom-min-capacity-input"
                    type="number"
                    min={0}
                    max={500}
                    step={5}
                    value={minCapacityInput}
                    onChange={(e) => setMinCapacityInput(e.target.value)}
                    placeholder="أدخل الحد الأدنى للمقاعد..."
                    className="w-full pr-9 pl-8 py-2 rounded-xl border border-[#DADCE0] bg-white text-xs font-mono-num tabular-nums text-[#1F1F1F] placeholder:text-[#747775] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15"
                  />
                  {minCapacityInput && (
                    <button
                      type="button"
                      onClick={() => setMinCapacityInput('')}
                      aria-label="مسح السعة الأدنى"
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#747775] hover:text-[#1F1F1F] cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="xl:col-span-2">
                <label
                  htmlFor="classroom-equipment-select"
                  className="block text-[11px] font-medium text-[#444746] mb-1"
                >
                  تجهيز محدد
                </label>
                <select
                  id="classroom-equipment-select"
                  value={selectedEquipmentExact}
                  onChange={(e) => setSelectedEquipmentExact(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#DADCE0] bg-white text-xs text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15 cursor-pointer"
                >
                  <option value="all">جميع التجهيزات</option>
                  {availableEquipmentItems.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 xl:col-span-2">
                <div>
                  <label
                    htmlFor="classroom-status-select"
                    className="block text-[11px] font-medium text-[#444746] mb-1"
                  >
                    الحالة
                  </label>
                  <select
                    id="classroom-status-select"
                    value={statusFilter}
                    onChange={(e) =>
                      setStatusFilter(e.target.value as 'all' | ClassroomStatus)
                    }
                    className="w-full px-2.5 py-2 rounded-xl border border-[#DADCE0] bg-white text-xs text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15 cursor-pointer"
                  >
                    <option value="all">الكل</option>
                    <option value="available">متاحة للتشغيل</option>
                    <option value="maintenance">قيد الصيانة</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="classroom-floor-select"
                    className="block text-[11px] font-medium text-[#444746] mb-1"
                  >
                    الطابق
                  </label>
                  <select
                    id="classroom-floor-select"
                    value={floorFilter}
                    onChange={(e) => setFloorFilter(e.target.value)}
                    className="w-full px-2.5 py-2 rounded-xl border border-[#DADCE0] bg-white text-xs text-[#1F1F1F] focus:outline-none focus:border-[#0B57D0] focus:ring-2 focus:ring-[#0B57D0]/15 cursor-pointer"
                  >
                    <option value="all">الكل</option>
                    {availableFloors.map((floor) => (
                      <option key={floor} value={floor}>
                        {floor}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-[#E8EAED] flex flex-col lg:flex-row lg:items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-[#747775] ml-1">
                  تجهيزات سريعة:
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedPresets([])}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    selectedPresets.length === 0
                      ? 'bg-[#1F1F1F] text-white'
                      : 'bg-[#F0F4F9] text-[#444746] hover:bg-[#E9EEF6] hover:text-[#1F1F1F]'
                  }`}
                >
                  الكل
                </button>
                {EQUIPMENT_PRESETS.map((preset) => {
                  const active = selectedPresets.includes(preset.id);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => togglePreset(preset.id)}
                      aria-pressed={active}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-[#0B57D0] text-white'
                          : 'bg-[#F0F4F9] text-[#444746] hover:bg-[#E9EEF6] hover:text-[#1F1F1F]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-medium text-[#747775] ml-1">
                  السعة الأدنى:
                </span>
                <button
                  type="button"
                  onClick={() => setMinCapacityInput('')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    minCapacityValue === 0
                      ? 'bg-[#1F1F1F] text-white'
                      : 'bg-[#F0F4F9] text-[#444746] hover:bg-[#E9EEF6] hover:text-[#1F1F1F]'
                  }`}
                >
                  أي سعة
                </button>
                {CAPACITY_PRESETS.map((cap) => {
                  const active = minCapacityValue === cap;
                  return (
                    <button
                      key={cap}
                      type="button"
                      onClick={() =>
                        setMinCapacityInput(active ? '' : String(cap))
                      }
                      aria-pressed={active}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-mono-num tabular-nums font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        active
                          ? 'bg-[#0B57D0] text-white'
                          : 'bg-[#F0F4F9] text-[#444746] hover:bg-[#E9EEF6] hover:text-[#1F1F1F]'
                      }`}
                    >
                      +{cap} مقعد
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {filteredClassrooms.length === 0 ? (
            <div className="bg-white border border-[#DADCE0] rounded-2xl p-10 text-center space-y-3">
              <p className="text-sm font-semibold text-[#1F1F1F]">
                لا توجد قاعات مطابقة لمعايير البحث والفلترة المحددة
              </p>
              <p className="text-xs text-[#444746]">
                جرّب تقليل الحد الأدنى للسعة أو اختيار تجهيزات أخرى أو مسح الفلاتر لعرض جميع القاعات.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#0B57D0] text-white text-xs font-semibold hover:bg-[#0842A0] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>عرض جميع القاعات</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {filteredClassrooms.map((room) => {
                const todaySessions = todayCountForRoom(room.id);
                const isAvailable = room.status === 'available';
                const isBusy = busyId === room.id;

                return (
                  <article
                    key={room.id}
                    className="bg-white border border-[#DADCE0] rounded-2xl overflow-hidden flex flex-col sm:flex-row hover:border-[#AECBFA] transition-colors"
                  >
                    <div className="sm:w-56 aspect-[4/3] sm:aspect-auto shrink-0 border-b sm:border-b-0 sm:border-l border-[#E8EAED]">
                      <ClassroomImage
                        src={room.imageUrl}
                        alt={room.name}
                        className="w-full h-full min-h-[190px]"
                      />
                    </div>

                    <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                      <div className="space-y-2.5">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-xs text-[#444746] flex flex-wrap items-center gap-1.5">
                              <span className="font-mono-num font-semibold text-[#0B57D0]">
                                {room.code}
                              </span>
                              <span aria-hidden="true">·</span>
                              <span>{room.floor}</span>
                              <span aria-hidden="true">·</span>
                              <span className="inline-flex items-center gap-1 tabular-nums">
                                <Users className="w-3.5 h-3.5 text-[#747775]" />
                                {room.capacity} مقعد
                              </span>
                            </div>
                            <h3 className="font-display text-base font-bold text-[#1F1F1F] mt-1">
                              {room.name}
                            </h3>
                          </div>

                          <span
                            className={`inline-flex items-center gap-1 text-xs font-semibold shrink-0 ${
                              isAvailable ? 'text-[#137333]' : 'text-[#C5221F]'
                            }`}
                          >
                            {isAvailable ? (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            ) : (
                              <Wrench className="w-3.5 h-3.5" />
                            )}
                            {CLASSROOM_STATUS_LABEL[room.status]}
                          </span>
                        </div>

                        <div className="text-xs text-[#444746] leading-relaxed">
                          <span className="font-medium text-[#1F1F1F]">التجهيزات: </span>
                          {room.equipment.map((eq, idx) => {
                            const isMatched =
                              (selectedEquipmentExact !== 'all' &&
                                eq.trim() === selectedEquipmentExact) ||
                              selectedPresets.some((pid) => {
                                const preset = EQUIPMENT_PRESETS.find(
                                  (p) => p.id === pid
                                );
                                return preset
                                  ? equipmentMatchesPreset(eq, preset)
                                  : false;
                              }) ||
                              (searchQuery.trim() !== '' &&
                                matchesAllSearchTokens(eq, searchQuery));

                            return (
                              <span key={`${room.id}-eq-${idx}`}>
                                {idx > 0 && ' · '}
                                <span
                                  className={
                                    isMatched
                                      ? 'font-semibold text-[#0B57D0] underline decoration-[#4285F4] underline-offset-4'
                                      : undefined
                                  }
                                >
                                  {eq}
                                </span>
                              </span>
                            );
                          })}
                        </div>

                        {room.notes && (
                          <p className="text-xs text-[#747775] leading-relaxed line-clamp-2">
                            {room.notes}
                          </p>
                        )}
                      </div>

                      <div className="pt-3 border-t border-[#E8EAED] flex flex-wrap items-center justify-between gap-3">
                        <span className="text-xs text-[#444746] tabular-nums">
                          محاضرات اليوم:{' '}
                          <strong className="font-mono-num text-[#1F1F1F]">{todaySessions}</strong>
                        </span>

                        <div className="flex items-center gap-2">
                          {isAdmin && (
                            <>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={async () => {
                                  setBusyId(room.id);
                                  try {
                                    await onToggleMaintenance(room);
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                                className="px-2.5 py-1.5 rounded-lg border border-[#DADCE0] text-xs font-medium text-[#444746] hover:bg-[#F0F4F9] hover:text-[#1F1F1F] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                              >
                                {isAvailable ? 'تحويل للصيانة' : 'تفعيل القاعة'}
                              </button>
                              <button
                                type="button"
                                onClick={() => onEditClassroom(room)}
                                className="p-1.5 rounded-lg text-[#444746] hover:text-[#1F1F1F] hover:bg-[#F0F4F9] transition-colors cursor-pointer"
                                title="تعديل القاعة"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={async () => {
                                  setBusyId(room.id);
                                  try {
                                    await onDeleteClassroom(room);
                                  } finally {
                                    setBusyId(null);
                                  }
                                }}
                                className="p-1.5 rounded-lg text-[#747775] hover:text-[#C5221F] hover:bg-[#FCE8E6] transition-colors cursor-pointer"
                                title="حذف القاعة"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}

                          {canBook && (
                            <button
                              type="button"
                              disabled={!isAvailable}
                              onClick={() => onBookRoom(room.id)}
                              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[#0B57D0] text-white text-xs font-semibold hover:bg-[#0842A0] disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                            >
                              <CalendarPlus className="w-3.5 h-3.5" />
                              <span>حجز القاعة</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
