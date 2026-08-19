import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Tablet as TabletIcon, UserPlus, X, CheckCircle2 } from 'lucide-react';
import { TabletAssignment, Student, Tablet, UserRole } from '../../types';

interface TabletAssignmentProps {
  assignments: TabletAssignment[];
  students: Student[];
  tablets: Tablet[];
  onSaveAssignments: (updatedAssignments: TabletAssignment[]) => void;
  onSaveStudents: (updatedStudents: Student[]) => void;
  onSaveTablets: (updatedTablets: Tablet[]) => void;
  activeRole: UserRole;
  preselectedStudentForAssign?: Student | null;
  preselectedTabletForAssign?: Tablet | null;
  onClearPreselections?: () => void;
  onNavigate?: (tab: string) => void;
}

export const TabletAssignmentView: React.FC<TabletAssignmentProps> = ({
  assignments,
  students,
  tablets,
  onSaveAssignments,
  onSaveStudents,
  onSaveTablets,
  activeRole,
  preselectedStudentForAssign,
  preselectedTabletForAssign,
  onClearPreselections,
}) => {
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [returningAssignment, setReturningAssignment] = useState<TabletAssignment | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTabletId, setSelectedTabletId] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const activeAssignments = useMemo(
    () => assignments.filter((assignment) => assignment.status === 'Active'),
    [assignments]
  );

  const activeAssignmentByStudent = useMemo(() => {
    const map = new Map<string, TabletAssignment>();
    activeAssignments.forEach((assignment) => map.set(assignment.studentId, assignment));
    return map;
  }, [activeAssignments]);

  const availableTablets = useMemo(
    () => tablets.filter((tablet) => tablet.status === 'Available'),
    [tablets]
  );

  const unassignedStudents = useMemo(
    () => students.filter((student) => student.status === 'Active' && !activeAssignmentByStudent.has(student.id) && !student.assignedTabletId),
    [students, activeAssignmentByStudent]
  );

  const selectedStudent = students.find((student) => student.id === selectedStudentId) || null;
  const selectedTablet = tablets.find((tablet) => tablet.id === selectedTabletId) || null;

  useEffect(() => {
    if (!preselectedStudentForAssign && !preselectedTabletForAssign) return;

    setSelectedStudentId(preselectedStudentForAssign?.id || '');
    setSelectedTabletId(preselectedTabletForAssign?.id || '');
    setIsAssignModalOpen(true);
  }, [preselectedStudentForAssign, preselectedTabletForAssign]);

  const closeAssignModal = () => {
    setIsAssignModalOpen(false);
    setSelectedStudentId('');
    setSelectedTabletId('');
    onClearPreselections?.();
  };

  const openAssignModal = (student?: Student) => {
    setSelectedStudentId(student?.id || '');
    setSelectedTabletId('');
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssign = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!selectedStudent || !selectedTablet) {
      alert('Please select a student and an available tablet.');
      return;
    }

    if (selectedStudent.assignedTabletId || activeAssignmentByStudent.has(selectedStudent.id)) {
      alert('This student already has a tablet assigned.');
      return;
    }

    if (selectedTablet.status !== 'Available') {
      alert('This tablet is no longer available. Please select another tablet.');
      return;
    }

    setIsSaving(true);

    const newAssignment: TabletAssignment = {
      id: `asg-${Date.now()}`,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      pinNumber: selectedStudent.pinNumber,
      standard: selectedStudent.standard,
      tabletId: selectedTablet.id,
      tabletNumber: selectedTablet.tabletNumber,
      tabletName: selectedTablet.tabletName,
      boxId: selectedTablet.boxId,
      boxNumber: selectedTablet.boxNumber,
      assignDate: today,
      status: 'Active',
      remarks: '',
      assignedBy: 'System Admin',
    };

    const updatedStudents = students.map((student) =>
      student.id === selectedStudent.id
        ? {
            ...student,
            assignedTabletId: selectedTablet.id,
            assignedTabletNumber: selectedTablet.tabletNumber,
          }
        : student
    );

    const updatedTablets = tablets.map((tablet) =>
      tablet.id === selectedTablet.id
        ? {
            ...tablet,
            status: 'Assigned' as const,
            assignedToStudentId: selectedStudent.id,
            assignedToStudentName: selectedStudent.name,
          }
        : tablet
    );

    onSaveAssignments([newAssignment, ...assignments]);
    onSaveStudents(updatedStudents);
    onSaveTablets(updatedTablets);

    setIsSaving(false);
    closeAssignModal();
  };

  const handleConfirmReturn = () => {
    if (!returningAssignment) return;

    const returnedAssignmentId = returningAssignment.id;

    const updatedAssignments = assignments.map((assignment) =>
      assignment.id === returnedAssignmentId
        ? {
            ...assignment,
            status: 'Returned' as const,
            returnDate: today,
          }
        : assignment
    );

    const updatedStudents = students.map((student) =>
      student.id === returningAssignment.studentId
        ? {
            ...student,
            assignedTabletId: undefined,
            assignedTabletNumber: undefined,
          }
        : student
    );

    const updatedTablets = tablets.map((tablet) =>
      tablet.id === returningAssignment.tabletId
        ? {
            ...tablet,
            status: 'Available' as const,
            assignedToStudentId: undefined,
            assignedToStudentName: undefined,
          }
        : tablet
    );

    onSaveAssignments(updatedAssignments);
    onSaveStudents(updatedStudents);
    onSaveTablets(updatedTablets);
    setReturningAssignment(null);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">Tablet Assignment</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Assign one available tablet to a student and return it when finished.
          </p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800">
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">Student Name</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">Standard</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">Type</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">Tablet</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {students.filter((student) => student.status === 'Active').map((student) => {
                const assignment = activeAssignmentByStudent.get(student.id);
                const tabletNumber = assignment?.tabletNumber || student.assignedTabletNumber;

                return (
                  <tr key={student.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition">
                    <td className="px-5 py-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100">{student.name}</div>
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600 dark:text-slate-300">{student.standard || '-'}</td>
                    <td className="px-5 py-4">
                      <span className="inline-flex px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-xs font-medium text-slate-700 dark:text-slate-300">
                        {student.isCoachingStudent ? 'Coaching' : 'Non-Coaching'}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      {tabletNumber ? (
                        <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600">
                          <TabletIcon className="w-4 h-4" />
                          {tabletNumber}
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">Not Assigned</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {assignment ? (
                        <button
                          type="button"
                          onClick={() => setReturningAssignment(assignment)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs transition"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          Return Tablet
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openAssignModal(student)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs transition"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Assign Tablet
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}

              {students.filter((student) => student.status === 'Active').length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">
                    No active students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Assign Tablet</h3>
                <p className="text-xs text-slate-500 mt-0.5">Assign an available tablet to this student.</p>
              </div>
              <button type="button" onClick={closeAssignModal} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAssign} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Student Name</label>
                {preselectedStudentForAssign || selectedStudent ? (
                  <div className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800">
                    {(selectedStudent || preselectedStudentForAssign)?.name}
                  </div>
                ) : (
                  <select
                    value={selectedStudentId}
                    onChange={(event) => setSelectedStudentId(event.target.value)}
                    className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-500"
                    required
                  >
                    <option value="">Select student</option>
                    {unassignedStudents.map((student) => (
                      <option key={student.id} value={student.id}>
                        {student.name} - Std {student.standard}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tablet Number / Name</label>
                <select
                  value={selectedTabletId}
                  onChange={(event) => setSelectedTabletId(event.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-500"
                  required
                >
                  <option value="">Select available tablet</option>
                  {availableTablets.map((tablet) => (
                    <option key={tablet.id} value={tablet.id}>
                      {tablet.tabletNumber} - {tablet.tabletName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Box Number</label>
                <div className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700">
                  {selectedTablet?.boxNumber || 'No box assigned'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Assign Date</label>
                <div className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700">
                  {today}
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={closeAssignModal} className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving || availableTablets.length === 0}
                  className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm transition"
                >
                  {isSaving ? 'Assigning...' : 'Assign'}
                </button>
              </div>

              {availableTablets.length === 0 && (
                <p className="text-xs text-rose-600">No available tablets. Return a tablet before assigning a new one.</p>
              )}
            </form>
          </div>
        </div>
      )}

      {returningAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Return Tablet?</h3>
                <p className="text-sm text-slate-500 mt-1">Confirm that this tablet is being returned.</p>
              </div>
              <button type="button" onClick={() => setReturningAssignment(null)} className="text-slate-400 hover:text-slate-700">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4 space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Student</span>
                <strong className="text-slate-800">{returningAssignment.studentName}</strong>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-slate-500">Tablet</span>
                <strong className="text-slate-800">{returningAssignment.tabletNumber}</strong>
              </div>
            </div>

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setReturningAssignment(null)} className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50">
                Cancel
              </button>
              <button type="button" onClick={handleConfirmReturn} className="px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm transition">
                Return Tablet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
