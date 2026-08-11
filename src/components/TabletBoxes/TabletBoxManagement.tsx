import React, { useState, useMemo } from 'react';
import { 
  Boxes, 
  Plus, 
  Search, 
  Tablet as TabletIcon, 
  QrCode, 
  Edit3, 
  Trash2, 
  AlertTriangle, 
  CheckCircle2, 
  X, 
  ArrowRightLeft, 
  Lock, 
  Layers,
  Filter,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Info,
  RefreshCw,
  Printer,
  Eye,
  ShieldAlert,
  MapPin,
  Check,
  UserCheck,
  RotateCcw,
  Sparkles,
  UserPlus,
  AlertCircle
} from 'lucide-react';
import { TabletBox, Tablet, Student, UserRole } from '../../types';
import { validateBoxCapacity, logAuditAction } from '../../utils/storage';
import { QRCodeImage } from '../Scanner/QRCodeImage';

interface TabletBoxManagementProps {
  boxes: TabletBox[];
  tablets: Tablet[];
  students?: Student[];
  onSaveBoxes: (updatedBoxes: TabletBox[]) => void;
  onSaveTablets: (updatedTablets: Tablet[]) => void;
  onSaveStudents?: (updatedStudents: Student[]) => void;
  activeRole: UserRole;
}

export const TabletBoxManagement: React.FC<TabletBoxManagementProps> = ({
  boxes,
  tablets,
  students,
  onSaveBoxes,
  onSaveTablets,
  onSaveStudents,
  activeRole,
}) => {
  // Search, Filter & Pagination State
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Available' | 'Full' | 'Empty'>('All');
  const [locationFilter, setLocationFilter] = useState<string>('All');
  const [sortBy, setSortBy] = useState<'boxNumber-asc' | 'boxNumber-desc' | 'boxName-asc' | 'occupancy-desc' | 'occupancy-asc'>('boxNumber-asc');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 6;

  // Modals & Drawers State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<TabletBox | null>(null);

  const [viewingBoxDetails, setViewingBoxDetails] = useState<TabletBox | null>(null);

  const [assigningBox, setAssigningBox] = useState<TabletBox | null>(null);
  const [selectedStudentIdsToAssign, setSelectedStudentIdsToAssign] = useState<string[]>([]);
  const [assignSearch, setAssignSearch] = useState('');
  const [isAssignSearchDropdownOpen, setIsAssignSearchDropdownOpen] = useState(true);

  const [movingTablet, setMovingTablet] = useState<Tablet | null>(null);
  const [targetBoxIdForMove, setTargetBoxIdForMove] = useState<string>('');

  const [qrBoxModal, setQrBoxModal] = useState<TabletBox | null>(null);

  // Confirmation Modals State
  const [confirmDeleteBox, setConfirmDeleteBox] = useState<{ id: string; boxNumber: string; count: number } | null>(null);
  const [confirmUnassignAll, setConfirmUnassignAll] = useState<TabletBox | null>(null);
  const [confirmUnassignSingle, setConfirmUnassignSingle] = useState<{ tablet: Tablet; boxNumber: string } | null>(null);

  // Toast Feedback State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Capacity validation error state inside modals
  const [capacityError, setCapacityError] = useState<string | null>(null);

  // All students lookup
  const allStudents = useMemo(() => {
    return students;
  }, [students]);

  // Students available for assignment (not assigned to another box)
  const availableStudentsForAssign = useMemo(() => {
    if (!assigningBox) return [];

    return allStudents.filter((student) => {
      if (student.assignedTabletId) {
        const studentTablet = tablets.find((t) => t.id === student.assignedTabletId);
        if (studentTablet && studentTablet.boxId && studentTablet.boxId !== assigningBox.id) {
          // Exclude students whose assigned tablet is in another box
          return false;
        }
      }
      return true;
    });
  }, [allStudents, tablets, assigningBox]);

  // Search dropdown results matching PIN or Name
  const searchDropdownStudents = useMemo(() => {
    if (!assignSearch.trim() || !assigningBox) return [];
    const query = assignSearch?.toLowerCase().trim();

    const filtered = availableStudentsForAssign.filter((student) => {
      // Hide students already in selection box
      if (selectedStudentIdsToAssign.includes(student.id)) return false;

      const rawPin = student.pinNumber?.toLowerCase();
      const cleanPin = rawPin.replace(/^pin-?/, '');
      const nameMatch = student.name?.toLowerCase()?.includes(query);
      const pinMatch = rawPin.includes(query) || cleanPin.includes(query);
      const stdMatch = student.standard?.toLowerCase()?.includes(query);

      return pinMatch || nameMatch || stdMatch;
    });

    return filtered.sort((a, b) => {
      const aPin = a.pinNumber?.toLowerCase().replace(/^pin-?/, '');
      const bPin = b.pinNumber?.toLowerCase().replace(/^pin-?/, '');
      if (aPin === query && bPin !== query) return -1;
      if (bPin === query && aPin !== query) return 1;
      if (aPin.startsWith(query) && !bPin.startsWith(query)) return -1;
      if (bPin.startsWith(query) && !aPin.startsWith(query)) return 1;
      return 0;
    });
  }, [assignSearch, availableStudentsForAssign, selectedStudentIdsToAssign, assigningBox]);

  // Selected students details
  const selectedStudentDetailsToAssign = useMemo(() => {
    return selectedStudentIdsToAssign
      .map((id) => allStudents.find((s) => s.id === id))
      .filter((s): s is Student => Boolean(s));
  }, [selectedStudentIdsToAssign, allStudents]);

  // Form State for Create / Edit Box
  const [formData, setFormData] = useState<{
    boxNumber: string;
    boxName: string;
    location: string;
  }>({
    boxNumber: `BOX-0${boxes.length + 1}`,
    boxName: '',
    location: 'Lab 101 - Cabinet A1',
  });

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // Derive unique locations for location filter dropdown
  const uniqueLocations = useMemo(() => {
    const locs = Array.from(new Set(boxes.map((b) => b.location).filter(Boolean)));
    return locs;
  }, [boxes]);

  // Derive unboxed tablets (tablets currently not in any box)
  const unboxedTablets = useMemo(() => {
    return tablets.filter((t) => !t.boxId);
  }, [tablets]);

  // Overall Statistics KPI calculation
  const stats = useMemo(() => {
    const totalBoxes = boxes.length;
    const totalCapacity = totalBoxes * 7;
    
    // Count total tablets placed in boxes
    let storedTablets = 0;
    let fullBoxes = 0;
    let emptyBoxes = 0;
    let availableBoxes = 0;

    boxes.forEach((b) => {
      const count = tablets.filter((t) => t.boxId === b.id).length;
      storedTablets += count;
      if (count === 7) fullBoxes++;
      else if (count === 0) emptyBoxes++;
      else availableBoxes++;
    });

    const freeSlots = Math.max(0, totalCapacity - storedTablets);
    const occupancyRate = totalCapacity > 0 ? Math.round((storedTablets / totalCapacity) * 100) : 0;

    return {
      totalBoxes,
      totalCapacity,
      storedTablets,
      freeSlots,
      fullBoxes,
      emptyBoxes,
      availableBoxes: availableBoxes + emptyBoxes, // Boxes with space available
      occupancyRate,
    };
  }, [boxes, tablets]);

  // Filtered & Sorted Boxes List
  const filteredAndSortedBoxes = useMemo(() => {
    let result = boxes.map((box) => {
      const boxTablets = tablets.filter((t) => t.boxId === box.id);
      return {
        ...box,
        tablets: boxTablets,
      };
    });

    // Search filter
    if (search.trim()) {
      const query = search?.toLowerCase().trim();
      result = result.filter((b) => {
        const matchMeta =
          b.boxNumber?.toLowerCase()?.includes(query) ||
          b.boxName?.toLowerCase()?.includes(query) ||
          b.location?.toLowerCase()?.includes(query);
        const matchTablet = b.tablets.some(
          (t) =>
            t.tabletNumber?.toLowerCase()?.includes(query) ||
            t.tabletName?.toLowerCase()?.includes(query) ||
            t.model?.toLowerCase()?.includes(query)
        );
        return matchMeta || matchTablet;
      });
    }

    // Status Filter
    if (statusFilter === 'Available') {
      result = result.filter((b) => b.tablets.length < 7);
    } else if (statusFilter === 'Full') {
      result = result.filter((b) => b.tablets.length === 7);
    } else if (statusFilter === 'Empty') {
      result = result.filter((b) => b.tablets.length === 0);
    }

    // Location Filter
    if (locationFilter !== 'All') {
      result = result.filter((b) => b.location === locationFilter);
    }

    // Sorting
    result.sort((a, b) => {
      if (sortBy === 'boxNumber-asc') {
        return a.boxNumber.localeCompare(b.boxNumber, undefined, { numeric: true });
      }
      if (sortBy === 'boxNumber-desc') {
        return b.boxNumber.localeCompare(a.boxNumber, undefined, { numeric: true });
      }
      if (sortBy === 'boxName-asc') {
        return a.boxName.localeCompare(b.boxName);
      }
      if (sortBy === 'occupancy-desc') {
        return b.tablets.length - a.tablets.length;
      }
      if (sortBy === 'occupancy-asc') {
        return a.tablets.length - b.tablets.length;
      }
      return 0;
    });

    return result;
  }, [boxes, tablets, search, statusFilter, locationFilter, sortBy]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredAndSortedBoxes.length / itemsPerPage) || 1;
  const paginatedBoxes = useMemo(() => {
    const startIdx = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedBoxes.slice(startIdx, startIdx + itemsPerPage);
  }, [filteredAndSortedBoxes, currentPage, itemsPerPage]);

  // Reset pagination when search/filter changes
  const handleSearchChange = (val: string) => {
    setSearch(val);
    setCurrentPage(1);
  };

  const handleStatusFilterChange = (val: 'All' | 'Available' | 'Full' | 'Empty') => {
    setStatusFilter(val);
    setCurrentPage(1);
  };

  const handleLocationFilterChange = (val: string) => {
    setLocationFilter(val);
    setCurrentPage(1);
  };

  // Open Create Box Modal
  const handleOpenCreate = () => {
    setEditingBox(null);
    const nextNum = boxes.length + 1;
    setFormData({
      boxNumber: `BOX-${nextNum < 10 ? '0' + nextNum : nextNum}`,
      boxName: `Tablet Storage Vault ${String.fromCharCode(65 + (boxes.length % 26))}`,
      location: 'Lab 101 - Cabinet A1',
    });
    setIsCreateOpen(true);
  };

  // Open Edit Box Modal
  const handleOpenEdit = (box: TabletBox) => {
    setEditingBox(box);
    setFormData({
      boxNumber: box.boxNumber,
      boxName: box.boxName,
      location: box.location,
    });
    setIsCreateOpen(true);
  };

  // Save / Update Box Form Handler
  const handleSaveBoxForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.boxName.trim() || !formData.boxNumber.trim()) return;

    if (editingBox) {
      // Update existing box
      const updatedBoxes = boxes.map((b) =>
        b.id === editingBox.id
          ? {
              ...b,
              ...formData,
              capacity: 7, // Enforced capacity
            }
          : b
      );

      // If boxNumber changed, update all tablets that belong to this box
      let updatedTablets = tablets;
      if (editingBox.boxNumber !== formData.boxNumber) {
        updatedTablets = tablets.map((t) =>
          t.boxId === editingBox.id
            ? {
                ...t,
                boxNumber: formData.boxNumber,
              }
            : t
        );
        onSaveTablets(updatedTablets);
      }

      onSaveBoxes(updatedBoxes);
      logAuditAction(
        'System User',
        activeRole,
        'TABLET_BOX_UPDATED',
        'Tablet Boxes',
        `Updated tablet storage box ${formData.boxNumber} (${formData.boxName})`
      );
      showToast(`Tablet box ${formData.boxNumber} updated successfully!`, 'success');
    } else {
      // Create new box
      const newBox: TabletBox = {
        id: `box-${Date.now()}`,
        ...formData,
        capacity: 7, // Strictly enforced
        qrCode: `QR-${formData.boxNumber}`,
        tablets: [],
        createdAt: new Date().toISOString().slice(0, 10),
      };

      onSaveBoxes([...boxes, newBox]);
      logAuditAction(
        'System User',
        activeRole,
        'TABLET_BOX_CREATED',
        'Tablet Boxes',
        `Created new tablet storage box ${formData.boxNumber} (${formData.boxName}) with strict 7-tablet capacity`
      );
      showToast(`Created new tablet storage box ${formData.boxNumber}!`, 'success');
    }

    setIsCreateOpen(false);
  };

  // Prompt Confirmation before Box Deletion
  const handleDeleteBoxRequest = (box: TabletBox) => {
    if (activeRole === 'Operator') {
      showToast('Operators do not have permission to delete storage boxes.', 'error');
      return;
    }

    const boxTablets = tablets.filter((t) => t.boxId === box.id);
    setConfirmDeleteBox({
      id: box.id,
      boxNumber: box.boxNumber,
      count: boxTablets.length,
    });
  };

  // Confirm Box Deletion
  const handleConfirmDeleteBox = () => {
    if (!confirmDeleteBox) return;

    // First unassign any tablets currently in this box safely
    if (confirmDeleteBox.count > 0) {
      const updatedTablets = tablets.map((t) =>
        t.boxId === confirmDeleteBox.id
          ? {
              ...t,
              boxId: undefined,
              boxNumber: undefined,
            }
          : t
      );
      onSaveTablets(updatedTablets);
    }

    // Remove box from list
    const updatedBoxes = boxes.filter((b) => b.id !== confirmDeleteBox.id);
    onSaveBoxes(updatedBoxes);

    logAuditAction(
      'System User',
      activeRole,
      'TABLET_BOX_DELETED',
      'Tablet Boxes',
      `Deleted storage box ${confirmDeleteBox.boxNumber} and unassigned ${confirmDeleteBox.count} tablets`
    );

    showToast(`Deleted storage box ${confirmDeleteBox.boxNumber}.`, 'info');
    setConfirmDeleteBox(null);
  };

  // Open Assign Modal
  const handleOpenAssignModal = (box: TabletBox) => {
    setAssigningBox(box);
    setSelectedStudentIdsToAssign([]);
    setAssignSearch('');
    setIsAssignSearchDropdownOpen(true);
    setCapacityError(null);
  };

  const handleSelectStudentForBox = (student: Student) => {
    if (!assigningBox) return;
    const currentBoxCount = tablets.filter((t) => t.boxId === assigningBox.id).length;
    const maxAllowed = 7 - currentBoxCount;

    if (selectedStudentIdsToAssign.length >= maxAllowed) {
      setCapacityError(`Cannot select more than ${maxAllowed} student(s). Storage box limit is 7.`);
      return;
    }

    if (!selectedStudentIdsToAssign.includes(student.id)) {
      setSelectedStudentIdsToAssign((prev) => [...prev, student.id]);
    }

    // Clear search field after selection & reset errors
    setAssignSearch('');
    setIsAssignSearchDropdownOpen(false);
    setCapacityError(null);
  };

  const handleRemoveStudentFromSelectedBox = (studentId: string) => {
    setSelectedStudentIdsToAssign((prev) => prev.filter((id) => id !== studentId));
    setCapacityError(null);
  };

  // Confirm Student/Tablet Assignment
  const handleConfirmAssignTablets = () => {
    if (!assigningBox || selectedStudentIdsToAssign.length === 0) return;

    const currentBoxTablets = tablets.filter((t) => t.boxId === assigningBox.id);
    const maxAllowed = 7 - currentBoxTablets.length;

    if (selectedStudentIdsToAssign.length > maxAllowed) {
      setCapacityError(`Cannot assign more than ${maxAllowed} student(s). Storage box limit is 7.`);
      return;
    }

    let updatedTablets = [...tablets];
    let updatedStudents = [...allStudents];
    let unboxedTabletsList = updatedTablets.filter((t) => !t.boxId);

    selectedStudentIdsToAssign.forEach((studentId) => {
      const studentIdx = updatedStudents.findIndex((s) => s.id === studentId);
      if (studentIdx === -1) return;
      const student = updatedStudents[studentIdx];

      let tabletToAssignId = student.assignedTabletId;
      let tabletIdx = tabletToAssignId
        ? updatedTablets.findIndex((t) => t.id === tabletToAssignId)
        : -1;

      if (tabletIdx !== -1) {
        updatedTablets[tabletIdx] = {
          ...updatedTablets[tabletIdx],
          boxId: assigningBox.id,
          boxNumber: assigningBox.boxNumber,
          assignedToStudentId: student.id,
          assignedToStudentName: student.name,
        };
      } else {
        // Pick an unboxed tablet
        const freeTablet = unboxedTabletsList.find((t) => !t.boxId);
        if (freeTablet) {
          const freeIdx = updatedTablets.findIndex((t) => t.id === freeTablet.id);
          if (freeIdx !== -1) {
            updatedTablets[freeIdx] = {
              ...updatedTablets[freeIdx],
              boxId: assigningBox.id,
              boxNumber: assigningBox.boxNumber,
              assignedToStudentId: student.id,
              assignedToStudentName: student.name,
              status: 'Assigned',
            };
            updatedStudents[studentIdx] = {
              ...updatedStudents[studentIdx],
              assignedTabletId: freeTablet.id,
              assignedTabletNumber: freeTablet.tabletNumber,
            };
            unboxedTabletsList = unboxedTabletsList.filter((t) => t.id !== freeTablet.id);
          }
        } else {
          const newTabletId = `tab-auto-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          const nextTabletNum = `TBL-${8000 + updatedTablets.length + 1}`;
          const newTablet: Tablet = {
            id: newTabletId,
            tabletName: `Tablet ${student.name.split(' ')[0]}`,
            tabletNumber: nextTabletNum,
            qrCode: `QR-${nextTabletNum}`,
            barcode: `BC-${nextTabletNum}`,
            brand: 'Samsung',
            model: 'Galaxy Tab A9',
            entryDate: new Date().toISOString().slice(0, 10),
            status: 'Assigned',
            boxId: assigningBox.id,
            boxNumber: assigningBox.boxNumber,
            assignedToStudentId: student.id,
            assignedToStudentName: student.name,
          };
          updatedTablets.push(newTablet);
          updatedStudents[studentIdx] = {
            ...updatedStudents[studentIdx],
            assignedTabletId: newTablet.id,
            assignedTabletNumber: newTablet.tabletNumber,
          };
        }
      }
    });

    onSaveTablets(updatedTablets);
    if (onSaveStudents) {
      onSaveStudents(updatedStudents);
    } else {
      if (onSaveStudents) onSaveStudents(updatedStudents);
    }

    logAuditAction(
      'System User',
      activeRole,
      'STUDENTS_ASSIGNED_TO_BOX',
      'Tablet Boxes',
      `Assigned ${selectedStudentIdsToAssign.length} student(s) to Box ${assigningBox.boxNumber}`
    );

    showToast(
      `Successfully assigned ${selectedStudentIdsToAssign.length} student(s) to ${assigningBox.boxNumber}!`,
      'success'
    );

    setAssigningBox(null);
    setSelectedStudentIdsToAssign([]);
    setCapacityError(null);
    setAssignSearch('');
  };

  // Confirm Single Tablet Unassignment from Box Slot
  const handleConfirmUnassignSingle = () => {
    if (!confirmUnassignSingle) return;

    const { tablet, boxNumber } = confirmUnassignSingle;

    const updatedTablets = tablets.map((t) =>
      t.id === tablet.id
        ? {
            ...t,
            boxId: undefined,
            boxNumber: undefined,
          }
        : t
    );

    onSaveTablets(updatedTablets);
    logAuditAction(
      'System User',
      activeRole,
      'TABLET_REMOVED_FROM_BOX',
      'Tablet Boxes',
      `Removed tablet ${tablet.tabletNumber} from Box ${boxNumber}`
    );

    showToast(`Removed ${tablet.tabletNumber} from ${boxNumber}.`, 'info');
    setConfirmUnassignSingle(null);
  };

  // Confirm Unassign All Tablets from a Box
  const handleConfirmUnassignAll = () => {
    if (!confirmUnassignAll) return;

    const boxId = confirmUnassignAll.id;
    const boxNumber = confirmUnassignAll.boxNumber;

    const updatedTablets = tablets.map((t) =>
      t.boxId === boxId
        ? {
            ...t,
            boxId: undefined,
            boxNumber: undefined,
          }
        : t
    );

    onSaveTablets(updatedTablets);
    logAuditAction(
      'System User',
      activeRole,
      'ALL_TABLETS_REMOVED_FROM_BOX',
      'Tablet Boxes',
      `Unassigned all tablets from Box ${boxNumber}`
    );

    showToast(`Cleared all tablets from Box ${boxNumber}.`, 'info');
    setConfirmUnassignAll(null);
  };

  // Confirm Move Tablet Between Boxes
  const handleConfirmMoveTablet = () => {
    if (!movingTablet || !targetBoxIdForMove) return;

    // Check target box capacity
    const validation = validateBoxCapacity(tablets, targetBoxIdForMove, 1);
    if (!validation.valid) {
      setCapacityError(validation.message);
      return;
    }

    const targetBox = boxes.find((b) => b.id === targetBoxIdForMove);
    const updatedTablets = tablets.map((t) =>
      t.id === movingTablet.id
        ? {
            ...t,
            boxId: targetBox?.id,
            boxNumber: targetBox?.boxNumber,
          }
        : t
    );

    onSaveTablets(updatedTablets);
    logAuditAction(
      'System User',
      activeRole,
      'TABLET_MOVED_BETWEEN_BOXES',
      'Tablet Boxes',
      `Moved tablet ${movingTablet.tabletNumber} to Box ${targetBox?.boxNumber}`
    );

    showToast(
      `Transferred tablet ${movingTablet.tabletNumber} to Box ${targetBox?.boxNumber}!`,
      'success'
    );

    setMovingTablet(null);
    setTargetBoxIdForMove('');
    setCapacityError(null);
  };

  // Filtered list of unboxed tablets for Assign Modal
  const filteredUnboxedTablets = useMemo(() => {
    if (!assignSearch.trim()) return unboxedTablets;
    const q = assignSearch?.toLowerCase().trim();
    return unboxedTablets.filter(
      (t) =>
        t.tabletNumber?.toLowerCase()?.includes(q) ||
        t.tabletName?.toLowerCase()?.includes(q) ||
        t.brand?.toLowerCase()?.includes(q) ||
        t.model?.toLowerCase()?.includes(q)
    );
  }, [unboxedTablets, assignSearch]);

  return (
    <div className="space-y-6">
      
      {/* Toast Feedback Notification */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 p-4 rounded-2xl shadow-xl border flex items-center gap-3 animate-in fade-in slide-in-from-top-4 duration-200 text-xs font-bold ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-50 text-rose-900 border-rose-200'
              : 'bg-indigo-50 text-indigo-900 border-indigo-200'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
          <span>{toast.message}</span>
        </div>
      )}

      {/* Modern Enterprise Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-5 md:p-6 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100 shadow-2xs">
              <Boxes className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-slate-900 tracking-tight">
                  Tablet Box Storage Management
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-600" />
                  Strict 7-Slot Limit
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Physical vault storage tracking, capacity occupancy gauges, device slot allocation & QR code tags
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Box</span>
          </button>
        </div>
      </div>

      {/* Dashboard KPI Summary Cards (6-Card Grid) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        
        {/* Total Storage Boxes */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Boxes</span>
            <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-100">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 mt-2 font-mono">
            {stats.totalBoxes}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">Configured Vaults</div>
        </div>

        {/* Total Vault Capacity */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Total Capacity</span>
            <div className="p-1.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Layers className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-indigo-700 mt-2 font-mono">
            {stats.totalCapacity}
          </div>
          <div className="text-[11px] text-indigo-600/80 font-medium mt-0.5">Slots (7 per Box)</div>
        </div>

        {/* Stored Tablets */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-2xs hover:border-emerald-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">Stored Devices</span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-100">
              <TabletIcon className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 mt-2 font-mono flex items-center gap-2">
            <span>{stats.storedTablets}</span>
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
              {stats.occupancyRate}%
            </span>
          </div>
          <div className="text-[11px] text-emerald-600/80 font-medium mt-0.5">Tablets in Boxes</div>
        </div>

        {/* Free Available Slots */}
        <div className="bg-white p-4 rounded-2xl border border-blue-200/80 shadow-2xs hover:border-blue-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-blue-700">Available Slots</span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 mt-2 font-mono">
            {stats.freeSlots}
          </div>
          <div className="text-[11px] text-blue-600/80 font-medium mt-0.5">Empty Spaces</div>
        </div>

        {/* Full Vaults */}
        <div className="bg-white p-4 rounded-2xl border border-rose-200/80 shadow-2xs hover:border-rose-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700">Full Boxes</span>
            <div className="p-1.5 rounded-lg bg-rose-50 text-rose-600 border border-rose-100">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 mt-2 font-mono">
            {stats.fullBoxes}
          </div>
          <div className="text-[11px] text-rose-600/80 font-medium mt-0.5">7/7 Capacity Filled</div>
        </div>

        {/* Unboxed Tablets Counter */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">Unboxed Devices</span>
            <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
              <TabletIcon className="w-4 h-4 text-slate-400" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-800 mt-2 font-mono">
            {unboxedTablets.length}
          </div>
          <div className="text-[11px] text-slate-400 font-medium mt-0.5">Ready for Storage</div>
        </div>

      </div>

      {/* Rules Notice */}
      <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/90 flex items-start gap-3 text-xs text-amber-900 shadow-2xs">
        <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div className="space-y-0.5">
          <div className="font-bold text-amber-900 text-sm">Strict Rule Enforcement: Exactly 7 Tablet Slots Per Box</div>
          <p className="text-amber-800/90 leading-relaxed font-medium">
            Each physical storage box is engineered to store exactly 7 tablets. Automatic capacity validation guards against assigning or transferring tablets into a box that has reached its 7-slot capacity.
          </p>
        </div>
      </div>

      {/* Search, Filter, Sort & View Bar */}
      <div className="p-4 md:p-5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex flex-col lg:flex-row lg:items-center justify-between gap-3.5">
        
        {/* Search Field */}
        <div className="relative w-full lg:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search box #, name, location, tablet #..."
            className="w-full pl-9 pr-8 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-900 placeholder:text-slate-400 outline-none focus:border-indigo-600 focus:bg-white transition font-medium"
          />
          {search && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filters & Sorting Group */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          
          {/* Status Segmented Buttons */}
          <div className="inline-flex p-1 bg-slate-100 rounded-xl border border-slate-200/80 text-xs font-bold">
            {(['All', 'Available', 'Full', 'Empty'] as const).map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => handleStatusFilterChange(status)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  statusFilter === status
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          {/* Location Filter */}
          {uniqueLocations.length > 0 && (
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <select
                value={locationFilter}
                onChange={(e) => handleLocationFilterChange(e.target.value)}
                className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
              >
                <option value="All">All Locations</option>
                {uniqueLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Sort By Dropdown */}
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-2 rounded-xl border border-slate-200">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-transparent text-xs font-semibold text-slate-700 outline-none cursor-pointer"
            >
              <option value="boxNumber-asc">Box # (Ascending)</option>
              <option value="boxNumber-desc">Box # (Descending)</option>
              <option value="boxName-asc">Box Name (A-Z)</option>
              <option value="occupancy-desc">Most Occupied First</option>
              <option value="occupancy-asc">Least Occupied First</option>
            </select>
          </div>

        </div>

      </div>

      {/* Tablet Boxes Responsive Cards Grid (2 to 4 cards per row) */}
      {paginatedBoxes.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/90 p-12 text-center text-slate-400 space-y-3">
          <Boxes className="w-10 h-10 mx-auto text-slate-300" />
          <div className="text-sm font-bold text-slate-700">No Tablet Boxes Found</div>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {search || statusFilter !== 'All' || locationFilter !== 'All'
              ? 'No storage boxes match your search or filter criteria. Try resetting filters.'
              : 'There are currently no tablet boxes configured in the system. Click "Create New Box" to add one.'}
          </p>
          {(search || statusFilter !== 'All' || locationFilter !== 'All') && (
            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('All');
                setLocationFilter('All');
              }}
              className="px-4 py-2 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl hover:bg-indigo-100 transition inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Search & Filters</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-5">
          {paginatedBoxes.map((box) => {
            const filledCount = box.tablets.length;
            const availableSlots = 7 - filledCount;
            const isFull = filledCount >= 7;
            const isEmpty = filledCount === 0;
            const fillPercent = Math.round((filledCount / 7) * 100);

            return (
              <div
                key={box.id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all p-5 flex flex-col justify-between space-y-4"
              >
                {/* Box Card Header */}
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-black px-2.5 py-0.5 rounded-md bg-amber-50 text-amber-700 border border-amber-200/90">
                          {box.boxNumber}
                        </span>
                        {isFull ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            7/7 FULL
                          </span>
                        ) : isEmpty ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                            EMPTY (7 Free)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            {availableSlots} Free
                          </span>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 tracking-tight pt-1">
                        {box.boxName}
                      </h3>

                      <div className="text-xs text-slate-500 font-medium flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{box.location}</span>
                      </div>
                    </div>

                    {/* Quick Menu Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setViewingBoxDetails(box)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                        title="View Box Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(box)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer"
                        title="Edit Box"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteBoxRequest(box)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                        title="Delete Box"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Occupancy Progress Bar */}
                  <div className="mt-4 pt-3 border-t border-slate-100 space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-slate-600">Occupancy</span>
                      <span className={isFull ? 'text-rose-600' : 'text-slate-800'}>
                        {filledCount} / 7 Devices ({fillPercent}%)
                      </span>
                    </div>

                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden p-0.5 border border-slate-200/60">
                      <div
                        className={`h-full rounded-full transition-all duration-300 ${
                          isFull
                            ? 'bg-rose-500'
                            : fillPercent >= 80
                            ? 'bg-amber-500'
                            : filledCount > 0
                            ? 'bg-emerald-500'
                            : 'bg-slate-300'
                        }`}
                        style={{ width: `${Math.max(fillPercent, 2)}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* 7 Physical Tablet Slots Visual Grid */}
                <div>
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 mb-2">
                    <span>PHYSICAL 7-SLOT LAYOUT</span>
                    <span className="font-mono">{filledCount}/7 Filled</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 p-2 bg-slate-50/80 rounded-xl border border-slate-200/80">
                    {Array.from({ length: 7 }).map((_, slotIdx) => {
                      const tabletInSlot = box.tablets[slotIdx];

                      return (
                        <div
                          key={slotIdx}
                          className={`h-16 rounded-lg border flex flex-col items-center justify-between p-1 text-center transition-all relative group ${
                            tabletInSlot
                              ? 'bg-amber-50/90 border-amber-300 text-amber-900 shadow-2xs'
                              : 'bg-white border-dashed border-slate-200 text-slate-400 hover:border-amber-300'
                          }`}
                        >
                          <span className="text-[9px] font-black opacity-60 font-mono">#{slotIdx + 1}</span>
                          
                          {tabletInSlot ? (
                            <>
                              <TabletIcon className="w-3.5 h-3.5 text-amber-600" />
                              <span
                                className="text-[9px] font-bold font-mono truncate w-full text-slate-900"
                                title={`${tabletInSlot.tabletNumber} (${tabletInSlot.tabletName})`}
                              >
                                {tabletInSlot.tabletNumber.replace('TBL-', '')}
                              </span>

                              {/* Hover Slot Tooltip Actions */}
                              <div className="absolute inset-0 bg-slate-900/90 backdrop-blur-2xs rounded-lg flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity p-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMovingTablet(tabletInSlot);
                                    setCapacityError(null);
                                  }}
                                  className="p-1 rounded bg-indigo-600 text-white hover:bg-indigo-500 transition cursor-pointer"
                                  title={`Move ${tabletInSlot.tabletNumber}`}
                                >
                                  <ArrowRightLeft className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmUnassignSingle({
                                      tablet: tabletInSlot,
                                      boxNumber: box.boxNumber,
                                    })
                                  }
                                  className="p-1 rounded bg-rose-600 text-white hover:bg-rose-500 transition cursor-pointer"
                                  title={`Remove ${tabletInSlot.tabletNumber}`}
                                >
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleOpenAssignModal(box)}
                              className="w-full h-full flex flex-col items-center justify-center text-slate-300 hover:text-amber-600 transition cursor-pointer"
                              title="Click to assign tablet to slot"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span className="text-[8px] font-bold">Slot Free</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Box Footer Action Toolbar */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs gap-2">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => setQrBoxModal(box)}
                      className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition flex items-center gap-1 cursor-pointer"
                      title="Generate Box QR Tag"
                    >
                      <QrCode className="w-3.5 h-3.5 text-amber-600" />
                      <span>QR Tag</span>
                    </button>

                    {!isEmpty && (
                      <button
                        onClick={() => setConfirmUnassignAll(box)}
                        className="px-2 py-1.5 rounded-xl text-slate-500 hover:text-rose-600 hover:bg-rose-50 font-semibold transition cursor-pointer text-[11px]"
                        title="Unassign all tablets from this box"
                      >
                        Unassign All
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => handleOpenAssignModal(box)}
                    disabled={isFull}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-40 text-white font-bold transition shadow-2xs cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>{isFull ? 'Vault Full' : 'Assign Tablets'}</span>
                  </button>
                </div>

              </div>
            );
          })}
        </div>
      )}

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 shadow-2xs flex items-center justify-between text-xs font-semibold text-slate-600">
          <div>
            Showing Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong> ({filteredAndSortedBoxes.length} total storage boxes)
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 disabled:opacity-40 transition flex items-center gap-1 cursor-pointer"
            >
              <span>Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* CREATE / EDIT BOX MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150">
            
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Boxes className="w-5 h-5 text-amber-600" />
                {editingBox ? 'Edit Storage Vault Details' : 'Configure New Tablet Box (7 Slots)'}
              </h3>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBoxForm} className="p-6 space-y-4">
              
              <div>
                <label className="block font-bold text-slate-700 mb-1">Box Identifier Number *</label>
                <input
                  type="text"
                  required
                  value={formData.boxNumber}
                  onChange={(e) => setFormData({ ...formData, boxNumber: e.target.value })}
                  placeholder="e.g. BOX-05"
                  className="w-full px-3.5 py-2 bg-slate-50 rounded-xl border border-slate-200 font-mono font-bold text-amber-700 outline-none focus:border-amber-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Box Name / Label *</label>
                <input
                  type="text"
                  required
                  value={formData.boxName}
                  onChange={(e) => setFormData({ ...formData, boxName: e.target.value })}
                  placeholder="e.g. Storage Vault E - Standard 8"
                  className="w-full px-3.5 py-2 bg-slate-50 rounded-xl border border-slate-200 font-semibold text-slate-900 outline-none focus:border-amber-500 focus:bg-white transition"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Location / Cabinet Room *</label>
                <input
                  type="text"
                  required
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Lab 101 - Cabinet A1"
                  className="w-full px-3.5 py-2 bg-slate-50 rounded-xl border border-slate-200 font-semibold text-slate-900 outline-none focus:border-amber-500 focus:bg-white transition"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 font-medium text-[11px] flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Box capacity is strictly hardcoded to <strong>exactly 7 tablets max</strong>.</span>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-bold transition shadow-md shadow-amber-500/20 cursor-pointer"
                >
                  {editingBox ? 'Update Box' : 'Create Box'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* ASSIGN STUDENTS TO BOX MODAL */}
      {assigningBox && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white w-full max-w-xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                  <UserPlus className="w-5 h-5 text-amber-600 shrink-0" />
                  <span>Assign Students to {assigningBox.boxNumber}</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Vault Occupancy: <strong>{assigningBox.tablets.length}/7 Filled</strong> • Available Space: <strong>{7 - assigningBox.tablets.length} Slots</strong>
                </p>
              </div>
              <button
                onClick={() => setAssigningBox(null)}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 sm:p-6 space-y-5 overflow-y-auto grow">
              
              {capacityError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{capacityError}</span>
                </div>
              )}

              {/* PIN Search Input Section */}
              <div className="space-y-1.5 relative">
                <label className="block font-bold text-slate-700 text-xs">
                  Search Student by PIN or Name *
                </label>
                <div className="relative">
                  <Search className="w-5 h-5 absolute left-3.5 top-3 text-indigo-500 pointer-events-none" />
                  <input
                    type="text"
                    value={assignSearch}
                    onFocus={() => setIsAssignSearchDropdownOpen(true)}
                    onChange={(e) => {
                      setAssignSearch(e.target.value);
                      setIsAssignSearchDropdownOpen(true);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (searchDropdownStudents.length > 0) {
                          handleSelectStudentForBox(searchDropdownStudents[0]);
                        }
                      } else if (e.key === 'Escape') {
                        setIsAssignSearchDropdownOpen(false);
                      }
                    }}
                    placeholder="Type PIN (e.g. 1001, 200) or Student Name..."
                    className="w-full pl-11 pr-10 py-3 bg-slate-50 hover:bg-slate-100/80 focus:bg-white rounded-2xl border-2 border-slate-200 focus:border-indigo-600 text-sm font-semibold text-slate-900 placeholder:text-slate-400 outline-none transition shadow-xs min-h-[48px]"
                  />
                  {assignSearch && (
                    <button
                      type="button"
                      onClick={() => { setAssignSearch(''); setIsAssignSearchDropdownOpen(false); }}
                      className="absolute right-2.5 top-2.5 p-1.5 text-slate-400 hover:text-slate-700 bg-slate-200/60 hover:bg-slate-200 rounded-xl cursor-pointer transition"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Real-time Search Dropdown List */}
                {isAssignSearchDropdownOpen && assignSearch.trim().length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl border border-slate-200 shadow-2xl z-50 max-h-64 overflow-y-auto divide-y divide-slate-100 animate-in fade-in zoom-in-95 duration-100">
                    {searchDropdownStudents.length === 0 ? (
                      <div className="p-4 text-xs sm:text-sm text-slate-500 font-semibold text-center flex items-center justify-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>No student found.</span>
                      </div>
                    ) : (
                      searchDropdownStudents.map((st) => (
                        <div
                          key={st.id}
                          onClick={() => handleSelectStudentForBox(st)}
                          className="p-3.5 hover:bg-indigo-50/90 active:bg-indigo-100 transition cursor-pointer flex items-center justify-between text-xs sm:text-sm min-h-[52px]"
                        >
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 text-xs shrink-0">
                              {st.pinNumber}
                            </span>
                            <div>
                              <span className="font-bold text-slate-900 block">{st.name}</span>
                              <span className="text-[11px] text-slate-500 font-medium block">
                                {st.standard} • {st.assignedTabletNumber ? `Tablet: ${st.assignedTabletNumber}` : 'Auto-Assign Free Tablet'}
                              </span>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectStudentForBox(st);
                            }}
                            className="text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-full border border-indigo-200 transition shrink-0 cursor-pointer"
                          >
                            + Select
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* Selected Students Box Section */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-indigo-600" />
                    <span>Selected Students ({selectedStudentIdsToAssign.length} / {7 - assigningBox.tablets.length})</span>
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Max {7 - assigningBox.tablets.length} student(s)
                  </span>
                </div>

                {selectedStudentDetailsToAssign.length === 0 ? (
                  <div className="p-6 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/60 text-center text-slate-400 space-y-1">
                    <p className="font-semibold text-xs text-slate-500">No students selected yet.</p>
                    <p className="text-[11px]">Type a Student PIN above to search and add students to this box.</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectedStudentDetailsToAssign.map((st) => (
                      <div
                        key={st.id}
                        className="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-200/90 hover:border-indigo-300 transition flex items-center justify-between gap-3 text-xs sm:text-sm min-h-[50px] shadow-2xs"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="font-mono font-bold text-indigo-700 bg-white px-2.5 py-1 rounded-lg border border-indigo-200 text-xs shrink-0 shadow-2xs">
                            PIN: {st.pinNumber}
                          </span>
                          <div className="min-w-0">
                            <span className="font-bold text-slate-900 block truncate">{st.name}</span>
                            <span className="text-[11px] text-slate-500 font-medium block truncate">
                              {st.standard} • {st.assignedTabletNumber ? `Tablet: ${st.assignedTabletNumber}` : 'Auto-Assign Free Tablet'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveStudentFromSelectedBox(st.id)}
                          className="w-8 h-8 rounded-xl bg-white hover:bg-rose-100 text-slate-400 hover:text-rose-700 flex items-center justify-center border border-slate-200 transition cursor-pointer active:scale-95 shrink-0"
                          title={`Remove ${st.name}`}
                          aria-label={`Remove ${st.name}`}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 sm:p-5 border-t border-slate-200 bg-slate-50 flex items-center justify-between shrink-0">
              <span className="text-slate-700 font-bold text-xs sm:text-sm">
                Selected: <strong className="text-indigo-600 text-sm sm:text-base font-extrabold">{selectedStudentIdsToAssign.length}</strong> / {7 - assigningBox.tablets.length} Max
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAssigningBox(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-100 transition cursor-pointer min-h-[42px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmAssignTablets}
                  disabled={selectedStudentIdsToAssign.length === 0}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold shadow-md shadow-indigo-600/20 transition cursor-pointer min-h-[42px]"
                >
                  Confirm Assignment
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* MOVE TABLET BETWEEN BOXES MODAL */}
      {movingTablet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150">
            
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                Transfer Tablet {movingTablet.tabletNumber}
              </h3>
              <button
                onClick={() => setMovingTablet(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              
              {capacityError && (
                <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 font-bold flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{capacityError}</span>
                </div>
              )}

              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                <div className="text-slate-500 font-medium">Device to Move:</div>
                <div className="font-bold text-slate-900 flex items-center gap-2 text-sm">
                  <span>{movingTablet.tabletNumber}</span>
                  <span className="text-slate-500 text-xs font-normal">({movingTablet.tabletName})</span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Current Storage: <strong>Box {movingTablet.boxNumber || 'Unassigned'}</strong>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Select Destination Box *</label>
                <select
                  value={targetBoxIdForMove}
                  onChange={(e) => {
                    setTargetBoxIdForMove(e.target.value);
                    setCapacityError(null);
                  }}
                  className="w-full px-3.5 py-2.5 bg-slate-50 rounded-xl border border-slate-200 font-semibold text-slate-900 outline-none focus:border-indigo-600 transition cursor-pointer"
                >
                  <option value="">-- Choose Destination Storage Box --</option>
                  {boxes.map((b) => {
                    const count = tablets.filter((t) => t.boxId === b.id).length;
                    const isCurrent = b.id === movingTablet.boxId;
                    const isFull = count >= 7;

                    return (
                      <option
                        key={b.id}
                        value={b.id}
                        disabled={isCurrent || isFull}
                      >
                        {b.boxNumber} - {b.boxName} ({count}/7 filled {isFull ? '• FULL' : ''} {isCurrent ? '• CURRENT' : ''})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="pt-4 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMovingTablet(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmMoveTablet}
                  disabled={!targetBoxIdForMove}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-bold transition shadow-md shadow-indigo-600/20 cursor-pointer"
                >
                  Transfer Device
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* VIEW BOX DETAILS MODAL */}
      {viewingBoxDetails && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-xs animate-in fade-in zoom-in-95 duration-150">
            
            <div className="p-5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-amber-600" />
                  {viewingBoxDetails.boxName} Details
                </h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">
                  ID: {viewingBoxDetails.boxNumber} • Location: {viewingBoxDetails.location}
                </p>
              </div>
              <button
                onClick={() => setViewingBoxDetails(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              
              {/* Box Summary Ribbon */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-semibold">Total Slots</div>
                  <div className="text-xl font-bold font-mono text-slate-900 mt-0.5">7 Slots</div>
                </div>
                <div className="p-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <div className="text-[11px] text-emerald-700 font-semibold">Occupied</div>
                  <div className="text-xl font-bold font-mono text-emerald-700 mt-0.5">
                    {tablets.filter((t) => t.boxId === viewingBoxDetails.id).length} Tablets
                  </div>
                </div>
                <div className="p-3 bg-blue-50 rounded-2xl border border-blue-200">
                  <div className="text-[11px] text-blue-700 font-semibold">Free Slots</div>
                  <div className="text-xl font-bold font-mono text-blue-700 mt-0.5">
                    {7 - tablets.filter((t) => t.boxId === viewingBoxDetails.id).length} Free
                  </div>
                </div>
              </div>

              {/* Table of stored devices in this box */}
              <div>
                <div className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
                  Stored Tablet Inventory ({tablets.filter((t) => t.boxId === viewingBoxDetails.id).length} Devices)
                </div>

                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Tablet ID</th>
                        <th className="py-2.5 px-3">Name & Model</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Assigned Student</th>
                        <th className="py-2.5 px-3 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {tablets.filter((t) => t.boxId === viewingBoxDetails.id).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">
                            No tablets currently assigned to this box.
                          </td>
                        </tr>
                      ) : (
                        tablets
                          .filter((t) => t.boxId === viewingBoxDetails.id)
                          .map((t) => (
                            <tr key={t.id} className="hover:bg-slate-50">
                              <td className="py-2.5 px-3 font-mono font-bold text-amber-700">
                                {t.tabletNumber}
                              </td>
                              <td className="py-2.5 px-3">
                                <div className="font-bold text-slate-900">{t.tabletName}</div>
                                <div className="text-[10px] text-slate-400">{t.brand} {t.model}</div>
                              </td>
                              <td className="py-2.5 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  t.status === 'Available'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                                }`}>
                                  {t.status}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-semibold text-slate-700">
                                {t.assignedToStudentName || '-'}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmUnassignSingle({
                                      tablet: t,
                                      boxNumber: viewingBoxDetails.boxNumber,
                                    })
                                  }
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold border border-rose-200 transition cursor-pointer"
                                >
                                  Remove
                                </button>
                              </td>
                            </tr>
                          ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setViewingBoxDetails(null);
                    setQrBoxModal(viewingBoxDetails);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <QrCode className="w-4 h-4 text-amber-600" />
                  <span>View Printable QR Tag</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewingBoxDetails(null)}
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition cursor-pointer"
                >
                  Close
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* QR CODE & PRINTABLE TAG MODAL */}
      {qrBoxModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 p-6 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            
            <div className="flex justify-between items-center border-b border-slate-200 pb-3">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-amber-600" />
                Physical Storage Vault Badge
              </h3>
              <button
                onClick={() => setQrBoxModal(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 bg-amber-50/90 rounded-2xl border-2 border-dashed border-amber-400 text-slate-900 space-y-2">
              <div className="text-[10px] font-black text-amber-800 tracking-widest uppercase">
                SCHOOL TABLET STORAGE VAULT
              </div>
              <div className="text-2xl font-black text-slate-900 font-mono tracking-tight">
                {qrBoxModal.boxNumber}
              </div>
              <div className="text-xs font-bold text-slate-700">
                {qrBoxModal.boxName}
              </div>

              {/* Real 2D Scannable QR Code */}
              <div className="w-40 h-40 mx-auto bg-white p-2.5 rounded-2xl border border-amber-200 shadow-sm my-3 flex items-center justify-center">
                <QRCodeImage value={qrBoxModal.qrCode || qrBoxModal.boxNumber} size={140} />
              </div>

              <div className="text-[11px] font-bold text-slate-600">
                Location: {qrBoxModal.location} • 7 Capacity
              </div>
            </div>

            <button
              onClick={() => window.print()}
              className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Print Box QR Badge</span>
            </button>

          </div>
        </div>
      )}

      {/* CONFIRM DELETE BOX MODAL */}
      {confirmDeleteBox && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-xs">
            
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirm Storage Box Deletion</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Are you sure you want to delete {confirmDeleteBox.boxNumber}?
                </p>
              </div>
            </div>

            {confirmDeleteBox.count > 0 && (
              <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-amber-900 font-medium">
                <strong>Warning:</strong> This box currently holds <strong>{confirmDeleteBox.count} tablet device(s)</strong>. Deleting this box will unassign all tablets so they are free for other boxes.
              </div>
            )}

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setConfirmDeleteBox(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteBox}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Delete Storage Box
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONFIRM UNASSIGN ALL TABLETS MODAL */}
      {confirmUnassignAll && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-xs">
            
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                <ShieldAlert className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Unassign All Devices?</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Box: {confirmUnassignAll.boxNumber} ({confirmUnassignAll.boxName})
                </p>
              </div>
            </div>

            <p className="text-slate-600 font-medium">
              Are you sure you want to remove all <strong>{tablets.filter((t) => t.boxId === confirmUnassignAll.id).length} tablet(s)</strong> from Box {confirmUnassignAll.boxNumber}? All devices will become available for assignment elsewhere.
            </p>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setConfirmUnassignAll(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUnassignAll}
                className="px-5 py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-xl transition shadow-md shadow-amber-500/20 cursor-pointer"
              >
                Confirm Clear All
              </button>
            </div>

          </div>
        </div>
      )}

      {/* CONFIRM UNASSIGN SINGLE TABLET MODAL */}
      {confirmUnassignSingle && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-2xs flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150 text-xs">
            
            <div className="flex items-center gap-3 text-amber-600">
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-200">
                <TabletIcon className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Remove Tablet from Box Slot?</h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Tablet: {confirmUnassignSingle.tablet.tabletNumber} ({confirmUnassignSingle.tablet.tabletName})
                </p>
              </div>
            </div>

            <p className="text-slate-600 font-medium">
              Are you sure you want to remove tablet <strong>{confirmUnassignSingle.tablet.tabletNumber}</strong> from <strong>{confirmUnassignSingle.boxNumber}</strong>?
            </p>

            <div className="pt-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={() => setConfirmUnassignSingle(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmUnassignSingle}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl transition shadow-md shadow-rose-600/20 cursor-pointer"
              >
                Remove Device
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
