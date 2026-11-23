import { Timestamp } from 'firebase/firestore';

export type ClassroomStatus = 'available' | 'maintenance';
export type BookingStatus = 'pending' | 'confirmed' | 'rejected' | 'cancelled';
export type BookingType = 'lecture' | 'workshop' | 'exam' | 'seminar';
export type DepartmentStatus = 'active' | 'inactive';
export type UserRole = 'admin' | 'branch_supervisor' | 'coordinator' | 'viewer';
export type AccountStatus = 'active' | 'suspended';
export type ViewTab =
  | 'schedule'
  | 'bookings'
  | 'classrooms'
  | 'departments'
  | 'reports'
  | 'audit'
  | 'accounts'
  | 'settings';

export type AuditEntityType =
  | 'booking'
  | 'classroom'
  | 'department'
  | 'account'
  | 'settings';

export type AuditActionType =
  | 'create'
  | 'update'
  | 'approve'
  | 'reject'
  | 'cancel'
  | 'delete'
  | 'restore';

export interface AuditLogEntry {
  id: string;
  entityType: AuditEntityType;
  entityId: string;
  entityLabel: string;
  action: AuditActionType;
  summary: string;
  actorUid: string;
  actorName: string;
  actorRole: UserRole;
  branchName: string;
  createdAt?: Timestamp | unknown;
}

export interface AccountPermissions {
  approveBookings: boolean;
  manageBookings: boolean;
  manageClassrooms: boolean;
  manageDepartments: boolean;
  viewReports: boolean;
  manageSettings: boolean;
}

export interface AccountRecord {
  id: string;
  email: string;
  displayName: string;
  branchName: string;
  role: UserRole;
  status: AccountStatus;
  permissions: AccountPermissions;
  notes: string;
  createdBy: string;
  createdAt?: Timestamp | unknown;
  updatedAt?: Timestamp | unknown;
}

export interface SystemSettings {
  id: string;
  organizationName: string;
  complexSubtitle: string;
  workStartHour: string;
  workEndHour: string;
  maxAdvanceDays: number;
  requireAdminApproval: boolean;
  allowWeekendBookings: boolean;
  strictAccountAccess: boolean;
  reportHeaderTitle: string;
  reportFooterNote: string;
  lastBackupAt: string;
  lastBackupBy: string;
  updatedBy: string;
  updatedAt?: Timestamp | unknown;
}

export interface Classroom {
  id: string;
  name: string;
  code: string;
  floor: string;
  capacity: number;
  equipment: string[];
  status: ClassroomStatus;
  imageUrl: string;
  notes: string;
  createdBy: string;
  createdAt?: Timestamp | unknown;
  updatedAt?: Timestamp | unknown;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  headName: string;
  sector: string;
  status: DepartmentStatus;
  notes: string;
  createdBy: string;
  createdAt?: Timestamp | unknown;
  updatedAt?: Timestamp | unknown;
}

export interface Booking {
  id: string;
  roomId: string;
  roomName: string;
  courseTitle: string;
  instructorName: string;
  department: string;
  bookingType: BookingType;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  attendeesCount: number;
  status: BookingStatus;
  notes: string;
  creatorId: string;
  creatorName: string;
  createdAt?: Timestamp | unknown;
  updatedAt?: Timestamp | unknown;
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  department: string;
  role: UserRole;
  createdAt?: Timestamp | unknown;
  updatedAt?: Timestamp | unknown;
}

// Validation limits synchronized verbatim with firebase-blueprint.json & firestore.rules
export const BLUEPRINT_LIMITS = {
  ID_PATTERN: /^[a-zA-Z0-9_\-]+$/,
  DATE_PATTERN: /^\d{4}-\d{2}-\d{2}$/,
  TIME_PATTERN: /^([01]\d|2[0-3]):[0-5]\d$/,
  ROOM_NAME_MAX: 100,
  ROOM_CODE_MAX: 24,
  FLOOR_MAX: 40,
  EQUIPMENT_MAX_ITEMS: 10,
  EQUIPMENT_ITEM_MAX: 60,
  COURSE_TITLE_MAX: 120,
  INSTRUCTOR_MAX: 80,
  DEPARTMENT_MAX: 80,
  HEAD_NAME_MAX: 80,
  SECTOR_MAX: 80,
  NOTES_MAX: 300,
  CAPACITY_MAX: 500,
  IMAGE_URL_MAX: 300,
  EMAIL_MAX: 160,
  DISPLAY_NAME_MAX: 80,
  BRANCH_NAME_MAX: 80,
  ORG_NAME_MAX: 100,
  SUBTITLE_MAX: 120,
  REPORT_HEADER_MAX: 140,
  REPORT_FOOTER_MAX: 200,
  MAX_ADVANCE_DAYS_MAX: 365,
  AUDIT_ENTITY_LABEL_MAX: 140,
  AUDIT_SUMMARY_MAX: 240,
} as const;

export const BOOTSTRAPPED_ADMIN_EMAIL = 'control.mogma@gmail.com';
