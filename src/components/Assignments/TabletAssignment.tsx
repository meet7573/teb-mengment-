import React, { useState, useMemo } from 'react';
import { 
  FileCheck, 
  Plus, 
  Search, 
  Tablet as TabletIcon, 
  Users, 
  RotateCcw, 
  Calendar, 
  FileSpreadsheet, 
  FileText, 
  CheckCircle2, 
  X,
  Boxes,
  Camera,
  AlertTriangle,
  Check
} from 'lucide-react';
import { TabletAssignment, Student, Tablet, UserRole } from '../../types';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { logAuditAction } from '../../utils/storage';
import { QRScannerModal } from '../Scanner/QRScannerModal';

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
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'Active' | 'History'>('Active');

  // Modal State
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [returningAssignment, setReturningAssignment] = useState<TabletAssignment | null>(null);

  // Scanner state
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scanNotification, setScanNotification] = useState<string | null>(null);

  const handleScanSuccess = (rawText: string) => {
    const cleanQuery = rawText.replace(/^(QR-|BC-)/i, '').trim().toLowerCase();
    
    // Find matching tablet in inventory
    const matchedTablet = tablets.find((t) => {
      const numClean = t.tabletNumber.toLowerCase();
      const qrClean = t.qrCode.toLowerCase();
      const bcClean = t.barcode.toLowerCase();
      const rawLower = rawText.toLowerCase();

      return (
        numClean === rawLower ||
        qrClean === rawLower ||
        bcClean === rawLower ||
        numClean.includes(cleanQuery) ||
        qrClean.includes(cleanQuery) ||
        bcClean.includes(cleanQuery) ||
        t.id === rawText
      );
    });

    if (!matchedTablet) {
      setScanNotification(`No tablet found matching tag "${rawText}".`);
      setTimeout(() => setScanNotification(null), 5000);
      return;
    }

    logAuditAction('System User', activeRole, 'QR_SCAN_SUCCESS', 'Assignments', `Scanned QR tag for tablet ${matchedTablet.tabletNumber}`);

    // Check if tablet currently has an active assignment
    const activeAssignment = assignments.find(
      (a) => a.tabletId === matchedTablet.id && a.status === 'Active'
    );

    if (activeAssignment) {
      // Trigger Check-In / Return flow for active assignment
      setReturningAssignment(activeAssignment);
      setScanNotification(`Identified active assignment for ${matchedTablet.tabletNumber} assigned to ${activeAssignment.studentName}. Ready for Check-In.`);
      setTimeout(() => setScanNotification(null), 5000);
    } else {
      // Trigger Check-Out / New Assignment flow
      setSelectedTabletId(matchedTablet.id);
      setIsAssignModalOpen(true);
      setScanNotification(`Selected ${matchedTablet.tabletNumber} (${matchedTablet.tabletName}) for check-out assignment.`);
      setTimeout(() => setScanNotification(null), 5000);
    }
  };

  // Form State
  const [selectedStudentId, setSelectedStudentId] = useState<string>('');
  const [selectedTabletId, setSelectedTabletId] = useState<string>('');
  const [assignDate, setAssignDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [remarks, setRemarks] = useState<string>('');

  // Handle pre-selected triggers from Student or Tablet view
  React.useEffect(() => {
    if (preselectedStudentForAssign || preselectedTabletForAssign) {
      if (preselectedStudentForAssign) setSelectedStudentId(preselectedStudentForAssign.id);
      if (preselectedTabletForAssign) setSelectedTabletId(preselectedTabletForAssign.id);
      setIsAssignModalOpen(true);
    }
  }, [preselectedStudentForAssign, preselectedTabletForAssign]);

  // Filtered available choices
  const unassignedStudents = useMemo(() => {
    return students.filter((s) => !s.assignedTabletId && s.status === 'Active');
  }, [students]);

  const availableTablets = useMemo(() => {
    return tablets.filter((t) => t.status === 'Available');
  }, [tablets]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const matchSearch =
        a.studentName.toLowerCase().includes(search.toLowerCase()) ||
        a.pinNumber.toLowerCase().includes(search.toLowerCase()) ||
        a.tabletNumber.toLowerCase().includes(search.toLowerCase()) ||
        a.tabletName.toLowerCase().includes(search.toLowerCase());

      const matchStatus = activeTab === 'Active' ? a.status === 'Active' : true;

      return matchSearch && matchStatus;
    });
  }, [assignments, search, activeTab]);

  const handleOpenAssignModal = () => {
    setSelectedStudentId('');
    setSelectedTabletId('');
    setAssignDate(new Date().toISOString().slice(0, 10));
    setRemarks('');
    setIsAssignModalOpen(true);
  };

  const handleConfirmAssign = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentId || !selectedTabletId) {
      alert('Please select both a student and an available tablet device.');
      return;
    }

    const targetStudent = students.find((s) => s.id === selectedStudentId);
    const targetTablet = tablets.find((t) => t.id === selectedTabletId);

    if (!targetStudent || !targetTablet) return;

    // 1. Create assignment record
    const newAssignment: TabletAssignment = {
      id: `asg-${Date.now()}`,
      studentId: targetStudent.id,
      studentName: targetStudent.name,
      pinNumber: targetStudent.pinNumber,
      standard: targetStudent.standard,
      tabletId: targetTablet.id,
      tabletNumber: targetTablet.tabletNumber,
      tabletName: targetTablet.tabletName,
      boxId: targetTablet.boxId,
      boxNumber: targetTablet.boxNumber,
      assignDate,
      status: 'Active',
      remarks,
      assignedBy: 'System Admin',
    };

    // 2. Update Student with assigned tablet
    const updatedStudents = students.map((s) =>
      s.id === targetStudent.id
        ? {
            ...s,
            assignedTabletId: targetTablet.id,
            assignedTabletNumber: targetTablet.tabletNumber,
          }
        : s
    );

    // 3. Update Tablet with assigned student and status='Assigned'
    const updatedTablets = tablets.map((t) =>
      t.id === targetTablet.id
        ? {
            ...t,
            status: 'Assigned' as const,
            assignedToStudentId: targetStudent.id,
            assignedToStudentName: targetStudent.name,
          }
        : t
    );

    onSaveAssignments([newAssignment, ...assignments]);
    onSaveStudents(updatedStudents);
    onSaveTablets(updatedTablets);

    logAuditAction(
      'System User',
      activeRole,
      'TABLET_ASSIGNED',
      'Assignments',
      `Assigned Tablet ${targetTablet.tabletNumber} (${targetTablet.tabletName}) to student ${targetStudent.name} (${targetStudent.pinNumber})`
    );

    setIsAssignModalOpen(false);
    if (onClearPreselections) onClearPreselections();
  };

  // Confirm Return Tablet
  const handleConfirmReturn = (returnRemarks: string) => {
    if (!returningAssignment) return;

    const returnDate = new Date().toISOString().slice(0, 10);

    // 1. Mark assignment as Returned
    const updatedAssignments = assignments.map((a) =>
      a.id === returningAssignment.id
        ? {
            ...a,
            status: 'Returned' as const,
            returnDate,
            remarks: a.remarks ? `${a.remarks} | Return Note: ${returnRemarks}` : `Returned: ${returnRemarks}`,
          }
        : a
    );

    // 2. Clear student assigned tablet
    const updatedStudents = students.map((s) =>
      s.id === returningAssignment.studentId
        ? {
            ...s,
            assignedTabletId: undefined,
            assignedTabletNumber: undefined,
          }
        : s
    );

    // 3. Set tablet status to Available
    const updatedTablets = tablets.map((t) =>
      t.id === returningAssignment.tabletId
        ? {
            ...t,
            status: 'Available' as const,
            assignedToStudentId: undefined,
            assignedToStudentName: undefined,
          }
        : t
    );

    onSaveAssignments(updatedAssignments);
    onSaveStudents(updatedStudents);
    onSaveTablets(updatedTablets);

    logAuditAction(
      'System User',
      activeRole,
      'TABLET_RETURNED',
      'Assignments',
      `Returned Tablet ${returningAssignment.tabletNumber} from student ${returningAssignment.studentName}`
    );

    setReturningAssignment(null);
  };

  const handleExportExcel = () => {
    const data = filteredAssignments.map((a) => ({
      'PIN Number': a.pinNumber,
      'Student Name': a.studentName,
      Standard: a.standard,
      'Tablet Asset Tag': a.tabletNumber,
      'Tablet Name': a.tabletName,
      'Box Vault': a.boxNumber || 'None',
      'Assign Date': a.assignDate,
      'Return Date': a.returnDate || 'Active',
      Status: a.status,
      Remarks: a.remarks || '',
    }));
    exportToExcel(data, 'Tablet_Assignments');
  };

  const handleExportPDF = () => {
    const headers = ['PIN', 'Student', 'Standard', 'Tablet Tag', 'Box', 'Assign Date', 'Status'];
    const rows = filteredAssignments.map((a) => [
      a.pinNumber,
      a.studentName,
      a.standard,
      a.tabletNumber,
      a.boxNumber || 'Unboxed',
      a.assignDate,
      a.status,
    ]);
    exportToPDF('Tablet Device Allocation Log', headers, rows, 'Tablet_Assignments');
  };

  return (
    <div className="space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-purple-600" />
            Tablet Asset Allocation & Assignments
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Map digital tablets 1-to-1 to students with real-time assignment history and return tracking
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Camera Check-In/Out</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3 py-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 font-semibold text-xs border border-emerald-200 dark:border-emerald-800 transition flex items-center gap-1.5 cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 font-semibold text-xs border border-rose-200 dark:border-rose-800 transition flex items-center gap-1.5 cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>

          <button
            onClick={handleOpenAssignModal}
            className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs shadow-md shadow-purple-600/30 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Assign New Tablet</span>
          </button>
        </div>
      </div>

      {/* Filter and Tab Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        
        {/* Active vs History Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-xl w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('Active')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'Active'
                ? 'bg-white dark:bg-slate-900 text-purple-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Active Allocations ({assignments.filter((a) => a.status === 'Active').length})
          </button>
          <button
            onClick={() => setActiveTab('History')}
            className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              activeTab === 'History'
                ? 'bg-white dark:bg-slate-900 text-purple-600 shadow-xs'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Full Audit History ({assignments.length})
          </button>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search student, PIN, tablet tag..."
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs outline-none focus:border-purple-500"
          />
        </div>

      </div>

      {/* Assignments Table */}
      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden text-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider border-b border-slate-200 dark:border-slate-800">
                <th className="py-3.5 px-4">Student Info</th>
                <th className="py-3.5 px-4">Assigned Tablet</th>
                <th className="py-3.5 px-4">Box Vault</th>
                <th className="py-3.5 px-4">Assign Date</th>
                <th className="py-3.5 px-4">Return Date</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No assignment logs found for this filter view.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/80 transition">
                    
                    {/* Student */}
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900 text-sm">{a.studentName}</div>
                      <div className="text-[11px] font-mono text-indigo-600 font-bold">
                        {a.pinNumber} • {a.standard}
                      </div>
                    </td>

                    {/* Tablet Tag */}
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-indigo-600 flex items-center gap-1.5">
                        <TabletIcon className="w-3.5 h-3.5" />
                        {a.tabletNumber}
                      </div>
                      <div className="text-[11px] text-slate-400">{a.tabletName}</div>
                    </td>

                    {/* Box */}
                    <td className="py-3 px-4">
                      <span className="font-bold text-amber-600 flex items-center gap-1">
                        <Boxes className="w-3.5 h-3.5" />
                        {a.boxNumber || 'Unboxed'}
                      </span>
                    </td>

                    {/* Assign Date */}
                    <td className="py-3 px-4 font-mono text-slate-600">
                      {a.assignDate}
                    </td>

                    {/* Return Date */}
                    <td className="py-3 px-4 font-mono text-slate-500">
                      {a.returnDate || '—'}
                    </td>

                    {/* Status */}
                    <td className="py-3 px-4">
                      {a.status === 'Active' ? (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active Allocation
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
                          Returned
                        </span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      {a.status === 'Active' ? (
                        <button
                          onClick={() => setReturningAssignment(a)}
                          className="px-3 py-1 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-600 font-bold transition flex items-center gap-1 ml-auto cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Return Tablet</span>
                        </button>
                      ) : (
                        <span className="text-slate-400 text-[10px] italic">Completed</span>
                      )}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Assign Tablet Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-xs">
            
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-indigo-600" />
                New Tablet Assignment Mapping
              </h3>
              <button
                onClick={() => { setIsAssignModalOpen(false); if (onClearPreselections) onClearPreselections(); }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleConfirmAssign} className="p-6 space-y-4">
              
              {/* Student Picker */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Student *</label>
                <select
                  required
                  value={selectedStudentId}
                  onChange={(e) => setSelectedStudentId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                >
                  <option value="">-- Choose Student without Tablet --</option>
                  {unassignedStudents.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.pinNumber}) - {s.standard} {s.isCoachingStudent ? '• Coaching' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Tablet Picker */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block font-bold text-slate-700">Select Available Tablet Device *</label>
                  <button
                    type="button"
                    onClick={() => setIsScannerOpen(true)}
                    className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100"
                  >
                    <Camera className="w-3 h-3" />
                    <span>Scan Tag</span>
                  </button>
                </div>
                <select
                  required
                  value={selectedTabletId}
                  onChange={(e) => setSelectedTabletId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-indigo-600 font-medium"
                >
                  <option value="">-- Choose Available Tablet Asset --</option>
                  {availableTablets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.tabletNumber} ({t.tabletName}) - {t.brand} {t.model} • Box: {t.boxNumber || 'Unboxed'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assign Date */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Assign Date *</label>
                <input
                  type="date"
                  required
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 outline-none font-mono focus:border-indigo-600"
                />
              </div>

              {/* Remarks */}
              <div>
                <label className="block font-bold text-slate-700 mb-1">Remarks / Device Condition Notes</label>
                <textarea
                  rows={2}
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Issued with protective cover and stylus..."
                  className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => { setIsAssignModalOpen(false); if (onClearPreselections) onClearPreselections(); }}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition shadow-md shadow-indigo-600/30"
                >
                  Confirm Allocation
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Return Tablet Confirmation Modal */}
      {returningAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 text-xs space-y-4">
            
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-rose-600" />
                Return Tablet {returningAssignment.tabletNumber}
              </h3>
              <button
                onClick={() => setReturningAssignment(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-slate-600">
              Returning tablet from student <strong>{returningAssignment.studentName} ({returningAssignment.pinNumber})</strong>. Device will be marked as <strong>Available</strong> for future assignment.
            </p>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Return Condition Remarks</label>
              <input
                type="text"
                placeholder="e.g. Returned in good condition, battery 90%..."
                id="returnNoteInput"
                className="w-full px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 outline-none focus:border-indigo-600"
              />
            </div>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setReturningAssignment(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const inputVal = (document.getElementById('returnNoteInput') as HTMLInputElement)?.value || 'Normal Return';
                  handleConfirmReturn(inputVal);
                }}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold transition shadow-md shadow-rose-600/30"
              >
                Confirm Tablet Return
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Scan Notification Banner */}
      {scanNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-slate-700 flex items-center gap-3 text-xs font-semibold animate-in slide-in-from-bottom duration-200 max-w-md">
          <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{scanNotification}</span>
          <button onClick={() => setScanNotification(null)} className="ml-2 text-slate-400 hover:text-white shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Camera QR Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
        title="Camera Check-In / Check-Out QR Scanner"
        subtitle="Scan QR label on tablet for instant check-in return or student check-out allocation"
        sampleTablets={tablets}
      />

    </div>
  );
};
