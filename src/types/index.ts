export type UserRole = 'Super Admin' | 'Admin' | 'Teacher' | 'Operator';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar: string;
}

export type StandardGrade = 'Std 8' | 'Std 9' | 'Std 10' | 'Std 11' | 'Std 12';
export type StudentStatus = 'Pending' | 'Approved' | 'Active' | 'Present' | 'Inactive';

export interface Student {
  id: string;
  name: string;
  pinNumber: string;
  standard: StandardGrade;
  isCoachingStudent: boolean;
  status: StudentStatus;
  assignedTabletId?: string;
  assignedTabletNumber?: string;
  photoPath?: string;
  roomNumber?: string;
  wingNumber?: string;
  createdAt: string;
}

export type TabletStatus = 'Available' | 'Assigned' | 'Maintenance';
export interface Tablet { id: string; tabletName: string; tabletNumber: string; qrCode: string; barcode: string; brand: string; model: string; entryDate: string; status: TabletStatus; boxId?: string; boxNumber?: string; assignedToStudentId?: string; assignedToStudentName?: string; photoPath?: string; }
export interface TabletBox { id: string; boxNumber: string; boxName: string; capacity: number; location: string; qrCode: string; tablets: Tablet[]; createdAt: string; }
export interface TabletAssignment { id: string; studentId: string; studentName: string; pinNumber: string; standard: StandardGrade; tabletId: string; tabletNumber: string; tabletName: string; boxId?: string; boxNumber?: string; assignDate: string; returnDate?: string; status: 'Active' | 'Returned'; remarks?: string; assignedBy: string; }
export type AttendanceStatus = 'Checked In' | 'Checked Out' | 'Present' | 'Absent' | 'Leave' | 'Late';
export interface AttendanceDetail { studentId: string; studentName: string; pinNumber: string; standard: StandardGrade; isCoachingStudent: boolean; assignedTabletNumber?: string; status: AttendanceStatus; checkInTime?: string; checkOutTime?: string; totalDuration?: string; cancellationExpiry?: string; remarks?: string; markedAt: string; }
export interface DailyAttendanceRecord { id: string; date: string; standard?: StandardGrade; isLocked: boolean; lockedAt?: string; lockedBy?: string; submittedBy: string; submittedAt: string; details: AttendanceDetail[]; }
export interface AuditLog { id: string; timestamp: string; userName: string; userRole: UserRole; action: string; module: 'Students' | 'Tablets' | 'Tablet Boxes' | 'Assignments' | 'Attendance' | 'System'; details: string; }
export interface GlobalSearchResult { id: string; type: 'Student' | 'Tablet' | 'Box' | 'Assignment'; title: string; subtitle: string; tag?: string; data: any; }
