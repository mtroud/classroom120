import { useState } from 'react';
import {
  CalendarPlus,
  CheckCircle2,
  Pencil,
  Plus,
  Trash2,
  Users,
  Wrench,
} from 'lucide-react';
import { Booking, Classroom } from '../types';
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
  const todayISO = getTodayISO();

  const todayCountForRoom = (roomId: string) =>
    bookings.filter(
      (b) => b.roomId === roomId && b.date === todayISO && isActiveBooking(b)
    ).length;

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="bg-white border border-slate-200 rounded-xl h-64"
          />
        ))}
      </div>
    );
  }

  return (
    <section className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            القاعات الدراسية المجهزة ({classrooms.length})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
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
                className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                {seeding ? 'جاري التهيئة...' : 'تحميل القاعات الافتراضية'}
              </button>
            )}
            <button
              type="button"
              onClick={onAddClassroom}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة قاعة جديدة</span>
            </button>
          </div>
        )}
      </div>

      {classrooms.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <p className="text-sm font-medium text-slate-800">
            لم يتم تسجيل أي قاعة دراسية بعد
          </p>
          <p className="text-xs text-slate-500">
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

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {classrooms.map((room) => {
            const todaySessions = todayCountForRoom(room.id);
            const isAvailable = room.status === 'available';
            const isBusy = busyId === room.id;

            return (
              <article
                key={room.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col sm:flex-row"
              >
                <div className="sm:w-56 aspect-[4/3] sm:aspect-auto shrink-0 border-b sm:border-b-0 sm:border-l border-slate-200">
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
                        <div className="text-xs text-slate-500 flex flex-wrap items-center gap-1.5">
                          <span className="font-mono-num font-semibold text-teal-800">
                            {room.code}
                          </span>
                          <span aria-hidden="true">·</span>
                          <span>{room.floor}</span>
                          <span aria-hidden="true">·</span>
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <Users className="w-3.5 h-3.5" />
                            {room.capacity} مقعد
                          </span>
                        </div>
                        <h3 className="font-display text-base font-bold text-slate-900 mt-1">
                          {room.name}
                        </h3>
                      </div>

                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium shrink-0 ${
                          isAvailable ? 'text-emerald-700' : 'text-red-700'
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

                    <div className="text-xs text-slate-600 leading-relaxed">
                      <span className="font-medium text-slate-800">التجهيزات: </span>
                      {room.equipment.join(' · ')}
                    </div>

                    {room.notes && (
                      <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                        {room.notes}
                      </p>
                    )}
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-500 tabular-nums">
                      محاضرات اليوم: <strong className="text-slate-900">{todaySessions}</strong>
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
                            className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                          >
                            {isAvailable ? 'تحويل للصيانة' : 'تفعيل القاعة'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onEditClassroom(room)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
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
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-700 hover:bg-red-50 transition-colors cursor-pointer"
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
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-40 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
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
        </>
      )}
    </section>
  );
}
