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

export const DigitalAttendance: React.FC<DigitalAttendanceProps> = ({
  students,
  attendanceRecords,
  onSaveAttendanceRecords,
  activeRole,
}) => {
  // Selected Date state (defaults to today)
  const todayStr = new Date().toISOString().slice(0, 10);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);

  // Filters
  const [selectedStandard, setSelectedStandard] = useState<string>('All');
  const [selectedCoaching, setSelectedCoaching] = useState<string>('All');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
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
    const mergedDetails: AttendanceDetail[] = students.map(s => {
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
      const matchSearch =
        d.studentName.toLowerCase().includes(search.toLowerCase()) ||
        d.pinNumber.toLowerCase().includes(search.toLowerCase()) ||
        (d.assignedTabletNumber && d.assignedTabletNumber.toLowerCase().includes(search.toLowerCase()));

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

      return matchSearch && matchStd && matchCoaching && matchStatus;
    });
  }, [activeDetails, search, selectedStandard, selectedCoaching, selectedStatusFilter]);

  // Counts breakdown for Coaching vs Regular toggle
  const coachingCounts = useMemo(() => {
    const baseList = activeDetails.filter((d) => {
      const matchSearch =
        d.studentName.toLowerCase().includes(search.toLowerCase()) ||
        d.pinNumber.toLowerCase().includes(search.toLowerCase()) ||
        (d.assignedTabletNumber && d.assignedTabletNumber.toLowerCase().includes(search.toLowerCase()));
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
    const query = searchBoxQuery.toLowerCase().trim();
    const filtered = activeDetails.filter(
      (d) =>
        d.pinNumber.toLowerCase().includes(query) ||
        d.studentName.toLowerCase().includes(query)
    );
    // Prioritize exact or prefix PIN matches
    return filtered.sort((a, b) => {
      const aPin = a.pinNumber.toLowerCase();
      const bPin = b.pinNumber.toLowerCase();
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
  const handleCheckIn = (studentId: string) => {
    if (currentRecord.isLocked) {
      setScanToast({ message: 'Register is locked against changes.', type: 'error' });
      setTimeout(() => setScanToast(null), 3000);
      return;
    }

    const matched = activeDetails.find((d) => d.studentId === studentId);
    if (!matched) return;

    if (matched.status === 'Checked In') {
      setScanToast({ message: `${matched.studentName} is ALREADY Checked In!`, type: 'info' });
      setTimeout(() => setScanToast(null), 3000);
      return;
    }

    const checkInTime = getCurrentTime12h();
    const updated = activeDetails.map((d) => {
      if (d.studentId === studentId) {
        return {
          ...d,
          status: 'Checked In' as AttendanceStatus,
          checkInTime,
          checkOutTime: undefined,
          totalDuration: calculateDuration(checkInTime, undefined, selectedDate),
          markedAt: new Date().toLocaleTimeString(),
        };
      }
      return d;
    });

    setActiveDetails(updated);
    setScanToast({ message: `Checked In: ${matched.studentName} at ${checkInTime}`, type: 'success' });
    setTimeout(() => setScanToast(null), 3000);
  };

  // One-click Check-Out Handler
  const handleCheckOut = (studentId: string) => {
    if (currentRecord.isLocked) {
      setScanToast({ message: 'Register is locked against changes.', type: 'error' });
      setTimeout(() => setScanToast(null), 3000);
      return;
    }

    const matched = activeDetails.find((d) => d.studentId === studentId);
    if (!matched) return;

    if (matched.status === 'Checked Out') {
      setScanToast({ message: `${matched.studentName} is ALREADY Checked Out!`, type: 'info' });
      setTimeout(() => setScanToast(null), 3000);
      return;
    }

    if (!matched.checkInTime) {
      setScanToast({ message: `Cannot Check-Out: ${matched.studentName} has not Checked In yet!`, type: 'error' });
      setTimeout(() => setScanToast(null), 3000);
      return;
    }

    const checkOutTime = getCurrentTime12h();
    const durationStr = calculateDuration(matched.checkInTime, checkOutTime, selectedDate);

    const updated = activeDetails.map((d) => {
      if (d.studentId === studentId) {
        return {
          ...d,
          status: 'Checked Out' as AttendanceStatus,
          checkOutTime,
          totalDuration: durationStr,
          markedAt: new Date().toLocaleTimeString(),
        };
      }
      return d;
    });

    setActiveDetails(updated);
    setScanToast({ message: `Checked Out: ${matched.studentName} at ${checkOutTime} (Total: ${durationStr})`, type: 'success' });
    setTimeout(() => setScanToast(null), 3000);
  };

  // Set general status (Present, Absent, Late, Leave)
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
    logAuditAction('System User', activeRole, 'PDF_EXPORT', 'Attendance', `Exported Daily Attendance PDF Report for ${selectedDate}`);
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

  return (
    <div className="space-y-6">
      
      {/* Premium Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 md:p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100 shadow-2xs">
              <ClipboardCheck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Digital Attendance & In/Out Register
                </h2>
                {currentRecord.isLocked ? (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                    <Lock className="w-3 h-3 text-rose-600" />
                    Locked Record
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active Register
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Real-time student duration tracking, PIN scan check-in/out, coaching batch filters & report export
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls & Date Picker */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Date Picker Component */}
          <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 shadow-2xs">
            <Calendar className="w-4 h-4 text-indigo-600" />
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="text-xs font-mono font-bold text-slate-800 bg-transparent outline-none cursor-pointer"
            />
          </div>

          {/* Export & Print Button Group */}
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 shadow-2xs">
            <button
              onClick={handleExportExcel}
              className="px-2.5 py-1 rounded-lg hover:bg-white text-emerald-700 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
              title="Export register to Excel"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Excel</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="px-2.5 py-1 rounded-lg hover:bg-white text-rose-700 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
              title="Export register to PDF"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>

            <button
              onClick={() => printDocument()}
              className="px-2.5 py-1 rounded-lg hover:bg-white text-slate-700 font-bold text-xs transition flex items-center gap-1 cursor-pointer"
              title="Print register"
            >
              <Printer className="w-3.5 h-3.5 text-slate-500" />
              <span>Print</span>
            </button>
          </div>

          {/* Lock Register Button */}
          <button
            onClick={handleToggleLock}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              currentRecord.isLocked
                ? 'bg-rose-600 text-white border-rose-700 hover:bg-rose-700'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
            title={currentRecord.isLocked ? 'Click to Unlock Attendance' : 'Lock Attendance Record'}
          >
            {currentRecord.isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5 text-slate-500" />}
            <span>{currentRecord.isLocked ? 'Locked' : 'Lock Register'}</span>
          </button>

          {/* End-of-Day Bulk Check-Out Button */}
          <button
            onClick={openBulkCheckOutModal}
            disabled={currentRecord.isLocked || stats.checkedIn === 0}
            className={`px-3.5 py-2 rounded-xl font-bold text-xs border transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs ${
              stats.checkedIn > 0
                ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-600 shadow-amber-500/20'
                : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
            }`}
            title={
              stats.checkedIn > 0
                ? `Bulk check-out all remaining ${stats.checkedIn} IN students for end-of-day`
                : 'No students currently Checked In'
            }
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Bulk Check-Out ({stats.checkedIn} IN)</span>
          </button>

          {/* Save Primary Button */}
          <button
            onClick={handleSaveAttendance}
            disabled={currentRecord.isLocked}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Save Register</span>
          </button>
        </div>
      </div>

      {/* Statistics Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* Total Roster */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Roster</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {stats.total}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">Enrolled Students</div>
        </div>

        {/* Checked In */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-2xs hover:border-emerald-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">Checked In</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <LogIn className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2 font-mono flex items-center gap-2">
            <span>{stats.checkedIn}</span>
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <div className="text-[11px] text-emerald-600/80 font-medium mt-0.5">Currently On Campus</div>
        </div>

        {/* Checked Out */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-600">Checked Out</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
              <LogOut className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-2 font-mono">
            {stats.checkedOut}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">Departed Campus</div>
        </div>

        {/* Absent */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200/80 shadow-2xs hover:border-rose-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700">Absent</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
              <UserX className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2 font-mono">
            {stats.absent}
          </div>
          <div className="text-[11px] text-rose-600/80 font-medium mt-0.5">Unexcused Absence</div>
        </div>

        {/* Late */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-2xs hover:border-amber-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">Late Arrival</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 mt-2 font-mono">
            {stats.late}
          </div>
          <div className="text-[11px] text-amber-600/80 font-medium mt-0.5">Arrived Post-Bell</div>
        </div>

        {/* Leave */}
        <div className="bg-white p-4 rounded-2xl border border-indigo-200/80 shadow-2xs hover:border-indigo-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-indigo-700">On Leave</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <UserCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-600 mt-2 font-mono">
            {stats.leave}
          </div>
          <div className="text-[11px] text-indigo-600/80 font-medium mt-0.5">Approved Application</div>
        </div>

      </div>

      {/* Fast Check-In / Check-Out PIN Bar */}
      <div className="p-4 rounded-2xl bg-slate-900 text-white shadow-md border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 shrink-0">
            <QrCode className="w-5 h-5" />
          </div>
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-2">
              Fast Student PIN Scanner / Input Bar
            </div>
            <div className="text-xs text-slate-300 mt-0.5">
              Type or scan student PIN (e.g. <strong>1001</strong>). Toggles Check-In or Check-Out automatically!
            </div>
          </div>
        </div>

        <form onSubmit={handleScanSubmit} className="flex items-center gap-2 w-full md:w-auto">
          <input
            type="text"
            value={pinScanInput}
            onChange={(e) => setPinScanInput(e.target.value)}
            disabled={currentRecord.isLocked}
            placeholder="Type PIN (e.g. 1001) & press Enter..."
            className="px-4 py-2 rounded-xl bg-slate-800 text-xs font-mono font-bold text-white placeholder-slate-400 border border-slate-700 outline-none focus:border-indigo-500 w-full md:w-72"
          />
          <button
            type="submit"
            disabled={currentRecord.isLocked}
            className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition shrink-0 cursor-pointer disabled:opacity-40"
          >
            Submit PIN
          </button>
        </form>
      </div>

      {/* Toast Feedback */}
      {scanToast && (
        <div className={`p-3.5 rounded-xl font-bold text-xs flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-200 shadow-xs ${
          scanToast.type === 'success' 
            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' 
            : scanToast.type === 'info'
            ? 'bg-blue-50 text-blue-800 border border-blue-200'
            : 'bg-rose-50 text-rose-800 border border-rose-200'
        }`}>
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <span>{scanToast.message}</span>
        </div>
      )}

      {/* 1. SEARCHABLE STUDENT SELECTION BOX & DUAL TRANSFER BOX (Tablet Optimized) */}
      <div className="p-4 sm:p-6 bg-white rounded-2xl border border-slate-200/90 shadow-xs space-y-5">
        
        {/* Top Header & Tablet-Friendly PIN Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-5 h-5 text-indigo-600 shrink-0" />
              <span>Tablet-Friendly Student Search & Selection</span>
            </h3>
            <p className="text-xs sm:text-sm text-slate-500">
              Type PIN or Name to quickly find students, tap to add to the Selection Box, and manage attendance with finger-friendly controls.
            </p>
          </div>

          {/* Touch-Friendly PIN Search Input with Dropdown */}
          <div className="relative w-full lg:w-96 shrink-0">
            <div className="relative flex items-center">
              <Search className="w-5 h-5 absolute left-3.5 text-indigo-500 pointer-events-none" />
              <input
                type="text"
                inputMode="text"
                value={searchBoxQuery}
                onFocus={() => setIsSearchDropdownOpen(true)}
                onChange={(e) => {
                  setSearchBoxQuery(e.target.value);
                  setIsSearchDropdownOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (searchDropdownResults.length > 0) {
                      const firstMatch = searchDropdownResults[0];
                      setSelectedStudentId(firstMatch.studentId);
                      if (!selectedBoxStudentIds.includes(firstMatch.studentId)) {
                        setSelectedBoxStudentIds((prev) => [...prev, firstMatch.studentId]);
                      }
                      setIsSearchDropdownOpen(false);
                      setSearchBoxQuery('');
                    }
                  } else if (e.key === 'Escape') {
                    setIsSearchDropdownOpen(false);
                  }
                }}
                placeholder="Type Student PIN (e.g. 200) or Name..."
                className="w-full pl-11 pr-11 py-3 bg-slate-50 hover:bg-slate-100/80 focus:bg-white rounded-2xl border-2 border-slate-200 focus:border-indigo-600 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition shadow-xs min-h-[48px]"
              />
              {searchBoxQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchBoxQuery(''); setIsSearchDropdownOpen(false); }}
                  className="absolute right-2 top-1.5 bottom-1.5 px-2.5 flex items-center justify-center text-slate-400 hover:text-slate-700 bg-slate-200/60 hover:bg-slate-200 rounded-xl cursor-pointer transition"
                  title="Clear search"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Searchable Dropdown Results (Tablet Touch Friendly) */}
            {isSearchDropdownOpen && searchBoxQuery.trim().length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl z-40 max-h-72 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                {searchDropdownResults.length === 0 ? (
                  <div className="p-4 text-sm text-slate-500 font-semibold text-center flex items-center justify-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>No student found.</span>
                  </div>
                ) : (
                  searchDropdownResults.map((item) => {
                    const isAlreadyInBox = selectedBoxStudentIds.includes(item.studentId);
                    return (
                      <div
                        key={item.studentId}
                        onClick={() => {
                          setSelectedStudentId(item.studentId);
                          if (!isAlreadyInBox) {
                            setSelectedBoxStudentIds((prev) => [...prev, item.studentId]);
                          }
                          setIsSearchDropdownOpen(false);
                          setSearchBoxQuery('');
                        }}
                        className="p-3.5 hover:bg-indigo-50/90 active:bg-indigo-100 transition cursor-pointer flex items-center justify-between text-sm min-h-[52px]"
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-indigo-700 bg-indigo-100 px-2.5 py-1 rounded-lg border border-indigo-200 text-xs">
                            PIN {item.pinNumber}
                          </span>
                          <span className="font-bold text-slate-900">{item.studentName}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
                            {item.standard}
                          </span>
                          {isAlreadyInBox ? (
                            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                              Selected
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-200 hover:bg-indigo-600 hover:text-white transition">
                              + Select
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>

        {/* Selected Student Spotlight Card (Requirement 1) */}
        {selectedStudentDetail && (
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600 text-white font-bold text-lg flex items-center justify-center shadow-md shadow-indigo-600/20 shrink-0">
                {selectedStudentDetail.studentName.charAt(0)}
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-bold text-slate-900 text-sm">{selectedStudentDetail.studentName}</h4>
                  <span className="px-2 py-0.5 rounded font-mono font-bold text-[11px] bg-indigo-100 text-indigo-700">
                    PIN: {selectedStudentDetail.pinNumber}
                  </span>
                  <span className="text-xs text-slate-600 font-semibold">
                    {selectedStudentDetail.standard}
                  </span>
                  {selectedStudentDetail.assignedTabletNumber && (
                    <span className="text-[11px] font-mono text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                      Tablet #{selectedStudentDetail.assignedTabletNumber}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-3 font-medium">
                  <span>In Time: <strong className="text-emerald-700 font-mono">{selectedStudentDetail.checkInTime || '-'}</strong></span>
                  <span>Out Time: <strong className="text-slate-800 font-mono">{selectedStudentDetail.checkOutTime || '-'}</strong></span>
                  <span>Duration: <strong className="text-indigo-700 font-mono">{calculateDuration(selectedStudentDetail.checkInTime, selectedStudentDetail.checkOutTime, selectedDate)}</strong></span>
                  <span>Status: <strong className="text-slate-900">{selectedStudentDetail.status}</strong></span>
                </div>
              </div>
            </div>

            {/* Quick Single Click IN / OUT Attendance Buttons */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => handleCheckIn(selectedStudentDetail.studentId)}
                disabled={currentRecord.isLocked || selectedStudentDetail.status === 'Checked In'}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Mark IN</span>
              </button>

              <button
                type="button"
                onClick={() => handleCheckOut(selectedStudentDetail.studentId)}
                disabled={currentRecord.isLocked || selectedStudentDetail.status === 'Checked Out' || !selectedStudentDetail.checkInTime}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                <span>Mark OUT</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  const student = students.find(s => s.id === selectedStudentDetail.studentId);
                  if (student) setHistoryStudent(student);
                }}
                className="p-2 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 text-slate-600 transition cursor-pointer"
                title="View Full Attendance History"
              >
                <History className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={() => setSelectedStudentId(null)}
                className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Dual Transfer Box System (Requirement 2) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          
          {/* Left Box: Available Students */}
          <div className="lg:col-span-5 bg-slate-50 rounded-2xl border border-slate-200 p-3.5 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200">
              <span className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-indigo-600" />
                <span>Available Students ({filteredDetails.filter(d => !selectedBoxStudentIds.includes(d.studentId)).length})</span>
              </span>
              <span className="text-[10px] text-slate-400 font-medium">Drag or check to move</span>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {filteredDetails.filter(d => !selectedBoxStudentIds.includes(d.studentId)).length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs">All students added to selection box</div>
              ) : (
                filteredDetails
                  .filter(d => !selectedBoxStudentIds.includes(d.studentId))
                  .map(d => {
                    const isChecked = availableCheckedIds.includes(d.studentId);
                    return (
                      <div
                        key={d.studentId}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData('text/plain', d.studentId)}
                        onClick={() => {
                          toggleAvailableCheck(d.studentId);
                          setSelectedStudentId(d.studentId);
                        }}
                        className={`p-2.5 rounded-xl border transition flex items-center justify-between text-xs cursor-pointer ${
                          isChecked
                            ? 'bg-indigo-50 border-indigo-300 ring-1 ring-indigo-500/20'
                            : 'bg-white border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {}}
                            className="rounded text-indigo-600 cursor-pointer"
                          />
                          <span className="font-mono font-bold text-indigo-600 text-[11px]">{d.pinNumber}</span>
                          <span className="font-bold text-slate-900 truncate max-w-[120px]">{d.studentName}</span>
                        </div>
                        <span className="text-[10px] text-slate-500">{d.standard}</span>
                      </div>
                    );
                  })
              )}
            </div>
          </div>

          {/* Transfer Buttons (Center Controls) */}
          <div className="lg:col-span-2 flex flex-row lg:flex-col items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleMoveToSelected}
              disabled={availableCheckedIds.length === 0}
              className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 text-white font-bold text-xs transition flex items-center justify-center gap-1 shadow-xs cursor-pointer w-full"
              title="Add checked available students to Selected Box"
            >
              <span>Select</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={handleMoveToAvailable}
              disabled={selectedBoxCheckedIds.length === 0}
              className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 disabled:opacity-30 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer w-full"
              title="Remove checked from Selected Box"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Remove</span>
            </button>

            <button
              type="button"
              onClick={handleMoveAllToSelected}
              className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold text-[11px] transition border border-indigo-200 cursor-pointer w-full flex items-center justify-center gap-1"
            >
              <ChevronsRight className="w-3.5 h-3.5" />
              <span>All &gt;&gt;</span>
            </button>

            <button
              type="button"
              onClick={handleClearSelectedBox}
              disabled={selectedBoxStudentIds.length === 0}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 disabled:opacity-30 text-rose-700 font-semibold text-[11px] transition border border-rose-200 cursor-pointer w-full flex items-center justify-center gap-1"
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          </div>

          {/* Right Box: Selected Students */}
          <div 
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData('text/plain');
              if (id && !selectedBoxStudentIds.includes(id)) {
                setSelectedBoxStudentIds(prev => [...prev, id]);
              }
            }}
            className="lg:col-span-5 bg-indigo-50/50 rounded-2xl border border-indigo-200/80 p-3.5 space-y-3"
          >
            <div className="flex items-center justify-between pb-2 border-b border-indigo-200/60">
              <span className="font-bold text-indigo-950 text-xs flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Selected Students Box ({selectedBoxStudentIds.length})</span>
              </span>

              {/* Batch Action Buttons */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleBatchCheckInBox}
                  disabled={selectedBoxStudentIds.length === 0 || currentRecord.isLocked}
                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-30 text-white font-bold text-[10px] transition cursor-pointer"
                  title="Batch Check-In selected box"
                >
                  IN
                </button>
                <button
                  type="button"
                  onClick={handleBatchCheckOutBox}
                  disabled={selectedBoxStudentIds.length === 0 || currentRecord.isLocked}
                  className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-900 disabled:opacity-30 text-white font-bold text-[10px] transition cursor-pointer"
                  title="Batch Check-Out selected box"
                >
                  OUT
                </button>
              </div>
            </div>

            <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
              {selectedBoxStudentIds.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs border-2 border-dashed border-indigo-200/60 rounded-xl">
                  Drag students here or select from available list
                </div>
              ) : (
                selectedBoxStudentIds.map(id => {
                  const d = activeDetails.find(item => item.studentId === id);
                  if (!d) return null;
                  const isChecked = selectedBoxCheckedIds.includes(id);

                  return (
                    <div
                      key={id}
                      onClick={() => {
                        toggleSelectedCheck(id);
                        setSelectedStudentId(id);
                      }}
                      className={`p-3 rounded-2xl border transition flex items-center justify-between text-xs sm:text-sm cursor-pointer min-h-[48px] ${
                        isChecked
                          ? 'bg-indigo-100/90 border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
                          : 'bg-white border-indigo-100/80 hover:border-indigo-300 shadow-2xs'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-indigo-600 cursor-pointer shrink-0"
                        />
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-100 text-xs shrink-0">
                          {d.pinNumber}
                        </span>
                        <div className="min-w-0">
                          <span className="font-bold text-slate-900 block truncate">{d.studentName}</span>
                          <span className="text-[11px] text-slate-500 font-medium block truncate sm:hidden">
                            Std {d.standard}
                          </span>
                        </div>
                        <span className="text-xs text-slate-500 font-medium hidden sm:inline shrink-0">
                          Std {d.standard}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded-lg text-[11px] font-bold ${
                          d.status === 'Checked In'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : d.status === 'Checked Out'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {d.status}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBoxStudentIds(prev => prev.filter(item => item !== id));
                          }}
                          className="w-8 h-8 rounded-xl bg-slate-100 hover:bg-rose-100 text-slate-400 hover:text-rose-700 flex items-center justify-center transition cursor-pointer active:scale-95"
                          title="Remove student from box"
                          aria-label={`Remove ${d.studentName}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Bulk Operations & Search/Filters Section */}
      <div className="p-4 md:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4">
        
        {/* Top Row: Bulk Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-indigo-600" />
            <span>One-Click Bulk Register Actions</span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleBulkCheckInAll}
              disabled={currentRecord.isLocked}
              className="px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <LogIn className="w-3.5 h-3.5 text-emerald-600" />
              <span>Bulk Check-In All</span>
            </button>

            <button
              onClick={openBulkCheckOutModal}
              disabled={currentRecord.isLocked || stats.checkedIn === 0}
              className="px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <LogOut className="w-3.5 h-3.5 text-amber-700" />
              <span>Bulk Check-Out ({stats.checkedIn} IN)</span>
            </button>

            <button
              onClick={handleBulkAbsentAll}
              disabled={currentRecord.isLocked}
              className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-bold transition flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
            >
              <UserX className="w-3.5 h-3.5 text-rose-600" />
              <span>Mark All Absent</span>
            </button>
          </div>
        </div>

        {/* Bottom Row: Search & Filters */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Search Field */}
          <div className="relative w-full lg:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by student, PIN, or tablet..."
              className="w-full pl-9 pr-3.5 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:bg-white transition"
            />
          </div>

          {/* Filters & Coaching Toggle */}
          <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
            
            {/* Coaching vs Regular Segmented Toggle */}
            <div className="inline-flex items-center gap-2">
              <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setSelectedCoaching('All')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedCoaching === 'All'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>All</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      selectedCoaching === 'All'
                        ? 'bg-slate-100 text-slate-800 border border-slate-200'
                        : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {coachingCounts.total}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCoaching('Yes')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedCoaching === 'Yes'
                      ? 'bg-amber-600 text-white shadow-2xs'
                      : 'text-amber-800 hover:bg-amber-100/60'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedCoaching === 'Yes' ? 'bg-amber-200' : 'bg-amber-500'}`} />
                  <span>Coaching</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      selectedCoaching === 'Yes'
                        ? 'bg-amber-700 text-amber-100'
                        : 'bg-amber-200/70 text-amber-900'
                    }`}
                  >
                    {coachingCounts.coaching}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCoaching('No')}
                  className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    selectedCoaching === 'No'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-indigo-800 hover:bg-indigo-100/60'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${selectedCoaching === 'No' ? 'bg-indigo-200' : 'bg-indigo-500'}`} />
                  <span>Regular</span>
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      selectedCoaching === 'No'
                        ? 'bg-indigo-700 text-indigo-100'
                        : 'bg-indigo-200/70 text-indigo-900'
                    }`}
                  >
                    {coachingCounts.regular}
                  </span>
                </button>
              </div>

              {/* Displayed students counter badge */}
              <span className="px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/80 shrink-0 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-600" />
                {filteredDetails.length} {filteredDetails.length === 1 ? 'student' : 'students'}
              </span>
            </div>

            {/* Standard Filter Dropdown */}
            <select
              value={selectedStandard}
              onChange={(e) => setSelectedStandard(e.target.value)}
              className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-600 cursor-pointer"
            >
              <option value="All">All Standards</option>
              <option value="Std 8">Std 8</option>
              <option value="Std 9">Std 9</option>
              <option value="Std 10">Std 10</option>
              <option value="Std 11">Std 11</option>
              <option value="Std 12">Std 12</option>
            </select>

            {/* Status Filter Dropdown */}
            <select
              value={selectedStatusFilter}
              onChange={(e) => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 outline-none focus:border-indigo-600 cursor-pointer"
            >
              <option value="All">Status: All</option>
              <option value="Checked In">Checked In</option>
              <option value="Checked Out">Checked Out</option>
              <option value="Absent">Absent</option>
              <option value="Late">Late</option>
              <option value="Leave">Leave</option>
            </select>

          </div>

        </div>

      </div>

      {/* Main Attendance Table Card */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="py-3.5 px-4">Student & PIN</th>
                <th className="py-3.5 px-3">STD / Batch</th>
                <th className="py-3.5 px-3">Assigned Tablet</th>
                <th className="py-3.5 px-3">Check-In</th>
                <th className="py-3.5 px-3">Check-Out</th>
                <th className="py-3.5 px-3">Duration</th>
                <th className="py-3.5 px-3">Status</th>
                <th className="py-3.5 px-4 text-right">Attendance Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredDetails.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400 font-medium">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-8 h-8 text-slate-300" />
                      <span>No students matching the selected attendance filters.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredDetails.map((student) => {
                  const durationStr = calculateDuration(student.checkInTime, student.checkOutTime, selectedDate);
                  const studentObj = students.find(s => s.id === student.studentId);

                  return (
                    <tr 
                      key={student.studentId}
                      onClick={() => setSelectedStudentId(student.studentId)}
                      className={`transition-colors cursor-pointer ${
                        selectedStudentId === student.studentId 
                          ? 'bg-indigo-50/80 ring-1 ring-indigo-500/30' 
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-indigo-50 font-bold text-xs flex items-center justify-center text-indigo-700 shrink-0 border border-indigo-100">
                            {student.pinNumber.replace('PIN-', '')}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 flex items-center gap-1.5">
                              <span>{student.studentName}</span>
                              <button
                                onClick={() => studentObj && setHistoryStudent(studentObj)}
                                className="p-0.5 text-slate-400 hover:text-indigo-600 transition cursor-pointer"
                                title="View Student Attendance History"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                            </div>
                            <div className="text-[11px] font-mono text-slate-500 font-medium">
                              {student.pinNumber}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* STD & Coaching */}
                      <td className="py-3.5 px-3">
                        <div className="font-semibold text-slate-800">
                          {student.standard}
                        </div>
                        {student.isCoachingStudent ? (
                          <span className="inline-block mt-0.5 px-2 py-0.2 text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200/80 rounded-md">
                            Coaching
                          </span>
                        ) : (
                          <span className="inline-block mt-0.5 text-[10px] text-slate-400 font-medium">Regular</span>
                        )}
                      </td>

                      {/* Tablet */}
                      <td className="py-3.5 px-3">
                        {student.assignedTabletNumber ? (
                          <span className="font-semibold text-indigo-600 flex items-center gap-1">
                            <Tablet className="w-3.5 h-3.5" />
                            {student.assignedTabletNumber}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">Unassigned</span>
                        )}
                      </td>

                      {/* Check-In Time */}
                      <td className="py-3.5 px-3 font-mono font-semibold">
                        {student.checkInTime ? (
                          <span className="text-emerald-700 flex items-center gap-1">
                            <LogIn className="w-3.5 h-3.5 shrink-0" />
                            {student.checkInTime}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Check-Out Time */}
                      <td className="py-3.5 px-3 font-mono font-semibold">
                        {student.checkOutTime ? (
                          <span className="text-slate-700 flex items-center gap-1">
                            <LogOut className="w-3.5 h-3.5 shrink-0" />
                            {student.checkOutTime}
                          </span>
                        ) : (
                          <span className="text-slate-400 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="py-3.5 px-3 font-mono font-bold text-slate-800">
                        {durationStr}
                      </td>

                      {/* Status Badge */}
                      <td className="py-3.5 px-3">
                        {student.status === 'Checked In' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Checked In
                          </span>
                        )}
                        {student.status === 'Checked Out' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            Checked Out
                          </span>
                        )}
                        {student.status === 'Absent' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                            Absent
                          </span>
                        )}
                        {student.status === 'Late' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Late
                          </span>
                        )}
                        {student.status === 'Leave' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            Leave
                          </span>
                        )}
                        {student.status === 'Present' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Present
                          </span>
                        )}
                        {student.remarks && (
                          <div className="text-[10px] text-slate-500 italic truncate max-w-[120px] mt-0.5" title={student.remarks}>
                            "{student.remarks}"
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          
                          {/* One-Click Check-In Button */}
                          <button
                            onClick={() => handleCheckIn(student.studentId)}
                            disabled={currentRecord.isLocked || student.status === 'Checked In'}
                            className={`px-3 py-1 rounded-xl font-bold text-xs transition flex items-center gap-1 cursor-pointer ${
                              student.status === 'Checked In'
                                ? 'bg-emerald-600 text-white cursor-default shadow-2xs'
                                : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200/80'
                            }`}
                            title={student.status === 'Checked In' ? 'Already Checked In' : 'One-click Check-In'}
                          >
                            <LogIn className="w-3.5 h-3.5" />
                            <span>In</span>
                          </button>

                          {/* One-Click Check-Out Button */}
                          <button
                            onClick={() => handleCheckOut(student.studentId)}
                            disabled={currentRecord.isLocked || student.status === 'Checked Out' || !student.checkInTime}
                            className={`px-3 py-1 rounded-xl font-bold text-xs transition flex items-center gap-1 cursor-pointer disabled:opacity-30 ${
                              student.status === 'Checked Out'
                                ? 'bg-slate-800 text-white cursor-default'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/80'
                            }`}
                            title={!student.checkInTime ? 'Must Check-In first' : 'One-click Check-Out'}
                          >
                            <LogOut className="w-3.5 h-3.5" />
                            <span>Out</span>
                          </button>

                          {/* Absent Toggle */}
                          <button
                            onClick={() => handleSetStatus(student.studentId, 'Absent')}
                            disabled={currentRecord.isLocked}
                            className={`p-1.5 rounded-xl transition cursor-pointer border ${
                              student.status === 'Absent'
                                ? 'bg-rose-600 text-white border-rose-700'
                                : 'bg-white text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-slate-200'
                            }`}
                            title="Mark Absent"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>

                          {/* Remarks Edit Button */}
                          <button
                            onClick={() => {
                              setRemarkStudent({ id: student.studentId, name: student.studentName, currentRemark: student.remarks || '' });
                              setTempRemark(student.remarks || '');
                            }}
                            className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 transition cursor-pointer"
                            title="Add/Edit Remarks"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
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

      {/* Student Attendance History Modal */}
      {historyStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <History className="w-4 h-4 text-indigo-600" />
                  Attendance & Duration History: {historyStudent.name}
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  PIN: {historyStudent.pinNumber} • STD {historyStudent.standard}
                </p>
              </div>
              <button
                onClick={() => setHistoryStudent(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 max-h-[60vh] overflow-y-auto space-y-2.5">
              {studentHistoryList.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs">
                  No previous attendance records stored for this student.
                </div>
              ) : (
                studentHistoryList.map(({ date, detail }) => {
                  const duration = calculateDuration(detail.checkInTime, detail.checkOutTime, date);

                  return (
                    <div
                      key={date}
                      className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-bold text-slate-900 font-mono">
                          {date}
                        </div>
                        <div className="text-slate-500 text-[11px] flex items-center gap-3 mt-1">
                          <span>In: <strong>{detail.checkInTime || '-'}</strong></span>
                          <span>Out: <strong>{detail.checkOutOutTime || detail.checkOutTime || '-'}</strong></span>
                          <span>Duration: <strong className="text-indigo-600">{duration}</strong></span>
                        </div>
                        {detail.remarks && (
                          <div className="text-[11px] text-slate-500 italic mt-1">
                            Note: {detail.remarks}
                          </div>
                        )}
                      </div>

                      <div>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                          detail.status === 'Checked In' || detail.status === 'Present'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : detail.status === 'Checked Out'
                            ? 'bg-slate-100 text-slate-700 border border-slate-200'
                            : detail.status === 'Absent'
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : 'bg-amber-50 text-amber-700 border border-amber-200'
                        }`}>
                          {detail.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 text-right">
              <button
                onClick={() => setHistoryStudent(null)}
                className="px-5 py-2 rounded-xl bg-slate-900 text-white font-bold text-xs cursor-pointer hover:bg-slate-800"
              >
                Close History
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Remarks Modal */}
      {remarkStudent && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm">
                Edit Remarks: {remarkStudent.name}
              </h3>
              <button
                onClick={() => setRemarkStudent(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-xl transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-3">
              <label className="block text-xs font-bold text-slate-700">
                Attendance Remarks / Reasons (e.g. "Medical Leave", "Bus Late", "Tablet Repair")
              </label>
              <textarea
                value={tempRemark}
                onChange={(e) => setTempRemark(e.target.value)}
                placeholder="Enter custom remarks..."
                rows={3}
                className="w-full p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:bg-white"
              />
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setRemarkStudent(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveRemark}
                className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold cursor-pointer hover:bg-indigo-700 shadow-md shadow-indigo-600/20"
              >
                Save Remarks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* End-of-Day Bulk Check-Out Modal */}
      {isBulkCheckOutModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full border border-slate-200 shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <LogOut className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-white">End-of-Day Bulk Check-Out</h3>
                    <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500 text-slate-950 font-mono">
                      {selectedBulkStudentIds.length} Students IN
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Mark all remaining 'IN' students as 'OUT' with a single confirmation
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsBulkCheckOutModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
              
              {/* Info Banner */}
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-950 leading-relaxed">
                  <strong>Confirm End-of-Day Departure:</strong> Checking out these students will update their status to <strong>Checked Out</strong>, set their departure time, calculate total campus duration, and save today's register automatically.
                </div>
              </div>

              {/* Check-Out Time Selection */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    <span>Select Departure Time for Bulk Check-Out</span>
                  </label>
                  
                  {/* Quick Presets */}
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBulkCheckOutTime(getCurrentTime12h())}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-100 transition cursor-pointer"
                    >
                      Now ({getCurrentTime12h()})
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkCheckOutTime('04:00 PM')}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-100 transition cursor-pointer"
                    >
                      04:00 PM
                    </button>
                    <button
                      type="button"
                      onClick={() => setBulkCheckOutTime('05:00 PM')}
                      className="px-2.5 py-1 rounded-lg bg-white border border-slate-200 text-slate-700 text-[11px] font-bold hover:bg-slate-100 transition cursor-pointer"
                    >
                      05:00 PM
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={bulkCheckOutTime}
                    onChange={(e) => setBulkCheckOutTime(e.target.value)}
                    placeholder="e.g. 04:30 PM"
                    className="px-3.5 py-2 bg-white rounded-xl border border-slate-300 text-xs font-mono font-bold text-slate-900 outline-none focus:border-indigo-600 w-44"
                  />
                  <span className="text-xs text-slate-500">
                    Departure time applied to selected students.
                  </span>
                </div>
              </div>

              {/* Background Process Scheduler Box */}
              <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-600" />
                    <span className="text-xs font-bold text-indigo-950">Background End-of-Day Auto Check-Out Scheduler</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoCheckOutEnabled}
                      onChange={(e) => handleToggleAutoCheckOut(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                <p className="text-[11px] text-indigo-900/80 leading-relaxed">
                  When enabled, a background process runs at the end of the school day to automatically check out any remaining 'IN' students at the configured target time.
                </p>

                {autoCheckOutEnabled && (
                  <div className="flex items-center gap-3 pt-1 border-t border-indigo-200/60">
                    <span className="text-xs font-semibold text-indigo-950">Daily Target Time:</span>
                    <input
                      type="text"
                      value={autoCheckOutTime}
                      onChange={(e) => handleChangeAutoCheckOutTime(e.target.value)}
                      placeholder="e.g. 05:00 PM"
                      className="px-3 py-1 bg-white rounded-lg border border-indigo-200 text-xs font-mono font-bold text-indigo-950 w-32 outline-none focus:border-indigo-600"
                    />
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Scheduler Active
                    </span>
                  </div>
                )}
              </div>

              {/* Students Table / Preview */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Students Remaining Checked-In ({selectedBulkStudentIds.length} / {activeDetails.filter(d => d.status === 'Checked In').length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const allIn = activeDetails.filter(d => d.status === 'Checked In').map(d => d.studentId);
                        setSelectedBulkStudentIds(allIn);
                      }}
                      className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                    <span className="text-slate-300">•</span>
                    <button
                      type="button"
                      onClick={() => setSelectedBulkStudentIds([])}
                      className="text-[11px] font-bold text-slate-500 hover:underline cursor-pointer"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>

                {/* Modal Search Bar */}
                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    value={modalSearchQuery}
                    onChange={(e) => setModalSearchQuery(e.target.value)}
                    placeholder="Filter remaining students..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 outline-none focus:bg-white"
                  />
                </div>

                {/* Student List Grid */}
                <div className="max-h-52 overflow-y-auto border border-slate-200 rounded-2xl divide-y divide-slate-100 bg-white">
                  {activeDetails.filter(d => d.status === 'Checked In').length === 0 ? (
                    <div className="p-8 text-center text-slate-400 text-xs font-medium">
                      No students are currently Checked In!
                    </div>
                  ) : (
                    activeDetails
                      .filter(d => d.status === 'Checked In')
                      .filter(d => 
                        d.studentName.toLowerCase().includes(modalSearchQuery.toLowerCase()) ||
                        d.pinNumber.toLowerCase().includes(modalSearchQuery.toLowerCase())
                      )
                      .map((d) => {
                        const isSelected = selectedBulkStudentIds.includes(d.studentId);
                        const duration = calculateDuration(d.checkInTime, bulkCheckOutTime, selectedDate);

                        return (
                          <div
                            key={d.studentId}
                            onClick={() => {
                              setSelectedBulkStudentIds(prev => 
                                prev.includes(d.studentId)
                                  ? prev.filter(id => id !== d.studentId)
                                  : [...prev, d.studentId]
                              );
                            }}
                            className={`p-3 flex items-center justify-between text-xs cursor-pointer transition ${
                              isSelected ? 'bg-amber-50/50 hover:bg-amber-50' : 'hover:bg-slate-50 opacity-60'
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="w-4 h-4 rounded text-amber-600 cursor-pointer"
                              />
                              <span className="font-mono font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded text-xs">
                                {d.pinNumber}
                              </span>
                              <div>
                                <span className="font-bold text-slate-900 block">{d.studentName}</span>
                                <span className="text-[10px] text-slate-500">
                                  Std {d.standard} {d.assignedTabletNumber ? `• ${d.assignedTabletNumber}` : ''}
                                </span>
                              </div>
                            </div>

                            <div className="text-right">
                              <div className="text-[11px] font-medium text-slate-600">
                                In: <strong className="text-slate-900 font-mono">{d.checkInTime || '-'}</strong>
                              </div>
                              <div className="text-[10px] text-amber-700 font-bold font-mono">
                                Duration: {duration}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>

            </div>

            {/* Modal Actions Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-600">
                Selected: <strong className="text-slate-900">{selectedBulkStudentIds.length}</strong> students
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsBulkCheckOutModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  onClick={() => executeBulkCheckOut(selectedBulkStudentIds, bulkCheckOutTime, false)}
                  disabled={selectedBulkStudentIds.length === 0}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold text-xs shadow-md shadow-amber-600/20 transition cursor-pointer flex items-center gap-1.5"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Confirm Bulk Check-Out ({selectedBulkStudentIds.length})</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
