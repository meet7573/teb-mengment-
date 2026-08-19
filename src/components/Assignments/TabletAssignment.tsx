import React, { useEffect, useMemo, useState } from 'react';
import { RotateCcw, Tablet as TabletIcon, UserPlus, X } from 'lucide-react';
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
  preselectedStudentForAssign,
  preselectedTabletForAssign,
  onClearPreselections,
}) => {
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [returningAssignment, setReturningAssignment] = useState<TabletAssignment | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [selectedTabletId, setSelectedTabletId] = useState('');
  const [manualTabletMode, setManualTabletMode] = useState(false);
  const [manualTabletNumber, setManualTabletNumber] = useState('');
  const [manualTabletName, setManualTabletName] = useState('');
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

  const selectedStudent = students.find((student) => student.id === selectedStudentId) || null;
  const selectedTablet = tablets.find((tablet) => tablet.id === selectedTabletId) || null;

  useEffect(() => {
    if (!preselectedStudentForAssign && !preselectedTabletForAssign) return;
    setSelectedStudentId(preselectedStudentForAssign?.id || '');
    setSelectedTabletId(preselectedTabletForAssign?.id || '');
    setManualTabletMode(false);
    setManualTabletNumber('');
    setManualTabletName('');
    setIsAssignModalOpen(true);
  }, [preselectedStudentForAssign, preselectedTabletForAssign]);

  const closeAssignModal = () => {
    setIsAssignModalOpen(false);
    setSelectedStudentId('');
    setSelectedTabletId('');
    setManualTabletMode(false);
    setManualTabletNumber('');
    setManualTabletName('');
    setIsSaving(false);
    onClearPreselections?.();
  };

  const openAssignModal = (student?: Student) => {
    setSelectedStudentId(student?.id || '');
    setSelectedTabletId('');
    setManualTabletMode(false);
    setManualTabletNumber('');
    setManualTabletName('');
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedStudent) return;
    if (selectedStudent.assignedTabletId || activeAssignmentByStudent.has(selectedStudent.id)) return;

    let tabletToAssign = selectedTablet;
    let updatedTablets = [...tablets];

    if (manualTabletMode) {
      const tabletNumber = manualTabletNumber.trim();
      const tabletName = manualTabletName.trim() || tabletNumber;
      if (!tabletNumber) return;

      const duplicate = tablets.some(
        (tablet) => tablet.tabletNumber.trim().toLowerCase() === tabletNumber.toLowerCase()
      );
      if (duplicate) {
        window.alert('This tablet number already exists. Please use another tablet number.');
        return;
      }

      tabletToAssign = {
        id: `tablet-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        tabletName,
        tabletNumber,
        qrCode: tabletNumber,
        barcode: tabletNumber,
        brand: 'Manual',
        model: 'Manual Entry',
        entryDate: today,
        status: 'Assigned',
        assignedToStudentId: selectedStudent.id,
        assignedToStudentName: selectedStudent.name,
      };
      updatedTablets = [tabletToAssign, ...tablets];
    } else {
      if (!tabletToAssign || tabletToAssign.status !== 'Available') return;
      updatedTablets = tablets.map((tablet) =>
        tablet.id === tabletToAssign!.id
          ? {
              ...tablet,
              status: 'Assigned' as const,
              assignedToStudentId: selectedStudent.id,
              assignedToStudentName: selectedStudent.name,
            }
          : tablet
      );
    }

    setIsSaving(true);

    const newAssignment: TabletAssignment = {
      id: `asg-${Date.now()}`,
      studentId: selectedStudent.id,
      studentName: selectedStudent.name,
      pinNumber: selectedStudent.pinNumber,
      standard: selectedStudent.standard,
      tabletId: tabletToAssign!.id,
      tabletNumber: tabletToAssign!.tabletNumber,
      tabletName: tabletToAssign!.tabletName,
      boxId: tabletToAssign!.boxId,
      boxNumber: tabletToAssign!.boxNumber,
      assignDate: today,
      status: 'Active',
      remarks: manualTabletMode ? 'Tablet added manually during assignment.' : '',
      assignedBy: 'System Admin',
    };

    const updatedStudents = students.map((student) =>
      student.id === selectedStudent.id
        ? {
            ...student,
            assignedTabletId: tabletToAssign!.id,
            assignedTabletNumber: tabletToAssign!.tabletNumber,
          }
        : student
    );

    onSaveAssignments([newAssignment, ...assignments]);
    onSaveStudents(updatedStudents);
    onSaveTablets(updatedTablets);
    closeAssignModal();
  };

  const handleConfirmReturn = () => {
    if (!returningAssignment) return;

    const updatedAssignments = assignments.map((assignment) =>
      assignment.id === returningAssignment.id
        ? { ...assignment, status: 'Returned' as const, returnDate: today }
        : assignment
    );
    const updatedStudents = students.map((student) =>
      student.id === returningAssignment.studentId
        ? { ...student, assignedTabletId: undefined, assignedTabletNumber: undefined }
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

  const activeStudents = students.filter((student) => student.status === 'Active');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-slate-900">Tablet Assignment</h2>
        <p className="text-sm text-slate-500 mt-1">Assign an available tablet or add a tablet manually.</p>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">Student Name</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">Standard</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">Type</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500">Tablet</th>
                <th className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-slate-500 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeStudents.map((student) => {
                const assignment = activeAssignmentByStudent.get(student.id);
                const tabletNumber = assignment?.tabletNumber || student.assignedTabletNumber;
                return (
                  <tr key={student.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-5 py-4 font-semibold text-slate-900">{student.name}</td>
                    <td className="px-5 py-4 text-sm text-slate-600">{student.standard || '-'}</td>
                    <td className="px-5 py-4"><span className="inline-flex px-2.5 py-1 rounded-full bg-slate-100 text-xs font-medium text-slate-700">{student.isCoachingStudent ? 'Coaching' : 'Non-Coaching'}</span></td>
                    <td className="px-5 py-4">{tabletNumber ? <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600"><TabletIcon className="w-4 h-4" />{tabletNumber}</span> : <span className="text-sm text-slate-400">Not Assigned</span>}</td>
                    <td className="px-5 py-4 text-right">
                      {assignment ? (
                        <button type="button" onClick={() => setReturningAssignment(assignment)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs"><RotateCcw className="w-3.5 h-3.5" />Return Tablet</button>
                      ) : (
                        <button type="button" onClick={() => openAssignModal(student)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs"><UserPlus className="w-3.5 h-3.5" />Assign Tablet</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {activeStudents.length === 0 && <tr><td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400">No active students found.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div><h3 className="text-lg font-bold text-slate-900">Assign Tablet</h3><p className="text-xs text-slate-500 mt-0.5">Select an available tablet or add one manually.</p></div>
              <button type="button" onClick={closeAssignModal} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button>
            </div>

            <form onSubmit={handleConfirmAssign} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Student Name</label>
                <div className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium text-slate-800">{(selectedStudent || preselectedStudentForAssign)?.name || 'Select student'}</div>
              </div>

              {!manualTabletMode ? (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tablet</label>
                  <select value={selectedTabletId} onChange={(event) => setSelectedTabletId(event.target.value)} className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-500" required>
                    <option value="">Select available tablet</option>
                    {availableTablets.map((tablet) => <option key={tablet.id} value={tablet.id}>{tablet.tabletNumber}{tablet.tabletName ? ` - ${tablet.tabletName}` : ''}</option>)}
                  </select>
                  {availableTablets.length === 0 && <p className="text-xs text-slate-500 mt-2">No tablets are currently available.</p>}
                  <button type="button" onClick={() => { setManualTabletMode(true); setSelectedTabletId(''); }} className="mt-3 text-sm font-semibold text-indigo-600 hover:text-indigo-700">+ Add Tablet Manually</button>
                </div>
              ) : (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700">Manual Tablet</label>
                    <button type="button" onClick={() => { setManualTabletMode(false); setManualTabletNumber(''); setManualTabletName(''); }} className="text-xs font-semibold text-indigo-600">Use dropdown instead</button>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tablet Number *</label>
                    <input autoFocus value={manualTabletNumber} onChange={(event) => setManualTabletNumber(event.target.value)} placeholder="e.g. TBL-8001" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-500" required />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">Tablet Name</label>
                    <input value={manualTabletName} onChange={(event) => setManualTabletName(event.target.value)} placeholder="e.g. Samsung Tab 01" className="w-full px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-sm outline-none focus:border-indigo-500" />
                  </div>
                  <p className="text-xs text-slate-500">The tablet will be created as Available inventory and immediately assigned to this student.</p>
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2">
                <button type="button" onClick={closeAssignModal} className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-semibold text-sm hover:bg-slate-50">Cancel</button>
                <button type="submit" disabled={isSaving || (!manualTabletMode && (!selectedTablet || availableTablets.length === 0)) || (manualTabletMode && !manualTabletNumber.trim())} className="px-4 py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold text-sm transition">{isSaving ? 'Assigning...' : 'Assign'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {returningAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl p-5">
            <div className="flex items-start justify-between gap-4"><div><h3 className="text-lg font-bold text-slate-900">Return Tablet?</h3><p className="text-sm text-slate-500 mt-1">Return this tablet to the available list?</p></div><button type="button" onClick={() => setReturningAssignment(null)} className="text-slate-400 hover:text-slate-700"><X className="w-5 h-5" /></button></div>
            <div className="mt-4 rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-500">Student</span><span className="font-semibold text-slate-800">{returningAssignment.studentName}</span></div><div className="flex justify-between gap-3 mt-2"><span className="text-slate-500">Tablet</span><span className="font-semibold text-slate-800">{returningAssignment.tabletNumber}</span></div></div>
            <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setReturningAssignment(null)} className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-700 font-semibold text-sm">Cancel</button><button type="button" onClick={handleConfirmReturn} className="px-4 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-semibold text-sm">Return Tablet</button></div>
          </div>
        </div>
      )}
    </div>
  );
};