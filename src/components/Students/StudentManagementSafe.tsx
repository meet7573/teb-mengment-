import React from 'react';
import { Student, UserRole } from '../../types';
import { StudentManagement } from './StudentManagement';

interface Props {
  students: Student[];
  onSaveStudents: (updated: Student[]) => void;
  activeRole: UserRole;
  onNavigate?: (tab: string) => void;
  onQuickAssignTablet: (student: Student) => void;
}

function normalizeStudent(student: Student): Student {
  const raw = student as Student & { appPin?: unknown; pin?: unknown };
  const rawPin = raw.pinNumber ?? raw.appPin ?? raw.pin ?? '';
  const pin = String(rawPin ?? '').trim();
  const fallbackDigits = String(student.id ?? '').replace(/\D/g, '').slice(-4).padStart(4, '0');

  return {
    ...student,
    name: String(student.name ?? '').trim(),
    pinNumber: pin || `PIN-${fallbackDigits}`,
    standard: student.standard || 'Std 8',
    isCoachingStudent: Boolean(student.isCoachingStudent),
    status: student.status === 'Inactive' ? 'Inactive' : 'Active',
  };
}

export const StudentManagementSafe: React.FC<Props> = ({ students, onSaveStudents, activeRole, onNavigate, onQuickAssignTablet }) => {
  const safeStudents = React.useMemo(() => students.map(normalizeStudent), [students]);

  return (
    <StudentManagement
      students={safeStudents}
      onSaveStudents={onSaveStudents}
      activeRole={activeRole}
      onNavigate={onNavigate}
      onQuickAssignTablet={onQuickAssignTablet}
    />
  );
};
