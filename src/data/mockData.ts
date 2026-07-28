import { Student, Tablet, TabletBox, TabletAssignment, DailyAttendanceRecord, AuditLog, User } from '../types';

export const mockUsers: User[] = [
  {
    id: 'usr-1',
    name: 'Dr. Rajesh Sharma',
    email: 'rajesh.sharma@school.edu',
    role: 'Super Admin',
    avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
  },
];

export const mockStudents: Student[] = [
  {
    id: 'std-8001',
    pinNumber: '240015',
    name: 'Rahul Patel',
    standard: 'Std 10',
    isCoachingStudent: true,
    status: 'Active',
    assignedTabletId: 'tbl-8001',
    assignedTabletNumber: 'TBL-8001',
    createdAt: '2025-01-10',
  },
  {
    id: 'std-8002',
    pinNumber: '240016',
    name: 'Riya Shah',
    standard: 'Std 10',
    isCoachingStudent: false,
    status: 'Active',
    assignedTabletId: 'tbl-8002',
    assignedTabletNumber: 'TBL-8002',
    createdAt: '2025-01-10',
  },
  {
    id: 'std-8003',
    pinNumber: '240017',
    name: 'Aarav Mehta',
    standard: 'Std 9',
    isCoachingStudent: true,
    status: 'Active',
    createdAt: '2025-01-12',
  },
  {
    id: 'std-8004',
    pinNumber: '240018',
    name: 'Priya Sharma',
    standard: 'Std 9',
    isCoachingStudent: false,
    status: 'Active',
    createdAt: '2025-01-12',
  },
  {
    id: 'std-8005',
    pinNumber: '240019',
    name: 'Karan Verma',
    standard: 'Std 8',
    isCoachingStudent: true,
    status: 'Active',
    createdAt: '2025-01-15',
  },
];

export const mockTablets: Tablet[] = [
  {
    id: 'tbl-8001',
    tabletNumber: 'TBL-8001',
    tabletName: 'Galaxy Tab A9-01',
    brand: 'Samsung',
    model: 'Galaxy Tab A9',
    qrCode: 'QR-TBL-8001',
    barcode: 'BC-TBL-8001',
    status: 'Assigned',
    entryDate: '2025-01-10',
    assignedToStudentId: 'std-8001',
    assignedToStudentName: 'Rahul Patel',
    boxId: 'box-1',
    boxNumber: 'BOX-01',
  },
  {
    id: 'tbl-8002',
    tabletNumber: 'TBL-8002',
    tabletName: 'Galaxy Tab A9-02',
    brand: 'Samsung',
    model: 'Galaxy Tab A9',
    qrCode: 'QR-TBL-8002',
    barcode: 'BC-TBL-8002',
    status: 'Assigned',
    entryDate: '2025-01-10',
    assignedToStudentId: 'std-8002',
    assignedToStudentName: 'Riya Shah',
    boxId: 'box-1',
    boxNumber: 'BOX-01',
  },
  {
    id: 'tbl-8003',
    tabletNumber: 'TBL-8003',
    tabletName: 'Lenovo Tab M10-01',
    brand: 'Lenovo',
    model: 'Tab M10 Plus',
    qrCode: 'QR-TBL-8003',
    barcode: 'BC-TBL-8003',
    status: 'Available',
    entryDate: '2025-01-12',
    boxId: 'box-1',
    boxNumber: 'BOX-01',
  },
];

export const mockTabletBoxes: TabletBox[] = [
  {
    id: 'box-1',
    boxNumber: 'BOX-01',
    boxName: 'Vault Alpha Box 1',
    location: 'Lab Room 101',
    capacity: 7,
    tablets: [],
    qrCode: 'BOX-QR-01',
    createdAt: '2025-01-01',
  },
];

export const mockAssignments: TabletAssignment[] = [
  {
    id: 'asg-1',
    studentId: 'std-8001',
    studentName: 'Rahul Patel',
    pinNumber: '240015',
    standard: 'Std 10',
    tabletId: 'tbl-8001',
    tabletNumber: 'TBL-8001',
    tabletName: 'Galaxy Tab A9-01',
    boxId: 'box-1',
    boxNumber: 'BOX-01',
    assignDate: new Date().toISOString().slice(0, 10),
    status: 'Active',
    assignedBy: 'Dr. Rajesh Sharma',
  },
];

export const mockAttendanceRecords: DailyAttendanceRecord[] = [];

export const mockAuditLogs: AuditLog[] = [];
