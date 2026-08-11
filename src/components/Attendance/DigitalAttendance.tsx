import React, { useState, useMemo, useEffect } from 'react';
import { 
  ClipboardCheck, 
  Calendar, 
  Search, 
  UserCheck, 
  UserX, 
  Clock, 
  Lock, 
  Unlock, 
  Sparkles, 
  QrCode, 
  FileSpreadsheet, 
  FileText, 
  Save, 
  Printer, 
  History, 
  LogIn, 
  LogOut, 
  X, 
  Edit3, 
  Tablet, 
  Users,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  ChevronsRight,
  ChevronsLeft,
  GripVertical,
  CheckSquare,
  Square,
  UserPlus,
  ChevronDown,
  Filter,
  Zap
} from 'lucide-react';
import { Student, DailyAttendanceRecord, AttendanceStatus, UserRole, AttendanceDetail } from '../../types';
import { exportToExcel, exportToPDF, generateDailyAttendancePDF, printDocument } from '../../utils/exportUtils';
import { logAuditAction } from '../../utils/storage';

interface DigitalAttendanceProps {
  students: Student[];
  attendanceRecords: DailyAttendanceRecord[];
  onSaveAttendanceRecords: (records: DailyAttendanceRecord[]) => void;
  activeRole: UserRole;
  onNavigate?: (tab: string) => void;
}

// Helpers for time formatting and duration calculation
function getCurrentTime12h(): string {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
}

function calculateDuration(checkInStr?: string, checkOutStr?: string, dateStr?: string): string {
  if (!checkInStr) return '-';
  try {
    const today = dateStr || new Date().toISOString().slice(0, 10);
    const inDate = new Date(`${today} ${checkInStr}`);
    if (isNaN(inDate.getTime())) return '-';

    let outDate: Date;
    if (checkOutStr) {
      outDate = new Date(`${today} ${checkOutStr}`);
      if (isNaN(outDate.getTime())) return '-';
    } else {
      outDate = new Date();
    }

    let diffMs = outDate.getTime() - inDate.getTime();
    if (diffMs < 0) diffMs = 0;

    const totalMins = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;

    if (hours === 0 && mins === 0) return '< 1m';
    if (hours === 0) return `${mins}m`;
    return `${hours}h ${mins}m`;
  } catch {
    return '-';
  }
}

// Parse time strings like "05:00 PM", "5:00 PM", "17:00" to minutes from midnight
function parseTimeStringToMinutes(timeStr: string): number | null {
  if (!timeStr) return null;
  const cleaned = timeStr.trim().toUpperCase();
  const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/);
  if (!match) return null;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3];

  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}


const RunningDuration = ({ checkInTime, selectedDate }: { checkInTime: string, selectedDate: string }) => {
  const [duration, setDuration] = useState(calculateDuration(checkInTime, undefined, selectedDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setDuration(calculateDuration(checkInTime, undefined, selectedDate));
    }, 60000); // update every minute
    return () => clearInterval(timer);
  }, [checkInTime, selectedDate]);

  return (
    <span className="text-blue-600 animate-pulse flex items-center gap-1.5">
      <Clock className="w-4 h-4"/> {duration}
    </span>
  );
};

export const DigitalAttendance: React.FC<DigitalAttendanceProps> = ({
  students,
  attendanceRecords,
  onSaveAttendanceRecords,
  activeRole,
  onNavigate,
}) => {
  // Selected Date state (defaults to today)
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Filters
  const [selectedStandard, setSelectedStandard] = useState<string>('All');
  const [selectedCoaching, setSelectedCoaching] = useState<string>('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  const [inTimeFilter, setInTimeFilter] = useState<string>('');
  const [outTimeFilter, setOutTimeFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  // PIN / Scanner mode state
  const [pinScanInput, setPinScanInput] = useState('');
  const [scanToast, setScanToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Modal State for Student History
  const [historyStudent, setHistoryStudent] = useState<Student | null>(null);

  // Modal State for Editing Remarks
  const [remarkStudent, setRemarkStudent] = useState<{ id: string; name: string; currentRemark: string } | null>(null);
  const [tempRemark, setTempRemark] = useState('');

  // Bulk Check-Out & Background Scheduler State
  const [isBulkCheckOutModalOpen, setIsBulkCheckOutModalOpen] = useState(false);
  const [bulkCheckOutTime, setBulkCheckOutTime] = useState<string>('04:30 PM');
  const [selectedBulkStudentIds, setSelectedBulkStudentIds] = useState<string[]>([]);
  const [modalSearchQuery, setModalSearchQuery] = useState('');

  // Background Process End-of-Day Scheduler State
  const [autoCheckOutEnabled, setAutoCheckOutEnabled] = useState<boolean>(() => {
    return localStorage.getItem('auto_checkout_enabled') === 'true';
  });
  const [autoCheckOutTime, setAutoCheckOutTime] = useState<string>(() => {
    return localStorage.getItem('auto_checkout_time') || '05:00 PM';
  });
  const [autoCheckOutExecutedForDate, setAutoCheckOutExecutedForDate] = useState<string | null>(null);

  // Selected Student Spotlight State (Requirement 1)
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);

  // Searchable Student Selection Box State (Requirement 2)
  const [searchBoxQuery, setSearchBoxQuery] = useState('');
  const [isSearchDropdownOpen, setIsSearchDropdownOpen] = useState(false);
  
  // Dual Transfer Box State
  const [availableCheckedIds, setAvailableCheckedIds] = useState<string[]>([]);
  const [selectedBoxStudentIds, setSelectedBoxStudentIds] = useState<string[]>([]);
  const [selectedBoxCheckedIds, setSelectedBoxCheckedIds] = useState<string[]>([]);

  // Move checked items from Available (Left Box) to Selected (Right Box)
  const handleMoveToSelected = () => {
    if (availableCheckedIds.length === 0) return;
    const newSelected = Array.from(new Set([...selectedBoxStudentIds, ...availableCheckedIds]));
    setSelectedBoxStudentIds(newSelected);
    setAvailableCheckedIds([]);
  };

  // Move checked items from Selected (Right Box) back to Available
  const handleMoveToAvailable = () => {
    if (selectedBoxCheckedIds.length === 0) return;
    const newSelected = selectedBoxStudentIds.filter(id => !selectedBoxCheckedIds.includes(id));
    setSelectedBoxStudentIds(newSelected);
    setSelectedBoxCheckedIds([]);
  };

  // Move ALL filtered available students to Selected Box
  const handleMoveAllToSelected = () => {
    const availableIds = activeDetails
      .map(d => d.studentId)
      .filter(id => !selectedBoxStudentIds.includes(id));
    const newSelected = Array.from(new Set([...selectedBoxStudentIds, ...availableIds]));
    setSelectedBoxStudentIds(newSelected);
    setAvailableCheckedIds([]);
  };

  // Clear Selected Students Box
  const handleClearSelectedBox = () => {
    setSelectedBoxStudentIds([]);
    setSelectedBoxCheckedIds([]);
  };

  // Toggle single item in available box
  const toggleAvailableCheck = (studentId: string) => {
    setAvailableCheckedIds(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  // Toggle single item in selected box
  const toggleSelectedCheck = (studentId: string) => {
    setSelectedBoxCheckedIds(prev => 
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  // Batch Check-In for Selected Box
  const handleBatchCheckInBox = () => {
    if (selectedBoxStudentIds.length === 0 || currentRecord.isLocked) return;
    const timeNow = getCurrentTime12h();
    const updated = activeDetails.map((d) => {
      if (selectedBoxStudentIds.includes(d.studentId) && d.status !== 'Checked In') {
        return {
          ...d,
          status: 'Checked In' as AttendanceStatus,
          checkInTime: timeNow,
          checkOutTime: undefined,
          totalDuration: calculateDuration(timeNow, undefined, selectedDate),
          markedAt: new Date().toLocaleTimeString(),
        };
      }
      return d;
    });
    setActiveDetails(updated);
    setScanToast({ message: `Batch Checked In ${selectedBoxStudentIds.length} selected students!`, type: 'success' });
    setTimeout(() => setScanToast(null), 3000);
  };

  // Batch Check-Out for Selected Box
  const handleBatchCheckOutBox = () => {
    if (selectedBoxStudentIds.length === 0 || currentRecord.isLocked) return;
    const timeNow = getCurrentTime12h();
    const updated = activeDetails.map((d) => {
      if (selectedBoxStudentIds.includes(d.studentId)) {
        const checkIn = d.checkInTime || '08:00 AM';
        return {
          ...d,
          status: 'Checked Out' as AttendanceStatus,
          checkOutTime: timeNow,
          totalDuration: calculateDuration(checkIn, timeNow, selectedDate),
          markedAt: new Date().toLocaleTimeString(),
        };
      }
      return d;
    });
    setActiveDetails(updated);
    setScanToast({ message: `Batch Checked Out ${selectedBoxStudentIds.length} selected students!`, type: 'success' });
    setTimeout(() => setScanToast(null), 3000);
  };

  // Find or initialize record for selectedDate
  const currentRecord = useMemo(() => {
    return (
      attendanceRecords.find((r) => r.date === selectedDate) || {
        id: `att-${selectedDate}`,
        date: selectedDate,
        isLocked: false,
        submittedBy: 'Pending',
        submittedAt: 'Not submitted',
        details: students.map((s) => ({
          studentId: s.id,
          studentName: s.name,
          pinNumber: s.pinNumber,
          standard: s.standard,
          isCoachingStudent: s.isCoachingStudent,
          assignedTabletNumber: s.assignedTabletNumber,
          status: 'Absent' as AttendanceStatus,
          markedAt: new Date().toLocaleTimeString(),
        })),
      }
    );
  }, [selectedDate, attendanceRecords, students]);

  // Local state for active editing before saving/locking
  const [activeDetails, setActiveDetails] = useState<AttendanceDetail[]>(currentRecord.details);

  // Sync activeDetails when currentRecord changes or new students added
  useEffect(() => {
    const detailsMap = new Map<string, AttendanceDetail>(currentRecord.details.map(d => [d.studentId, d]));
    const validStudents = students
      .filter(s => s.name?.trim() && s.pinNumber?.trim() && s.status === 'Active')
      .filter((s, index, self) => index === self.findIndex((t) => t.id === s.id));
    const mergedDetails: AttendanceDetail[] = validStudents.map(s => {
      const existing = detailsMap.get(s.id);
      if (existing) {
        return {
          studentId: existing.studentId,
          studentName: existing.studentName,
          pinNumber: existing.pinNumber,
          standard: existing.standard,
          isCoachingStudent: s.isCoachingStudent,
          assignedTabletNumber: s.assignedTabletNumber,
          status: existing.status,
          checkInTime: existing.checkInTime,
          checkOutTime: existing.checkOutTime,
          totalDuration: existing.totalDuration,
          remarks: existing.remarks,
          markedAt: existing.markedAt,
        };
      }
      return {
        studentId: s.id,
        studentName: s.name,
        pinNumber: s.pinNumber,
        standard: s.standard,
        isCoachingStudent: s.isCoachingStudent,
        assignedTabletNumber: s.assignedTabletNumber,
        status: 'Absent' as AttendanceStatus,
        markedAt: new Date().toLocaleTimeString(),
      };
    });

    setActiveDetails(mergedDetails);
  }, [currentRecord, students]);

  // Status statistics for this date
  const stats = useMemo(() => {
    let checkedIn = 0, checkedOut = 0, present = 0, absent = 0, late = 0, leave = 0;
    activeDetails.forEach((d) => {
      if (d.status === 'Checked In') checkedIn++;
      else if (d.status === 'Checked Out') checkedOut++;
      else if (d.status === 'Present') present++;
      else if (d.status === 'Absent') absent++;
      else if (d.status === 'Late') late++;
      else if (d.status === 'Leave') leave++;
    });
    const activePresentCount = checkedIn + checkedOut + present + late;
    return {
      checkedIn,
      checkedOut,
      present,
      absent,
      late,
      leave,
      activePresentCount,
      total: activeDetails.length,
    };
  }, [activeDetails]);

  // Filtered list of students in the register
  const filteredDetails = useMemo(() => {
    return activeDetails.filter((d) => {
const query = search?.toLowerCase()?.trim() || '';
      const matchSearch =
        !query ||
        d.studentName?.toLowerCase()?.includes(query) ||
        d.pinNumber?.toLowerCase()?.includes(query) ||
        (d.assignedTabletNumber && d.assignedTabletNumber?.toLowerCase()?.includes(query)) ||
        d.standard?.toLowerCase()?.includes(query) ||
        (d.isCoachingStudent ? 'coaching' : 'regular').includes(query) ||
        ((d as any).mobileNumber && (d as any).mobileNumber?.toLowerCase()?.includes(query)) ||
        d.studentId?.toLowerCase()?.includes(query);

      const matchStd = selectedStandard === 'All' || d.standard === selectedStandard;
      const matchCoaching =
        selectedCoaching === 'All'
          ? true
          : selectedCoaching === 'Yes'
          ? d.isCoachingStudent
          : !d.isCoachingStudent;

      const matchStatus =
        selectedStatusFilter === 'All'
          ? true
          : d.status === selectedStatusFilter;

      const matchInTime = !inTimeFilter || (d.checkInTime && d.checkInTime?.toLowerCase()?.includes(inTimeFilter?.toLowerCase()));
      const matchOutTime = !outTimeFilter || (d.checkOutTime && d.checkOutTime?.toLowerCase()?.includes(outTimeFilter?.toLowerCase()));

      return matchSearch && matchStd && matchCoaching && matchStatus && matchInTime && matchOutTime;
    });
  }, [activeDetails, search, selectedStandard, selectedCoaching, selectedStatusFilter, inTimeFilter, outTimeFilter]);

  // Counts breakdown for Coaching vs Regular toggle
  const coachingCounts = useMemo(() => {
    const baseList = activeDetails.filter((d) => {
      const matchSearch =
        d.studentName?.toLowerCase()?.includes(search?.toLowerCase()) ||
        d.pinNumber?.toLowerCase()?.includes(search?.toLowerCase()) ||
        (d.assignedTabletNumber && d.assignedTabletNumber?.toLowerCase()?.includes(search?.toLowerCase()));
      const matchStd = selectedStandard === 'All' || d.standard === selectedStandard;
      const matchStatus = selectedStatusFilter === 'All' || d.status === selectedStatusFilter;
      return matchSearch && matchStd && matchStatus;
    });

    const coaching = baseList.filter((d) => d.isCoachingStudent).length;
    const regular = baseList.filter((d) => !d.isCoachingStudent).length;
    const total = baseList.length;

    return { total, coaching, regular };
  }, [activeDetails, search, selectedStandard, selectedStatusFilter]);

  // Search dropdown results for PIN/Name quick search box
  const searchDropdownResults = useMemo(() => {
    if (!searchBoxQuery.trim()) return [];
    const query = searchBoxQuery?.toLowerCase().trim();
    const filtered = activeDetails.filter(
      (d) =>
        d.pinNumber?.toLowerCase()?.includes(query) ||
        d.studentName?.toLowerCase()?.includes(query)
    );
    // Prioritize exact or prefix PIN matches
    return filtered.sort((a, b) => {
      const aPin = a.pinNumber?.toLowerCase();
      const bPin = b.pinNumber?.toLowerCase();
      if (aPin === query && bPin !== query) return -1;
      if (bPin === query && aPin !== query) return 1;
      if (aPin.startsWith(query) && !bPin.startsWith(query)) return -1;
      if (bPin.startsWith(query) && !aPin.startsWith(query)) return 1;
      return 0;
    });
  }, [searchBoxQuery, activeDetails]);

  // Spotlight student details
  const selectedStudentDetail = useMemo(() => {
    if (!selectedStudentId) return null;
    return activeDetails.find((d) => d.studentId === selectedStudentId) || null;
  }, [selectedStudentId, activeDetails]);

  // One-click Check-In Handler
  // Bulk Check-In All
  const handleBulkCheckInAll = () => {
    if (currentRecord.isLocked) return;
    const timeNow = getCurrentTime12h();
    const updated = activeDetails.map((d) => ({
      ...d,
      status: 'Checked In' as AttendanceStatus,
      checkInTime: d.checkInTime || timeNow,
      checkOutTime: undefined,
      totalDuration: calculateDuration(d.checkInTime || timeNow, undefined, selectedDate),
    }));
    setActiveDetails(updated);
    setScanToast({ message: 'All students Checked In successfully!', type: 'success' });
    setTimeout(() => setScanToast(null), 3000);
  };

  // Open Bulk Check-Out Modal
  const openBulkCheckOutModal = () => {
    if (currentRecord.isLocked) {
      setScanToast({ message: 'Register is locked against changes.', type: 'error' });
      setTimeout(() => setScanToast(null), 3000);
      return;
    }
    const checkedInStudents = activeDetails.filter((d) => d.status === 'Checked In').map((d) => d.studentId);
    setSelectedBulkStudentIds(checkedInStudents);
    setBulkCheckOutTime(getCurrentTime12h());
    setModalSearchQuery('');
    setIsBulkCheckOutModalOpen(true);
  };

  // Execute Bulk Check-Out with single confirmation
  const executeBulkCheckOut = (targetStudentIds: string[], timeToUse: string, isAutomated: boolean = false) => {
    if (currentRecord.isLocked) return;

    const actualTime = timeToUse || getCurrentTime12h();
    let count = 0;

    const updated = activeDetails.map((d) => {
      if (targetStudentIds.includes(d.studentId) && d.status === 'Checked In') {
        count++;
        const checkIn = d.checkInTime || '08:00 AM';
        return {
          ...d,
          status: 'Checked Out' as AttendanceStatus,
          checkOutTime: actualTime,
          totalDuration: calculateDuration(checkIn, actualTime, selectedDate),
          markedAt: new Date().toLocaleTimeString(),
        };
      }
      return d;
    });

    setActiveDetails(updated);

    // Save updated register automatically
    const updatedRecord: DailyAttendanceRecord = {
      ...currentRecord,
      details: updated,
      submittedBy: isAutomated ? 'System Auto Scheduler' : 'Dr. Rajesh Sharma',
      submittedAt: `${new Date().toISOString().slice(0, 10)} ${new Date().toLocaleTimeString()}`,
    };

    const exists = attendanceRecords.some((r) => r.date === selectedDate);
    const updatedList = exists
      ? attendanceRecords.map((r) => (r.date === selectedDate ? updatedRecord : r))
      : [updatedRecord, ...attendanceRecords];

    onSaveAttendanceRecords(updatedList);

    logAuditAction(
      isAutomated ? 'System Background Scheduler' : 'System User',
      activeRole,

      'BULK_CHECK_OUT',
      'Attendance',
      `${isAutomated ? 'Automated end-of-day background' : 'Bulk'} checked out ${count} students at ${actualTime} for date ${selectedDate}`
    );

    setScanToast({
      message: isAutomated
        ? `⚡ Background Process: Automatically checked out ${count} remaining students at ${actualTime}!`
        : `Successfully Bulk Checked Out ${count} students at ${actualTime}!`,
      type: 'success',
    });
    setTimeout(() => setScanToast(null), 4000);

    if (isAutomated) {
      setAutoCheckOutExecutedForDate(selectedDate);
    }

    setIsBulkCheckOutModalOpen(false);
  };

  // Toggle Background Auto Check-Out
  const handleToggleAutoCheckOut = (enabled: boolean) => {
    setAutoCheckOutEnabled(enabled);
    localStorage.setItem('auto_checkout_enabled', enabled ? 'true' : 'false');
    setScanToast({
      message: enabled
        ? `Background Auto Check-Out Enabled for ${autoCheckOutTime}`
        : 'Background Auto Check-Out Disabled',
      type: 'info',
    });
    setTimeout(() => setScanToast(null), 3000);
  };

  // Change Background Auto Check-Out Time
  const handleChangeAutoCheckOutTime = (time: string) => {
    setAutoCheckOutTime(time);
    localStorage.setItem('auto_checkout_time', time);
  };

  // Background End-of-Day Auto Check-Out Monitor Effect
  useEffect(() => {
    if (!autoCheckOutEnabled || currentRecord.isLocked || selectedDate !== todayStr) return;
    if (autoCheckOutExecutedForDate === selectedDate) return;

    const timer = setInterval(() => {
      const now = new Date();
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      const targetMinutes = parseTimeStringToMinutes(autoCheckOutTime);

      if (targetMinutes !== null && nowMinutes >= targetMinutes) {
        const remainingIn = activeDetails.filter((d) => d.status === 'Checked In').map((d) => d.studentId);
        if (remainingIn.length > 0) {
          executeBulkCheckOut(remainingIn, autoCheckOutTime, true);
        }
      }
    }, 10000);

    return () => clearInterval(timer);
  }, [
    autoCheckOutEnabled,
    autoCheckOutTime,
    currentRecord.isLocked,
    selectedDate,
    todayStr,
    activeDetails,
    autoCheckOutExecutedForDate,
  ]);

  // Mark All Absent
  const handleBulkAbsentAll = () => {
    if (currentRecord.isLocked) return;
    const updated = activeDetails.map((d) => ({
      ...d,
      status: 'Absent' as AttendanceStatus,
      checkInTime: undefined,
      checkOutTime: undefined,
      totalDuration: '-',
    }));
    setActiveDetails(updated);
    setScanToast({ message: 'Marked all students Absent.', type: 'info' });
    setTimeout(() => setScanToast(null), 3000);
  };

  // Save Attendance Register
  const handleSaveAttendance = () => {
    const updatedRecord: DailyAttendanceRecord = {
      ...currentRecord,
      details: activeDetails,
      submittedBy: 'Dr. Rajesh Sharma',
      submittedAt: `${new Date().toISOString().slice(0, 10)} ${new Date().toLocaleTimeString()}`,
    };

    const exists = attendanceRecords.some((r) => r.date === selectedDate);
    const updatedList = exists
      ? attendanceRecords.map((r) => (r.date === selectedDate ? updatedRecord : r))
      : [updatedRecord, ...attendanceRecords];

    onSaveAttendanceRecords(updatedList);
    logAuditAction(
      'System User',
      activeRole,

      'ATTENDANCE_SUBMITTED',
      'Attendance',
      `Saved digital attendance register for ${selectedDate} (${stats.checkedIn} Checked-In, ${stats.checkedOut} Checked-Out, ${stats.absent} Absent)`
    );

    setScanToast({ message: 'Attendance register saved & synced to system storage!', type: 'success' });
    setTimeout(() => setScanToast(null), 3000);
  };

  // Lock / Unlock Attendance
  const handleToggleLock = () => {
    if (activeRole !== 'Super Admin' && activeRole !== 'Admin') {
      alert('Only Admins and Super Admins can lock/unlock attendance records.');
      return;
    }

    const newLockState = !currentRecord.isLocked;
    const updatedRecord: DailyAttendanceRecord = {
      ...currentRecord,
      details: activeDetails,
      isLocked: newLockState,
      lockedAt: newLockState ? new Date().toLocaleString() : undefined,
      lockedBy: newLockState ? 'Dr. Rajesh Sharma' : undefined,
    };

    const updatedList = attendanceRecords.map((r) => (r.date === selectedDate ? updatedRecord : r));
    onSaveAttendanceRecords(updatedList);

    logAuditAction(
      'System User',
      activeRole,

      newLockState ? 'ATTENDANCE_LOCKED' : 'ATTENDANCE_UNLOCKED',
      'Attendance',
      `${newLockState ? 'Locked' : 'Unlocked'} digital attendance register for ${selectedDate}`
    );
  };

  // Fast PIN Scanner Check-In/Out
  const handleScanSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pinScanInput.trim()) return;

    if (currentRecord.isLocked) {
      setScanToast({ message: 'Register is locked.', type: 'error' });
      setTimeout(() => setScanToast(null), 3000);
      return;
    }

    const rawPin = pinScanInput.trim().toUpperCase();
    const pin = rawPin.startsWith('PIN-') ? rawPin : `PIN-${rawPin}`;

    const matched = activeDetails.find((d) => d.pinNumber.toUpperCase() === pin || d.pinNumber.toUpperCase() === rawPin);

    if (matched) {
      if (matched.status === 'Checked In') {
        handleCheckOut(matched.studentId);
      } else {
        handleCheckIn(matched.studentId);
      }
      setPinScanInput('');
    } else {
      setScanToast({ message: `Student PIN "${rawPin}" not found in current roster!`, type: 'error' });
      setTimeout(() => setScanToast(null), 3000);
    }
  };

  // Save Remarks
  const handleSaveRemark = () => {
    if (!remarkStudent) return;
    const updated = activeDetails.map((d) => (d.studentId === remarkStudent.id ? { ...d, remarks: tempRemark } : d));
    setActiveDetails(updated);
    setRemarkStudent(null);
  };

  // Export handlers
  const handleExportExcel = () => {
    const data = filteredDetails.map((d) => ({
      Date: selectedDate,
      'PIN Number': d.pinNumber,
      'Student Name': d.studentName,
      Standard: d.standard,
      'Coaching Batch': d.isCoachingStudent ? 'Yes' : 'No',
      'Assigned Tablet': d.assignedTabletNumber || 'None',
      Status: d.status,
      'Check-In Time': d.checkInTime || '-',
      'Check-Out Time': d.checkOutTime || '-',
      'Total Duration': calculateDuration(d.checkInTime, d.checkOutTime, selectedDate),
      Remarks: d.remarks || '-',
      'Logged At': d.markedAt,
    }));
    exportToExcel(data, `Attendance_Register_${selectedDate}`);
  };

  const handleExportPDF = () => {
    generateDailyAttendancePDF({
      selectedDate,
      selectedStandard,
      students,
      attendanceRecords,
    });
    logAuditAction('System User', activeRole,
 'PDF_EXPORT', 'Attendance', `Exported Daily Attendance PDF Report for ${selectedDate}`);
  };

  // Compute student history across all records
  const studentHistoryList = useMemo(() => {
    if (!historyStudent) return [];
    const list: { date: string; detail: AttendanceDetail }[] = [];

    attendanceRecords.forEach((record) => {
      const match = record.details.find((d) => d.studentId === historyStudent.id);
      if (match) {
        list.push({ date: record.date, detail: match });
      }
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [historyStudent, attendanceRecords]);








  const handleSetStatus = (studentId: string, status: AttendanceStatus) => {
    if (currentRecord.isLocked) return;
    const timeNow = getCurrentTime12h();
    const updated = activeDetails.map((d) => {
      if (d.studentId === studentId) {
        let checkIn = d.checkInTime;
        let checkOut = d.checkOutTime;
        if (status === 'Present' || status === 'Late') {
          if (!checkIn) checkIn = timeNow;
        } else if (status === 'Absent' || status === 'Leave') {
          checkIn = undefined;
          checkOut = undefined;
        }
        return {
          ...d,
          status,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          totalDuration: calculateDuration(checkIn, checkOut, selectedDate),
          markedAt: new Date().toLocaleTimeString(),
        };
      }
      return d;
    });
    setActiveDetails(updated);
  };

  const handleCheckIn = (studentId: string) => {
    if (currentRecord.isLocked) return;
    const timeNow = getCurrentTime12h();
    const updated = activeDetails.map((d) => {
      if (d.studentId === studentId) {
        return {
          ...d,
          status: 'Checked In' as AttendanceStatus,
          checkInTime: timeNow,
          markedAt: new Date().toLocaleTimeString(),
        };
      }
      return d;
    });
    setActiveDetails(updated);
  };

  const handleCheckOut = (studentId: string) => {
    if (currentRecord.isLocked) return;
    const timeNow = getCurrentTime12h();
    const updated = activeDetails.map((d) => {
      if (d.studentId === studentId) {
        return {
          ...d,
          status: 'Checked Out' as AttendanceStatus,
          checkOutTime: timeNow,
          totalDuration: calculateDuration(d.checkInTime, timeNow, selectedDate),
          markedAt: new Date().toLocaleTimeString(),
        };
      }
      return d;
    });
    setActiveDetails(updated);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-28 font-sans text-slate-800 relative min-h-screen">
      
      {/* Header Section */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 shrink-0">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Attendance Register</h1>
            <p className="text-sm font-medium text-slate-500">
              Manage daily attendance, check-ins, and check-outs
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl">
            <Calendar className="w-4 h-4 text-slate-400" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-transparent text-sm font-bold text-slate-700 outline-none cursor-pointer"
            />
          </div>
          <button 
            onClick={() => onNavigate && onNavigate('dashboard')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors border border-slate-200"
          >
            Back to Dashboard
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-sm rounded-xl transition-colors border border-rose-200 flex items-center gap-2"
            >
              PDF
            </button>
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-sm rounded-xl transition-colors border border-emerald-200 flex items-center gap-2"
            >
              Excel
            </button>
          </div>
        </div>
      </div>

      {scanToast && (
        <div className={`p-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm mb-4 ${scanToast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}`}>
          {scanToast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {scanToast.message}
        </div>
      )}
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-sm flex flex-col justify-center">
          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Students</span>
          <span className="text-3xl font-extrabold text-slate-800">{stats.total}</span>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-emerald-100 shadow-sm flex flex-col justify-center">
          <span className="text-emerald-600 text-xs font-bold uppercase tracking-wider mb-1">Present</span>
          <span className="text-3xl font-extrabold text-emerald-600">{stats.present + stats.checkedIn + stats.checkedOut + stats.late}</span>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-rose-100 shadow-sm flex flex-col justify-center">
          <span className="text-rose-600 text-xs font-bold uppercase tracking-wider mb-1">Absent</span>
          <span className="text-3xl font-extrabold text-rose-600">{stats.absent + stats.leave}</span>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-blue-100 shadow-sm flex flex-col justify-center">
          <span className="text-blue-600 text-xs font-bold uppercase tracking-wider mb-1">Currently IN</span>
          <span className="text-3xl font-extrabold text-blue-600">{stats.checkedIn}</span>
        </div>
        <div className="bg-white rounded-2xl p-5 border border-purple-100 shadow-sm flex flex-col justify-center">
          <span className="text-purple-600 text-xs font-bold uppercase tracking-wider mb-1">Checked OUT</span>
          <span className="text-3xl font-extrabold text-purple-600">{stats.checkedOut}</span>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 w-full">
          <Search className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by student name, roll number, or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50 shadow-inner text-slate-700 font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-all placeholder:text-slate-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 bg-slate-200/50 p-1 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex gap-3 w-full md:w-auto overflow-x-auto pb-1 md:pb-0 hide-scrollbar">
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shrink-0">
            <Filter className="w-4 h-4 text-slate-400" />
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="All">All Status</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Checked In">In</option>
              <option value="Checked Out">Out</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shrink-0">
            <select
              value={selectedStandard}
              onChange={(e) => setSelectedStandard(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="All">All Classes</option>
              <option value="Std 8">Std 8</option>
              <option value="Std 9">Std 9</option>
              <option value="Std 10">Std 10</option>
              <option value="Std 11">Std 11</option>
              <option value="Std 12">Std 12</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shrink-0">
            <select
              value={selectedCoaching}
              onChange={(e) => setSelectedCoaching(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="All">All Courses</option>
              <option value="Yes">Coaching</option>
              <option value="No">Regular</option>
            </select>
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shrink-0">
            <Clock className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="In Time (e.g. 09:00)"
              value={inTimeFilter}
              onChange={(e) => setInTimeFilter(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none w-32 placeholder:font-normal"
            />
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shrink-0">
            <Clock className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Out Time (e.g. 05:00)"
              value={outTimeFilter}
              onChange={(e) => setOutTimeFilter(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none w-32 placeholder:font-normal"
            />
          </div>
        </div>
      </div>

      {/* Student List View */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Student</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Roll No. / Class</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tab Use Time</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDetails.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-400">
                    <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-base font-bold text-slate-600">No Data Found</p>
                    <p className="text-sm font-medium mt-1">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : (
                filteredDetails.map((student) => {
                  const isPresent = student.status === 'Present' || student.status === 'Checked In' || student.status === 'Checked Out' || student.status === 'Late';
                  const isAbsent = student.status === 'Absent' || student.status === 'Leave';
                  const isIn = student.status === 'Checked In';
                  const isOut = student.status === 'Checked Out';
                  
                  return (
                    <tr key={student.studentId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 border border-slate-200">
                            <UserCheck className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-800 text-sm">{student.studentName}</div>
                            <div className="text-xs text-slate-500 font-medium">{student.isCoachingStudent ? 'Coaching' : 'Regular'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200 w-fit">
                            {student.pinNumber}
                          </span>
                          <span className="text-xs font-bold text-indigo-600">
                            {student.standard}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {isPresent && !isIn && !isOut && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                            Present
                          </span>
                        )}
                        {isAbsent && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200/60">
                            Absent
                          </span>
                        )}
                        {isIn && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-blue-50 text-blue-700 border border-blue-200/60">
                            In
                          </span>
                        )}
                        {isOut && (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200/60">
                            Out
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            In: <span className="font-mono text-slate-900">{student.checkInTime || '--:--'}</span>
                          </div>
                          <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                            Out: <span className="font-mono text-slate-900">{student.checkOutTime || '--:--'}</span>
                          </div>
                        </div>
                      </td>
                      
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-700">
                          {isIn ? (
                            <RunningDuration checkInTime={student.checkInTime || ''} selectedDate={selectedDate} />
                          ) : isOut ? (
                            student.totalDuration || calculateDuration(student.checkInTime, student.checkOutTime, selectedDate)
                          ) : (
                            '--'
                          )}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleSetStatus(student.studentId, 'Present')}
                            disabled={currentRecord.isLocked}
                            title="Mark Present"
                            className={`p-2 rounded-lg flex items-center justify-center transition-colors ${isPresent && !isIn && !isOut ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600'}`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSetStatus(student.studentId, 'Absent')}
                            disabled={currentRecord.isLocked}
                            title="Mark Absent"
                            className={`p-2 rounded-lg flex items-center justify-center transition-colors ${isAbsent ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600'}`}
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          
                          <div className="w-px h-6 bg-slate-200 mx-1"></div>
                          
                          <button
                            onClick={() => handleCheckIn(student.studentId)}
                            disabled={currentRecord.isLocked || isIn || isOut}
                            title="Check In"
                            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center transition-colors ${isIn ? 'bg-blue-500 text-white shadow-sm ring-2 ring-blue-500 ring-offset-1' : 'bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 disabled:opacity-40'}`}
                          >
                            IN
                          </button>
                          <button
                            onClick={() => handleCheckOut(student.studentId)}
                            disabled={currentRecord.isLocked || !isIn}
                            title="Check Out"
                            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center transition-colors ${isOut ? 'bg-purple-500 text-white shadow-sm ring-2 ring-purple-500 ring-offset-1' : 'bg-slate-100 text-slate-600 hover:bg-purple-100 hover:text-purple-700 disabled:opacity-40'}`}
                          >
                            OUT
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 lg:left-64 md:left-16 bg-white/90 backdrop-blur-md border-t border-slate-200/80 p-4 z-40 shadow-[0_-8px_30px_-15px_rgba(0,0,0,0.1)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <div className="text-sm font-bold text-slate-500 hidden sm:block">
            {stats.total} Total Students • {stats.present + stats.checkedIn + stats.checkedOut + stats.late} Present
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            {onNavigate && (
              <button 
                onClick={() => onNavigate('reports')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 shadow-sm transition-all"
              >
                <FileText className="w-4 h-4" />
                <span>View Reports</span>
              </button>
            )}
            <button 
              onClick={handleSaveAttendance}
              disabled={currentRecord.isLocked}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              Save Attendance
            </button>
          </div>
        </div>
      </div>
      
    </div>
  );
};
