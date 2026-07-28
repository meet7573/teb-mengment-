export type UserRole = 'Super Admin' | 'Admin' | 'Teacher' | 'Operator';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
}

export type StandardGrade = 'Std 8' | 'Std 9' | 'Std 10' | 'Std 11' | 'Std 12';

export interface Student {
  id: string;
  name: string;
  pinNumber: string; // e.g. "PIN-1001"
  standard: StandardGrade;
  isCoachingStudent: boolean;
  status: 'Active' | 'Inactive';
  assignedTabletId?: string;
  assignedTabletNumber?: string;
  createdAt: string;
}

export type TabletStatus = 'Available' | 'Assigned' | 'Maintenance';

export interface Tablet {
  id: string;
  tabletName: string; // e.g. "Tab-Alpha-01"
  tabletNumber: string; // e.g. "TBL-8001"
  qrCode: string;
  barcode: string;
  brand: string; // e.g. "Samsung", "Apple", "Lenovo"
  model: string; // e.g. "Galaxy Tab A9", "iPad 10th Gen", "Tab M10"
  entryDate: string;
  status: TabletStatus;
  boxId?: string;
  boxNumber?: string;
  assignedToStudentId?: string;
  assignedToStudentName?: string;
}

export interface TabletBox {
  id: string;
  boxNumber: string; // e.g. "BOX-01"
  boxName: string; // e.g. "Cabinet Alpha - Box 1"
  capacity: number; // strictly 7
  location: string; // e.g. "Lab 101 - Shelf A"
  qrCode: string;
  tablets: Tablet[]; // array of tablet items assigned to this box (max 7)
  createdAt: string;
}

export interface TabletAssignment {
  id: string;
  studentId: string;
  studentName: string;
  pinNumber: string;
  standard: StandardGrade;
  tabletId: string;
  tabletNumber: string;
  tabletName: string;
  boxId?: string;
  boxNumber?: string;
  assignDate: string;
  returnDate?: string;
  status: 'Active' | 'Returned';
  remarks?: string;
  assignedBy: string;
}

export type AttendanceStatus = 'Checked In' | 'Checked Out' | 'Present' | 'Absent' | 'Leave' | 'Late';

export interface AttendanceDetail {
  studentId: string;
  studentName: string;
  pinNumber: string;
  standard: StandardGrade;
  isCoachingStudent: boolean;
  assignedTabletNumber?: string;
  status: AttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  totalDuration?: string;
  remarks?: string;
  markedAt: string;
}

export interface DailyAttendanceRecord {
  id: string;
  date: string; // YYYY-MM-DD
  standard?: StandardGrade;
  isLocked: boolean;
  lockedAt?: string;
  lockedBy?: string;
  submittedBy: string;
  submittedAt: string;
  details: AttendanceDetail[];
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userName: string;
  userRole: UserRole;
  action: string;
  module: 'Students' | 'Tablets' | 'Tablet Boxes' | 'Assignments' | 'Attendance' | 'System';
  details: string;
}

export interface GlobalSearchResult {
  id: string;
  type: 'Student' | 'Tablet' | 'Box' | 'Assignment';
  title: string;
  subtitle: string;
  tag?: string;
  data: any;
}
