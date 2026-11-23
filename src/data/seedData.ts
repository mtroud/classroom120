import {
  BookingStatus,
  BookingType,
  ClassroomStatus,
  DepartmentStatus,
} from '../types';
import { addDaysISO, getTodayISO } from '../utils/schedule';

export const CLASSROOM_IMAGE_PRESETS = [
  {
    label: 'قاعة محاضرات كبرى',
    url: '/src/assets/images/classroom_grand_hall_1795327753344.jpg',
  },
  {
    label: 'مختبر وقاعة تقنية',
    url: '/src/assets/images/classroom_tech_lab_1795327753555.jpg',
  },
  {
    label: 'قاعة ندوات ودراسات',
    url: '/src/assets/images/classroom_seminar_room_1795327753912.jpg',
  },
  {
    label: 'قاعة عمل وتعلم تعاوني',
    url: '/src/assets/images/classroom_collaborative_studio_1795327753951.jpg',
  },
] as const;

export const ATABA_DEPARTMENTS = [
  'قسم مجمع سيد الشهداء (ع) الخدمي',
  'قسم الشؤون الفكرية والثقافية',
  'قسم الشؤون الدينية',
  'قسم تطوير الموارد البشرية',
  'قسم التعليم العالي',
  'قسم التربية والتعليم',
  'قسم دار القرآن الكريم',
  'قسم النشاطات العامة',
  'قسم الإعلام',
  'قسم الشؤون الهندسية والفنية',
  'قسم الصيانة',
  'قسم العلاقات العامة',
  'أكاديمية الوارث للتنمية البشرية',
  'شعبة التعليم المستمر',
] as const;

export interface SeedDepartmentInput {
  id: string;
  name: string;
  code: string;
  headName: string;
  sector: string;
  status: DepartmentStatus;
  notes: string;
}

export const INITIAL_DEPARTMENTS: SeedDepartmentInput[] = ATABA_DEPARTMENTS.map(
  (name, index) => ({
    id: `dept-${String(index + 1).padStart(2, '0')}`,
    name,
    code: `DEP-${String(index + 1).padStart(2, '0')}`,
    headName: '',
    sector: 'العتبة الحسينية المقدسة',
    status: 'active',
    notes: '',
  })
);

export interface SeedClassroomInput {
  id: string;
  name: string;
  code: string;
  floor: string;
  capacity: number;
  equipment: string[];
  status: ClassroomStatus;
  imageUrl: string;
  notes: string;
}

export const INITIAL_CLASSROOMS: SeedClassroomInput[] = [
  {
    id: 'room-al-sadr-hall',
    name: 'قاعة الشهيد الصدر (ع) الكبرى',
    code: 'SH-101',
    floor: 'الطابق الأول',
    capacity: 60,
    equipment: [
      'سبورة ذكية تفاعلية 86 بوصة',
      'نظام صوتي محيطي لاسلكي',
      'جهاز عرض ليزري 4K',
      'تكييف مركزي وإنترنت فائق السرعة',
    ],
    status: 'available',
    imageUrl: '/src/assets/images/classroom_grand_hall_1795327753344.jpg',
    notes: 'مخصصة للمحاضرات المركزية والدورات العلمية الكبرى مع نظام بث وتسجيل متكامل.',
  },
  {
    id: 'room-alnoor-tech',
    name: 'قاعة النور التقنية الذكية',
    code: 'NT-102',
    floor: 'الطابق الأول',
    capacity: 35,
    equipment: [
      '35 محطة حاسوب حديثة',
      'شاشة عرض تفاعلية مزدوجة',
      'نظام مؤتمرات وربط مرئي',
      'إضاءة دراسية متدرجة',
    ],
    status: 'available',
    imageUrl: '/src/assets/images/classroom_tech_lab_1795327753555.jpg',
    notes: 'مجهزة للتدريب العملي والورش التكنولوجية والاختبارات الإلكترونية.',
  },
  {
    id: 'room-almaarifa-seminar',
    name: 'قاعة المعرفة للندوات',
    code: 'MS-201',
    floor: 'الطابق الثاني',
    capacity: 45,
    equipment: [
      'منصة محاضر رقمية ذكية',
      'شاشتا عرض جانبيتان عالية الدقة',
      'نظام تسجيل صوتي وعزل ضوضاء',
      'مقاعد دراسية مريحة بمنافذ طاقة',
    ],
    status: 'available',
    imageUrl: '/src/assets/images/classroom_seminar_room_1795327753912.jpg',
    notes: 'بيئة هادئة مهيأة للحلقات البحثية والندوات الفكرية والدورات التخصصية.',
  },
  {
    id: 'room-alibdaa-studio',
    name: 'قاعة الإبداع للتعلم التفاعلي',
    code: 'CS-202',
    floor: 'الطابق الثاني',
    capacity: 25,
    equipment: [
      'طاولات عمل جماعي مرنة',
      'سبورة زجاجية ذكية تفاعلية',
      'بث عرض لاسلكي متعدد الأجهزة',
      'إضاءة طبيعية ومعالجة صوتية',
    ],
    status: 'available',
    imageUrl: '/src/assets/images/classroom_collaborative_studio_1795327753951.jpg',
    notes: 'مصممة لورش العمل الجماعية وجلسات العصف الذهني وتأهيل الطلبة.',
  },
];

export interface SeedBookingInput {
  id: string;
  roomId: string;
  roomName: string;
  courseTitle: string;
  instructorName: string;
  department: string;
  bookingType: BookingType;
  date: string;
  startTime: string;
  endTime: string;
  attendeesCount: number;
  status: BookingStatus;
  notes: string;
}

export function buildInitialBookings(): SeedBookingInput[] {
  const today = getTodayISO();
  const tomorrow = addDaysISO(today, 1);
  return [
    {
      id: 'seed-booking-1',
      roomId: 'room-al-sadr-hall',
      roomName: 'قاعة الشهيد الصدر (ع) الكبرى',
      courseTitle: 'أساسيات البحث العلمي ومنهجية التحليل',
      instructorName: 'د. حيدر الموسوي',
      department: 'قسم الشؤون الفكرية والثقافية',
      bookingType: 'lecture',
      date: today,
      startTime: '09:00',
      endTime: '11:00',
      attendeesCount: 48,
      status: 'confirmed',
      notes: 'تجهيز السبورة الذكية قبل بدء المحاضرة بربع ساعة.',
    },
    {
      id: 'seed-booking-2',
      roomId: 'room-alnoor-tech',
      roomName: 'قاعة النور التقنية الذكية',
      courseTitle: 'ورشة تطبيقات الذكاء الاصطناعي لطلبة الجامعات',
      instructorName: 'م. زينب الكاظمي',
      department: 'قسم تطوير الموارد البشرية',
      bookingType: 'workshop',
      date: today,
      startTime: '10:00',
      endTime: '12:30',
      attendeesCount: 30,
      status: 'confirmed',
      notes: 'تشغيل كافة محطات العمل والتأكد من الاتصال الشبكي.',
    },
    {
      id: 'seed-booking-3',
      roomId: 'room-almaarifa-seminar',
      roomName: 'قاعة المعرفة للندوات',
      courseTitle: 'ندوة تطوير المهارات القيادية للطلبة',
      instructorName: 'أ. علي الحسيني',
      department: 'قسم مجمع سيد الشهداء (ع) الخدمي',
      bookingType: 'seminar',
      date: today,
      startTime: '13:00',
      endTime: '15:00',
      attendeesCount: 38,
      status: 'confirmed',
      notes: 'تفعيل التسجيل الصوتي ومنصة المحاضر الرقمية.',
    },
    {
      id: 'seed-booking-4',
      roomId: 'room-alibdaa-studio',
      roomName: 'قاعة الإبداع للتعلم التفاعلي',
      courseTitle: 'حلقة نقاشية في مهارات العرض والإلقاء',
      instructorName: 'أ. محمد البغدادي',
      department: 'قسم النشاطات العامة',
      bookingType: 'workshop',
      date: today,
      startTime: '16:00',
      endTime: '18:00',
      attendeesCount: 20,
      status: 'pending',
      notes: 'طلب قيد انتظار موافقة الإدارة لتثبيت موعد المساء.',
    },
    {
      id: 'seed-booking-5',
      roomId: 'room-al-sadr-hall',
      roomName: 'قاعة الشهيد الصدر (ع) الكبرى',
      courseTitle: 'الاختبار التقييمي لدورة التلاوة والعلوم القرآنية',
      instructorName: 'د. سجاد العامري',
      department: 'قسم دار القرآن الكريم',
      bookingType: 'exam',
      date: tomorrow,
      startTime: '09:30',
      endTime: '11:30',
      attendeesCount: 52,
      status: 'confirmed',
      notes: 'توزيع المقاعد بنظام التباعد الامتحاني.',
    },
  ];
}
