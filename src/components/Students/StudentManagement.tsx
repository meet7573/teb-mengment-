import React, { useState, useMemo } from 'react';
import { 
  Users, 
  Search, 
  Plus, 
  FileSpreadsheet, 
  FileText, 
  Edit3, 
  Trash2, 
  Tablet, 
  CheckCircle2, 
  XCircle, 
  X,
  ChevronLeft,
  ChevronRight,
  Check,
  UserCheck,
  Upload,
  Download,
  AlertCircle,
  FileUp,
  ArrowUpDown,
  Sparkles,
  RefreshCw
} from 'lucide-react';
import { Student, StandardGrade, UserRole } from '../../types';
import { exportToExcel, exportToPDF, parseStudentImportFile, downloadStudentImportTemplate } from '../../utils/exportUtils';
import { logAuditAction } from '../../utils/storage';

interface StudentManagementProps {
  students: Student[];
  onSaveStudents: (updated: Student[]) => void;
  activeRole: UserRole;
  onQuickAssignTablet: (student: Student) => void;
}

export const StudentManagement: React.FC<StudentManagementProps> = ({
  students,
  onSaveStudents,
  activeRole,
  onQuickAssignTablet,
}) => {
  const [search, setSearch] = useState('');
  const [selectedStandard, setSelectedStandard] = useState<string>('All');
  const [selectedCoaching, setSelectedCoaching] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'pin-asc' | 'pin-desc' | 'standard'>('name-asc');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 8;

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [deletingStudent, setDeletingStudent] = useState<{ id: string; name: string } | null>(null);
  const [operatorWarning, setOperatorWarning] = useState<string | null>(null);

  // Student Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    total: number;
    addedCount: number;
    skippedCount: number;
    skippedDetails: { pin: string; name: string; reason: string }[];
  } | null>(null);

  // Form state
  const [formData, setFormData] = useState<{
    name: string;
    pinNumber: string;
    standard: StandardGrade;
    isCoachingStudent: boolean;
    status: 'Active' | 'Inactive';
  }>({
    name: '',
    pinNumber: `PIN-${Math.floor(1000 + Math.random() * 9000)}`,
    standard: 'Std 8',
    isCoachingStudent: false,
    status: 'Active',
  });

  // Calculate stats summary
  const studentStats = useMemo(() => {
    const total = students.length;
    const active = students.filter(s => s.status === 'Active').length;
    const inactive = students.filter(s => s.status === 'Inactive').length;
    const coaching = students.filter(s => s.isCoachingStudent).length;
    return { total, active, inactive, coaching };
  }, [students]);

  // Filtered and Sorted students
  const filteredStudents = useMemo(() => {
    let list = students.filter((s) => {
      const matchSearch =
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.pinNumber.toLowerCase().includes(search.toLowerCase());

      const matchStd = selectedStandard === 'All' || s.standard === selectedStandard;
      const matchCoaching =
        selectedCoaching === 'All'
          ? true
          : selectedCoaching === 'Yes'
          ? s.isCoachingStudent
          : !s.isCoachingStudent;

      const matchStatus = selectedStatus === 'All' || s.status === selectedStatus;

      return matchSearch && matchStd && matchCoaching && matchStatus;
    });

    // Sorting
    list = [...list].sort((a, b) => {
      if (sortBy === 'name-asc') return a.name.localeCompare(b.name);
      if (sortBy === 'name-desc') return b.name.localeCompare(a.name);
      if (sortBy === 'pin-asc') return a.pinNumber.localeCompare(b.pinNumber, undefined, { numeric: true });
      if (sortBy === 'pin-desc') return b.pinNumber.localeCompare(a.pinNumber, undefined, { numeric: true });
      if (sortBy === 'standard') return a.standard.localeCompare(b.standard);
      return 0;
    });

    return list;
  }, [students, search, selectedStandard, selectedCoaching, selectedStatus, sortBy]);

  // Paginated list
  const totalPages = Math.ceil(filteredStudents.length / pageSize) || 1;
  const paginatedStudents = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, currentPage]);

  const handleOpenAdd = () => {
    setEditingStudent(null);
    setFormError(null);
    setFormData({
      name: '',
      pinNumber: `PIN-${Math.floor(1000 + Math.random() * 9000)}`,
      standard: 'Std 8',
      isCoachingStudent: false,
      status: 'Active',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setFormError(null);
    setFormData({
      name: student.name,
      pinNumber: student.pinNumber,
      standard: student.standard,
      isCoachingStudent: student.isCoachingStudent,
      status: student.status,
    });
    setIsModalOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const nameClean = formData.name.trim();
    const pinClean = formData.pinNumber.trim().toUpperCase();

    if (!nameClean) {
      setFormError('Please enter a valid student full name.');
      return;
    }

    if (!pinClean) {
      setFormError('Please enter a valid PIN number.');
      return;
    }

    // Format PIN if user entered plain numbers
    const formattedPin = pinClean.startsWith('PIN-') ? pinClean : `PIN-${pinClean}`;

    // PIN Uniqueness Validation
    const isDuplicatePin = students.some(
      (s) => s.pinNumber.toUpperCase() === formattedPin && s.id !== editingStudent?.id
    );

    if (isDuplicatePin) {
      setFormError(`Validation Error: Student PIN "${formattedPin}" is already assigned to another student! PIN numbers must be unique.`);
      return;
    }

    const payload = {
      ...formData,
      name: nameClean,
      pinNumber: formattedPin,
    };

    if (editingStudent) {
      // Edit existing
      const updatedList = students.map((s) =>
        s.id === editingStudent.id
          ? {
              ...s,
              ...payload,
            }
          : s
      );
      onSaveStudents(updatedList);
      logAuditAction('System User', activeRole, 'STUDENT_UPDATED', 'Students', `Updated details for student ${payload.name} (${payload.pinNumber})`);
    } else {
      // Create new
      const newStudent: Student = {
        id: `stu-${Date.now()}`,
        ...payload,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      onSaveStudents([newStudent, ...students]);
      logAuditAction('System User', activeRole, 'STUDENT_CREATED', 'Students', `Added new student ${payload.name} (${payload.pinNumber})`);
    }

    setIsModalOpen(false);
  };

  const handleDelete = (id: string, name: string) => {
    if (activeRole === 'Operator') {
      setOperatorWarning('Operators have view & edit permissions but cannot delete student records.');
      return;
    }
    setDeletingStudent({ id, name });
  };

  const handleConfirmDeleteStudent = () => {
    if (!deletingStudent) return;
    const { id, name } = deletingStudent;
    const updated = students.filter((s) => s.id !== id);
    onSaveStudents(updated);
    logAuditAction('System User', activeRole, 'STUDENT_DELETED', 'Students', `Deleted student record for ${name} (ID: ${id})`);
    setDeletingStudent(null);
  };

  // Student Bulk Import Handler
  const handleProcessImport = async () => {
    if (!importFile) return;
    setIsImporting(true);
    setImportResult(null);

    try {
      const { data, error } = await parseStudentImportFile(importFile);
      if (error || !data || data.length === 0) {
        setImportResult({
          total: 0,
          addedCount: 0,
          skippedCount: 0,
          skippedDetails: [{ pin: 'N/A', name: 'File Error', reason: error || 'File contains no valid data rows or unreadable format.' }],
        });
        setIsImporting(false);
        return;
      }

      const existingPinsSet = new Set(students.map((s) => s.pinNumber.toUpperCase()));
      const filePinsSeen = new Set<string>();

      const newStudentsToInsert: Student[] = [];
      const skippedDetails: { pin: string; name: string; reason: string }[] = [];

      data.forEach((row: any, idx: number) => {
        // Map fields from flexible headers
        const rawPin = String(
          row['Student PIN'] || row['PIN Number'] || row['PIN'] || row['pinNumber'] || row['Pin'] || ''
        ).trim();

        const rawName = String(
          row['Student Name'] || row['Student Full Name'] || row['Name'] || row['name'] || ''
        ).trim();

        const rawStd = String(
          row['Standard'] || row['Class'] || row['std'] || row['standard'] || 'Std 8'
        ).trim();

        const rawCoaching = String(
          row['Coaching Batch'] || row['Coaching Student'] || row['Coaching'] || row['isCoaching'] || ''
        ).trim().toLowerCase();

        const rawStatus = String(
          row['Status'] || row['status'] || 'Active'
        ).trim();

        if (!rawPin || !rawName) {
          skippedDetails.push({
            pin: rawPin || `Row ${idx + 1}`,
            name: rawName || 'Missing Name',
            reason: 'Missing required Student PIN or Name field.',
          });
          return;
        }

        const formattedPin = rawPin.toUpperCase().startsWith('PIN-')
          ? rawPin.toUpperCase()
          : `PIN-${rawPin.toUpperCase()}`;

        // Validate duplicates
        if (existingPinsSet.has(formattedPin)) {
          skippedDetails.push({
            pin: formattedPin,
            name: rawName,
            reason: 'PIN already exists in current student directory.',
          });
          return;
        }

        if (filePinsSeen.has(formattedPin)) {
          skippedDetails.push({
            pin: formattedPin,
            name: rawName,
            reason: 'Duplicate PIN found within the same import file.',
          });
          return;
        }

        filePinsSeen.add(formattedPin);

        // Normalize Standard Grade
        let std: StandardGrade = 'Std 8';
        if (rawStd.includes('9')) std = 'Std 9';
        else if (rawStd.includes('10')) std = 'Std 10';
        else if (rawStd.includes('11')) std = 'Std 11';
        else if (rawStd.includes('12')) std = 'Std 12';

        // Normalize Coaching
        const isCoachingStudent = ['yes', 'true', '1', 'coaching'].includes(rawCoaching);

        // Normalize Status
        const status: 'Active' | 'Inactive' = rawStatus.toLowerCase().includes('inact') ? 'Inactive' : 'Active';

        const newStudent: Student = {
          id: `stu-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          name: rawName,
          pinNumber: formattedPin,
          standard: std,
          isCoachingStudent,
          status,
          createdAt: new Date().toISOString().slice(0, 10),
        };

        newStudentsToInsert.push(newStudent);
      });

      if (newStudentsToInsert.length > 0) {
        onSaveStudents([...newStudentsToInsert, ...students]);
        logAuditAction('System User', activeRole, 'STUDENTS_IMPORTED', 'Students', `Bulk imported ${newStudentsToInsert.length} students from file (${skippedDetails.length} skipped)`);
      }

      setImportResult({
        total: data.length,
        addedCount: newStudentsToInsert.length,
        skippedCount: skippedDetails.length,
        skippedDetails,
      });

    } catch (err: any) {
      setImportResult({
        total: 0,
        addedCount: 0,
        skippedCount: 0,
        skippedDetails: [{ pin: 'N/A', name: 'Error', reason: err?.message || 'Error processing file.' }],
      });
    } finally {
      setIsImporting(false);
    }
  };

  // Export handlers
  const handleExportExcel = () => {
    const data = filteredStudents.map((s) => ({
      'PIN Number': s.pinNumber,
      'Student Full Name': s.name,
      Standard: s.standard,
      'Coaching Batch': s.isCoachingStudent ? 'Yes' : 'No',
      Status: s.status,
      'Assigned Tablet': s.assignedTabletNumber || 'Unassigned',
    }));
    exportToExcel(data, 'Student_Roster');
    logAuditAction('System User', activeRole, 'EXCEL_EXPORT', 'Students', 'Exported student roster to Excel file');
  };

  const handleExportPDF = () => {
    const headers = ['PIN', 'Student Full Name', 'Standard', 'Coaching Batch', 'Assigned Tablet', 'Status'];
    const rows = filteredStudents.map((s) => [
      s.pinNumber,
      s.name,
      s.standard,
      s.isCoachingStudent ? 'Yes' : 'No',
      s.assignedTabletNumber || 'Unassigned',
      s.status,
    ]);
    exportToPDF('Student Roster & Directory', headers, rows, 'Student_Directory');
    logAuditAction('System User', activeRole, 'PDF_EXPORT', 'Students', 'Exported student roster to PDF');
  };

  return (
    <div className="space-y-6 w-full">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-600" />
            Student Directory & Management
          </h2>
          <p className="text-xs text-slate-500 mt-1 font-medium">
            Manage student enrollment, unique PIN validation, bulk imports, coaching tags & tablet assignments
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          
          <button
            onClick={() => {
              setImportFile(null);
              setImportResult(null);
              setIsImportModalOpen(true);
            }}
            className="px-3.5 py-2.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs border border-amber-200/80 transition flex items-center gap-2 cursor-pointer shadow-2xs"
            title="Import students in bulk from Excel (.xlsx) or CSV"
          >
            <FileUp className="w-4 h-4 text-amber-600" />
            <span>Import Students</span>
          </button>

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-xs border border-emerald-200 transition flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={handleExportPDF}
            className="px-3.5 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-xs border border-rose-200 transition flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <FileText className="w-4 h-4" />
            <span>Export PDF</span>
          </button>

          <button
            onClick={handleOpenAdd}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Student</span>
          </button>
        </div>
      </div>

      {/* Metrics Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 bg-white rounded-2xl border border-slate-200/80 shadow-2xs">
          <span className="text-xs font-medium text-slate-500 block">Total Students</span>
          <span className="text-2xl font-black text-slate-900 font-mono mt-1 block">{studentStats.total}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-emerald-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-emerald-700 block">Active Students</span>
          <span className="text-2xl font-black text-emerald-600 font-mono mt-1 block">{studentStats.active}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-amber-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-amber-700 block">Coaching Batch</span>
          <span className="text-2xl font-black text-amber-600 font-mono mt-1 block">{studentStats.coaching}</span>
        </div>
        <div className="p-4 bg-white rounded-2xl border border-rose-200/80 shadow-2xs">
          <span className="text-xs font-semibold text-rose-700 block">Inactive Students</span>
          <span className="text-2xl font-black text-rose-600 font-mono mt-1 block">{studentStats.inactive}</span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        
        {/* Search */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="Search student full name or PIN..."
            className="w-full pl-10 pr-3.5 py-2 bg-white rounded-xl border border-slate-300 text-xs font-medium text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20"
          />
        </div>

        {/* Dropdown Filters & Sorting */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          
          <div className="flex items-center gap-1 text-xs text-slate-500 font-medium">
            <ArrowUpDown className="w-3.5 h-3.5 text-indigo-600" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-600"
            >
              <option value="name-asc">Sort: Name (A-Z)</option>
              <option value="name-desc">Sort: Name (Z-A)</option>
              <option value="pin-asc">Sort: PIN Number (Low-High)</option>
              <option value="pin-desc">Sort: PIN Number (High-Low)</option>
              <option value="standard">Sort: Standard/Class</option>
            </select>
          </div>

          <select
            value={selectedStandard}
            onChange={(e) => { setSelectedStandard(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-600"
          >
            <option value="All">All Standards</option>
            <option value="Std 8">Std 8</option>
            <option value="Std 9">Std 9</option>
            <option value="Std 10">Std 10</option>
            <option value="Std 11">Std 11</option>
            <option value="Std 12">Std 12</option>
          </select>

          <select
            value={selectedCoaching}
            onChange={(e) => { setSelectedCoaching(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-600"
          >
            <option value="All">Coaching: All</option>
            <option value="Yes">Coaching Batch Only</option>
            <option value="No">Regular Batch Only</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 bg-white rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-600"
          >
            <option value="All">Status: All</option>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>

        </div>

      </div>

      {/* Student Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                <th className="py-3.5 px-4">Student Info</th>
                <th className="py-3.5 px-4">PIN Number</th>
                <th className="py-3.5 px-4">Standard</th>
                <th className="py-3.5 px-4">Coaching Batch</th>
                <th className="py-3.5 px-4">Assigned Tablet</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedStudents.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400 font-medium">
                    No student records found matching search filters.
                  </td>
                </tr>
              ) : (
                paginatedStudents.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/80 transition">
                    
                    {/* Student Name */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 font-bold flex items-center justify-center text-xs shrink-0 border border-indigo-100">
                          {s.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 text-sm">{s.name}</div>
                          <div className="text-[11px] text-slate-400">Enrolled Student</div>
                        </div>
                      </div>
                    </td>

                    {/* PIN */}
                    <td className="py-3.5 px-4">
                      <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                        {s.pinNumber}
                      </span>
                    </td>

                    {/* Standard */}
                    <td className="py-3.5 px-4">
                      <span className="font-semibold text-slate-800">
                        {s.standard}
                      </span>
                    </td>

                    {/* Coaching Tag */}
                    <td className="py-3.5 px-4">
                      {s.isCoachingStudent ? (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                          Coaching Student
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-full text-[10px] font-medium bg-slate-100 text-slate-500">
                          Regular Batch
                        </span>
                      )}
                    </td>

                    {/* Assigned Tablet */}
                    <td className="py-3.5 px-4">
                      {s.assignedTabletNumber ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-blue-50 text-blue-700 font-bold border border-blue-200">
                          <Tablet className="w-3.5 h-3.5 text-blue-500" />
                          {s.assignedTabletNumber}
                        </span>
                      ) : (
                        <button
                          onClick={() => onQuickAssignTablet(s)}
                          className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-[11px] font-semibold transition flex items-center gap-1 cursor-pointer border border-slate-200"
                        >
                          <Tablet className="w-3 h-3" />
                          <span>+ Assign Tablet</span>
                        </button>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      {s.status === 'Active' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                          <XCircle className="w-3 h-3 text-rose-500" /> Inactive
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(s)}
                          className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition cursor-pointer"
                          title="Edit Student"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(s.id, s.name)}
                          className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition cursor-pointer"
                          title="Delete Student"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {Math.min(filteredStudents.length, (currentPage - 1) * pageSize + 1)} to{' '}
            {Math.min(filteredStudents.length, currentPage * pageSize)} of {filteredStudents.length} Students
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-2 font-semibold text-slate-700">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-white disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>

      {/* Add / Edit Student Registration Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-600/20">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    {editingStudent ? 'Edit Student Details' : 'Student Registration Form'}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Enter the student details below to update or create a new student record
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Inline Error Toast */}
            {formError && (
              <div className="m-6 mb-0 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center gap-3 text-xs text-rose-800 font-medium">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {/* Form Body */}
            <form onSubmit={handleSaveForm} className="p-6 space-y-6 text-xs">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                
                {/* 1. Student Full Name */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700 text-xs">
                    Student Full Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g. Aarav Mehta"
                    className="w-full h-11 px-3.5 bg-white rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition shadow-2xs"
                  />
                </div>

                {/* 2. PIN Number */}
                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-700 text-xs flex items-center justify-between">
                    <span>PIN Number (Unique) <span className="text-rose-500">*</span></span>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, pinNumber: `PIN-${Math.floor(1000 + Math.random() * 9000)}` })}
                      className="text-[10px] text-indigo-600 font-bold hover:underline cursor-pointer"
                    >
                      Generate New PIN
                    </button>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.pinNumber}
                    onChange={(e) => setFormData({ ...formData, pinNumber: e.target.value })}
                    placeholder="e.g. PIN-1001"
                    className="w-full h-11 px-3.5 bg-white rounded-xl border border-slate-300 text-sm font-mono font-bold text-indigo-600 placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition shadow-2xs"
                  />
                </div>

                {/* 3. Standard Grade */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block font-bold text-slate-700 text-xs">
                    Standard (STD) <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.standard}
                    onChange={(e) => setFormData({ ...formData, standard: e.target.value as StandardGrade })}
                    className="w-full h-11 px-3.5 bg-white rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition shadow-2xs cursor-pointer"
                  >
                    <option value="Std 8">Std 8</option>
                    <option value="Std 9">Std 9</option>
                    <option value="Std 10">Std 10</option>
                    <option value="Std 11">Std 11</option>
                    <option value="Std 12">Std 12</option>
                  </select>
                </div>

                {/* 5. Status */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="block font-bold text-slate-700 text-xs">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
                    className="w-full h-11 px-3.5 bg-white rounded-xl border border-slate-300 text-sm font-semibold text-slate-900 outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-500/20 transition shadow-2xs cursor-pointer"
                  >
                    <option value="Active">Active Student</option>
                    <option value="Inactive">Inactive Student</option>
                  </select>
                </div>

              </div>

              {/* 6. Coaching Student Checkbox */}
              <div 
                onClick={() => setFormData({ ...formData, isCoachingStudent: !formData.isCoachingStudent })}
                className={`p-4 rounded-2xl border transition flex items-center justify-between cursor-pointer select-none ${
                  formData.isCoachingStudent 
                    ? 'bg-amber-50/80 border-amber-300 ring-2 ring-amber-500/20' 
                    : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center border transition ${
                    formData.isCoachingStudent 
                      ? 'bg-amber-500 border-amber-600 text-white shadow-xs' 
                      : 'bg-white border-slate-300'
                  }`}>
                    {formData.isCoachingStudent && <Check className="w-4 h-4 stroke-[3]" />}
                  </div>
                  <div>
                    <div className="font-bold text-slate-900 text-xs">Coaching Student</div>
                    <div className="text-[11px] text-slate-500">Tag student for coaching batch reports and tablet allocations</div>
                  </div>
                </div>

                {formData.isCoachingStudent && (
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500 text-white">
                    Coaching Active
                  </span>
                )}
              </div>

              {/* Form Action Buttons */}
              <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-100 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition cursor-pointer"
                >
                  {editingStudent ? 'Update Student' : 'Register Student'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* Bulk Student Import Modal */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="p-6 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-600 text-white flex items-center justify-center shadow-md shadow-amber-600/20">
                  <FileUp className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">
                    Bulk Student Import (Excel / CSV)
                  </h3>
                  <p className="text-xs text-slate-500">
                    Upload an Excel (.xlsx) or CSV file to import multiple students simultaneously
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 text-xs">
              
              {/* Template Banner */}
              <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-200 flex items-center justify-between">
                <div>
                  <div className="font-bold text-indigo-900 text-xs">Need sample formatting?</div>
                  <div className="text-[11px] text-indigo-700 mt-0.5">Download our pre-formatted Excel template with supported header columns.</div>
                </div>
                <button
                  type="button"
                  onClick={downloadStudentImportTemplate}
                  className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-xs transition flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Template</span>
                </button>
              </div>

              {/* Upload Dropzone */}
              {!importResult && (
                <div className="space-y-3">
                  <label className="block font-bold text-slate-700">Select or Drag Excel / CSV File:</label>
                  <div className="p-8 border-2 border-dashed border-slate-300 hover:border-amber-500 bg-slate-50 hover:bg-amber-50/30 rounded-2xl text-center transition cursor-pointer relative">
                    <input
                      type="file"
                      accept=".xlsx, .xls, .csv"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setImportFile(file);
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                    />
                    <Upload className="w-8 h-8 text-amber-600 mx-auto mb-2" />
                    {importFile ? (
                      <div className="font-bold text-slate-900 text-sm flex items-center justify-center gap-2">
                        <span>Selected File:</span>
                        <span className="text-amber-700 font-mono">{importFile.name}</span>
                        <span className="text-xs text-slate-400 font-normal">({(importFile.size / 1024).toFixed(1)} KB)</span>
                      </div>
                    ) : (
                      <>
                        <div className="font-bold text-slate-800 text-xs">Click or drag & drop .xlsx or .csv file here</div>
                        <div className="text-[11px] text-slate-400 mt-1">Supports fields: Student PIN, Student Name, Standard, Coaching Batch, Status</div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Loading Indicator */}
              {isImporting && (
                <div className="p-6 text-center space-y-2">
                  <RefreshCw className="w-8 h-8 text-amber-600 animate-spin mx-auto" />
                  <div className="font-bold text-slate-800 text-xs">Validating duplicate PINs & processing student records...</div>
                </div>
              )}

              {/* Import Result Summary */}
              {importResult && (
                <div className="space-y-4">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-[11px] text-slate-500 font-medium">Total Rows</div>
                      <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">{importResult.total}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-emerald-600 font-semibold">Imported</div>
                      <div className="text-xl font-bold font-mono text-emerald-600 mt-0.5">{importResult.addedCount}</div>
                    </div>
                    <div>
                      <div className="text-[11px] text-rose-600 font-semibold">Skipped / Duplicates</div>
                      <div className="text-xl font-bold font-mono text-rose-600 mt-0.5">{importResult.skippedCount}</div>
                    </div>
                  </div>

                  {importResult.skippedDetails.length > 0 && (
                    <div className="space-y-2">
                      <div className="font-bold text-slate-800 text-xs">Skipped / Duplicate Breakdown:</div>
                      <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl max-h-40 overflow-y-auto space-y-1.5 text-[11px]">
                        {importResult.skippedDetails.map((item, idx) => (
                          <div key={idx} className="flex items-center justify-between text-rose-900 border-b border-rose-200/60 pb-1 last:border-0 last:pb-0">
                            <div>
                              <strong className="font-mono">{item.pin}</strong> - {item.name}
                            </div>
                            <span className="text-rose-700 font-semibold">{item.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-100 transition cursor-pointer"
                >
                  {importResult ? 'Close' : 'Cancel'}
                </button>
                {!importResult && (
                  <button
                    type="button"
                    disabled={!importFile || isImporting}
                    onClick={handleProcessImport}
                    className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold transition shadow-md shadow-amber-600/20 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>Run Import Validation</span>
                  </button>
                )}
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingStudent && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-slate-900">Confirm Student Deletion</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete student <strong className="text-slate-900">{deletingStudent.name}</strong>? This action will remove the student record and cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setDeletingStudent(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteStudent}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
              >
                Delete Student
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Operator Warning Modal */}
      {operatorWarning && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <AlertCircle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-slate-900">Permission Restricted</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {operatorWarning}
            </p>
            <div className="flex items-center justify-end pt-3 border-t border-slate-100">
              <button
                onClick={() => setOperatorWarning(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white transition cursor-pointer"
              >
                Understand
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
