import React from 'react';
import { Student, UserRole } from '../../types';
import { StudentManagementAutoPin } from './StudentManagementAutoPin';

interface Props {
  students: Student[];
  onSaveStudents: (updated: Student[]) => void;
  activeRole: UserRole;
  onNavigate?: (tab: string) => void;
  onQuickAssignTablet: (student: Student) => void;
}

export const StudentManagementSafe: React.FC<Props> = ({ students, onSaveStudents, activeRole, onQuickAssignTablet }) => (
  <StudentManagementAutoPin
    students={students}
    onSaveStudents={onSaveStudents}
    activeRole={activeRole}
    onQuickAssignTablet={onQuickAssignTablet}
  />
);
