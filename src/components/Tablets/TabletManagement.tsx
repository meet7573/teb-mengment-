import React, { useState, useMemo } from 'react';
import { 
  Tablet as TabletIcon, 
  Search, 
  Plus, 
  FileSpreadsheet, 
  FileText, 
  Edit3, 
  Trash2, 
  QrCode, 
  Barcode, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  AlertCircle,
  X,
  Boxes,
  Printer,
  Camera,
  ArrowRightLeft,
  Eye,
  Check
} from 'lucide-react';
import { Tablet, Student, TabletBox, TabletStatus, UserRole } from '../../types';
import { exportToExcel, exportToPDF } from '../../utils/exportUtils';
import { logAuditAction } from '../../utils/storage';
import { QRScannerModal } from '../Scanner/QRScannerModal';
import { QRCodeImage } from '../Scanner/QRCodeImage';

interface TabletManagementProps {
  tablets: Tablet[];
  students?: Student[];
  boxes?: TabletBox[];
  onSaveTablets: (updated: Tablet[]) => void;
  onSaveBoxes?: (updatedBoxes: TabletBox[]) => void;
  activeRole: UserRole;
  onQuickAssign: (tablet: Tablet) => void;
}

export const TabletManagement: React.FC<TabletManagementProps> = ({
  tablets,
  students = [],
  boxes = [],
  onSaveTablets,
  onSaveBoxes,
  activeRole,
  onQuickAssign,
}) => {
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState<string>('All');
  const [selectedStatus, setSelectedStatus] = useState<string>('All');

  // Modals
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTablet, setEditingTablet] = useState<Tablet | null>(null);

  const [qrModalTablet, setQrModalTablet] = useState<Tablet | null>(null);

  // Manual Box Placement State (Single Tablet)
  const [manualBoxTablet, setManualBoxTablet] = useState<Tablet | null>(null);
  const [selectedBoxIdForTablet, setSelectedBoxIdForTablet] = useState<string>('');

  // Batch Manual Box Placement State
  const [isBatchBoxModalOpen, setIsBatchBoxModalOpen] = useState<boolean>(false);
  const [batchTargetBoxId, setBatchTargetBoxId] = useState<string>('');
  const [selectedBatchTabletIds, setSelectedBatchTabletIds] = useState<string[]>([]);

  // QR Scanner State
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannedTabletModal, setScannedTabletModal] = useState<Tablet | null>(null);
  const [scanNotification, setScanNotification] = useState<string | null>(null);

  // Delete State
  const [deletingTablet, setDeletingTablet] = useState<{ id: string; number: string } | null>(null);
  const [operatorWarning, setOperatorWarning] = useState<string | null>(null);

  // Helper to calculate current tablet occupancy for a box
  const getBoxOccupancy = (boxId: string): number => {
    return tablets.filter((t) => t.boxId === boxId).length;
  };

  // Unboxed tablets list
  const unboxedTablets = useMemo(() => {
    return tablets.filter((t) => !t.boxId);
  }, [tablets]);

  const handleScanSuccess = (rawText: string) => {
    const cleanQuery = rawText.replace(/^(QR-|BC-)/i, '').trim().toLowerCase();
    
    // Find tablet by matching qrCode, barcode, tabletNumber, or id
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

    if (matchedTablet) {
      setSearch(matchedTablet.tabletNumber);
      setScannedTabletModal(matchedTablet);
      logAuditAction('System User', activeRole, 'QR_SCAN_SUCCESS', 'Tablets', `Scanned QR tag for tablet ${matchedTablet.tabletNumber}`);
    } else {
      setScanNotification(`No tablet matching asset tag "${rawText}" was found in inventory.`);
      setTimeout(() => setScanNotification(null), 5000);
    }
  };

  // Form State
  const [formData, setFormData] = useState<{
    tabletName: string;
    tabletNumber: string;
    brand: string;
    model: string;
    entryDate: string;
    status: TabletStatus;
    boxId: string;
  }>({
    tabletName: '',
    tabletNumber: `TBL-${Math.floor(8000 + Math.random() * 999)}`,
    brand: 'Samsung',
    model: 'Galaxy Tab A9 64GB',
    entryDate: new Date().toISOString().slice(0, 10),
    status: 'Available',
    boxId: '',
  });

  const filteredTablets = useMemo(() => {
    return tablets.filter((t) => {
      const matchSearch =
        t.tabletName.toLowerCase().includes(search.toLowerCase()) ||
        t.tabletNumber.toLowerCase().includes(search.toLowerCase()) ||
        t.model.toLowerCase().includes(search.toLowerCase()) ||
        (t.assignedToStudentName && t.assignedToStudentName.toLowerCase().includes(search.toLowerCase())) ||
        (t.boxNumber && t.boxNumber.toLowerCase().includes(search.toLowerCase()));

      const matchBrand = selectedBrand === 'All' || t.brand === selectedBrand;
      const matchStatus = selectedStatus === 'All' || t.status === selectedStatus;

      return matchSearch && matchBrand && matchStatus;
    });
  }, [tablets, search, selectedBrand, selectedStatus]);

  const handleOpenAdd = () => {
    setEditingTablet(null);
    setFormData({
      tabletName: `Tab-Asset-${tablets.length + 1}`,
      tabletNumber: `TBL-${Math.floor(8000 + Math.random() * 999)}`,
      brand: 'Samsung',
      model: 'Galaxy Tab A9 64GB',
      entryDate: new Date().toISOString().slice(0, 10),
      status: 'Available',
      boxId: '',
    });
    setIsFormOpen(true);
  };

  const handleOpenEdit = (tablet: Tablet) => {
    setEditingTablet(tablet);
    setFormData({
      tabletName: tablet.tabletName,
      tabletNumber: tablet.tabletNumber,
      brand: tablet.brand,
      model: tablet.model,
      entryDate: tablet.entryDate,
      status: tablet.status,
      boxId: tablet.boxId || '',
    });
    setIsFormOpen(true);
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.tabletName.trim()) return;

    const targetBox = boxes.find((b) => b.id === formData.boxId);
    if (targetBox && targetBox.id !== editingTablet?.boxId) {
      const currentCount = getBoxOccupancy(targetBox.id);
      if (currentCount >= 7) {
        alert(`Box ${targetBox.boxNumber} has reached maximum capacity (7/7 tablets). Please select another box or remove a tablet first.`);
        return;
      }
    }

    const boxNumber = targetBox ? targetBox.boxNumber : undefined;
    const boxId = targetBox ? targetBox.id : undefined;

    if (editingTablet) {
      const updated = tablets.map((t) =>
        t.id === editingTablet.id
          ? {
              ...t,
              tabletName: formData.tabletName,
              tabletNumber: formData.tabletNumber,
              brand: formData.brand,
              model: formData.model,
              entryDate: formData.entryDate,
              status: formData.status,
              boxId,
              boxNumber,
              qrCode: `QR-${formData.tabletNumber}`,
              barcode: `BC-${formData.tabletNumber.replace('-', '')}`,
            }
          : t
      );
      onSaveTablets(updated);
      logAuditAction('System User', activeRole, 'TABLET_UPDATED', 'Tablets', `Updated tablet asset ${formData.tabletNumber} (${formData.tabletName}) - Box: ${boxNumber || 'Unboxed'}`);
    } else {
      const newTablet: Tablet = {
        id: `tbl-${Date.now()}`,
        tabletName: formData.tabletName,
        tabletNumber: formData.tabletNumber,
        brand: formData.brand,
        model: formData.model,
        entryDate: formData.entryDate,
        status: formData.status,
        boxId,
        boxNumber,
        qrCode: `QR-${formData.tabletNumber}`,
        barcode: `BC-${formData.tabletNumber.replace('-', '')}`,
      };
      onSaveTablets([newTablet, ...tablets]);
      logAuditAction('System User', activeRole, 'TABLET_CREATED', 'Tablets', `Registered new tablet asset ${formData.tabletNumber} (${formData.tabletName}) - Box: ${boxNumber || 'Unboxed'}`);
    }

    setIsFormOpen(false);
  };

  // Open Single Tablet Manual Box Placement Modal
  const handleOpenManualBoxModal = (tablet: Tablet) => {
    setManualBoxTablet(tablet);
    setSelectedBoxIdForTablet(tablet.boxId || '');
  };

  // Confirm Single Tablet Manual Box Placement
  const handleConfirmManualBoxPlacement = () => {
    if (!manualBoxTablet) return;

    if (selectedBoxIdForTablet === 'UNBOX' || !selectedBoxIdForTablet) {
      // Remove from box
      const updated = tablets.map((t) =>
        t.id === manualBoxTablet.id ? { ...t, boxId: undefined, boxNumber: undefined } : t
      );
      onSaveTablets(updated);
      logAuditAction(
        'System User',
        activeRole,
        'TABLET_UNBOXED',
        'Tablets',
        `Manually removed tablet ${manualBoxTablet.tabletNumber} from box`
      );
      setScanNotification(`Tablet ${manualBoxTablet.tabletNumber} removed from box and set as Standalone Unboxed.`);
      setTimeout(() => setScanNotification(null), 4000);
      setManualBoxTablet(null);
      return;
    }

    const targetBox = boxes.find((b) => b.id === selectedBoxIdForTablet);
    if (!targetBox) return;

    if (manualBoxTablet.boxId !== targetBox.id) {
      const currentCount = getBoxOccupancy(targetBox.id);
      if (currentCount >= 7) {
        alert(`Cannot place tablet in ${targetBox.boxNumber}: Box has reached maximum capacity (7/7 tablets).`);
        return;
      }
    }

    const updated = tablets.map((t) =>
      t.id === manualBoxTablet.id
        ? { ...t, boxId: targetBox.id, boxNumber: targetBox.boxNumber }
        : t
    );

    onSaveTablets(updated);
    logAuditAction(
      'System User',
      activeRole,
      'MANUAL_BOX_ASSIGNMENT',
      'Tablets',
      `Manually placed tablet ${manualBoxTablet.tabletNumber} (${manualBoxTablet.tabletName}) into Box ${targetBox.boxNumber}`
    );

    setScanNotification(`Tablet ${manualBoxTablet.tabletNumber} manually stored in ${targetBox.boxNumber} (${targetBox.boxName}).`);
    setTimeout(() => setScanNotification(null), 4000);
    setManualBoxTablet(null);
  };

  // Confirm Batch Manual Box Placement
  const handleConfirmBatchPlacement = () => {
    if (!batchTargetBoxId || selectedBatchTabletIds.length === 0) return;

    const targetBox = boxes.find((b) => b.id === batchTargetBoxId);
    if (!targetBox) return;

    const currentCount = getBoxOccupancy(targetBox.id);
    const availableSlots = 7 - currentCount;

    if (selectedBatchTabletIds.length > availableSlots) {
      alert(`Selected ${selectedBatchTabletIds.length} tablets, but ${targetBox.boxNumber} only has ${availableSlots} slot(s) remaining.`);
      return;
    }

    const updated = tablets.map((t) => {
      if (selectedBatchTabletIds.includes(t.id)) {
        return { ...t, boxId: targetBox.id, boxNumber: targetBox.boxNumber };
      }
      return t;
    });

    onSaveTablets(updated);
    logAuditAction(
      'System User',
      activeRole,
      'BATCH_BOX_ASSIGNMENT',
      'Tablets',
      `Manually stored ${selectedBatchTabletIds.length} tablet(s) into Box ${targetBox.boxNumber}`
    );

    setScanNotification(`Successfully stored ${selectedBatchTabletIds.length} tablet(s) in ${targetBox.boxNumber}!`);
    setTimeout(() => setScanNotification(null), 4000);

    setIsBatchBoxModalOpen(false);
    setSelectedBatchTabletIds([]);
    setBatchTargetBoxId('');
  };

  const handleDelete = (id: string, number: string) => {
    if (activeRole === 'Operator') {
      setOperatorWarning('Operators cannot delete tablet assets.');
      return;
    }
    setDeletingTablet({ id, number });
  };

  const handleConfirmDeleteTablet = () => {
    if (!deletingTablet) return;
    const { id, number } = deletingTablet;
    const updated = tablets.filter((t) => t.id !== id);
    onSaveTablets(updated);
    logAuditAction('System User', activeRole, 'TABLET_DELETED', 'Tablets', `Deleted tablet asset ${number}`);
    setDeletingTablet(null);
  };

  const handleExportExcel = () => {
    const data = filteredTablets.map((t) => ({
      'Asset Tag': t.tabletNumber,
      Name: t.tabletName,
      Brand: t.brand,
      Model: t.model,
      Box: t.boxNumber || 'Unassigned',
      Status: t.status,
      'Assigned To': t.assignedToStudentName || 'None',
      'Entry Date': t.entryDate,
    }));
    exportToExcel(data, 'Tablet_Assets');
    logAuditAction('System User', activeRole, 'EXCEL_EXPORT', 'Tablets', 'Exported tablet asset inventory to Excel');
  };

  const handleExportPDF = () => {
    const headers = ['Asset Tag', 'Tablet Name', 'Brand/Model', 'Box', 'Assigned Student', 'Status'];
    const rows = filteredTablets.map((t) => [
      t.tabletNumber,
      t.tabletName,
      `${t.brand} ${t.model}`,
      t.boxNumber || 'Unboxed',
      t.assignedToStudentName || 'Unassigned',
      t.status,
    ]);
    exportToPDF('Tablet Fleet Asset Audit', headers, rows, 'Tablet_Inventory');
    logAuditAction('System User', activeRole, 'PDF_EXPORT', 'Tablets', 'Exported tablet inventory report to PDF');
  };

  return (
    <div className="space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <TabletIcon className="w-6 h-6 text-blue-600" />
            Tablet Fleet Inventory
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Track digital hardware assets, brand models, QR codes, and availability
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {unboxedTablets.length > 0 && (
            <button
              onClick={() => {
                setSelectedBatchTabletIds(unboxedTablets.map((t) => t.id));
                setBatchTargetBoxId(boxes[0]?.id || '');
                setIsBatchBoxModalOpen(true);
              }}
              className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shadow-md shadow-amber-600/30 transition flex items-center gap-1.5 cursor-pointer"
            >
              <Boxes className="w-4 h-4" />
              <span>Batch Box In ({unboxedTablets.length})</span>
            </button>
          )}

          <button
            onClick={() => setIsScannerOpen(true)}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Camera className="w-4 h-4" />
            <span>Scan QR Code</span>
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
            onClick={handleOpenAdd}
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Tablet</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tablet tag, brand, assigned student..."
            className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs outline-none focus:border-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedBrand}
            onChange={(e) => setSelectedBrand(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="All">All Brands</option>
            <option value="Samsung">Samsung</option>
            <option value="Apple">Apple</option>
            <option value="Lenovo">Lenovo</option>
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-medium text-slate-700 dark:text-slate-300 outline-none"
          >
            <option value="All">All Statuses</option>
            <option value="Available">Available</option>
            <option value="Assigned">Assigned</option>
            <option value="Maintenance">Maintenance</option>
          </select>
        </div>
      </div>

      {/* Tablets Grid Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTablets.length === 0 ? (
          <div className="col-span-full py-16 text-center text-slate-400 bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800">
            No tablet assets found matching filter parameters.
          </div>
        ) : (
          filteredTablets.map((t) => (
            <div
              key={t.id}
              className="p-5 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition space-y-4 flex flex-col justify-between"
            >
              <div>
                {/* Top Badge & Asset Tag */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <span className="font-mono text-xs font-extrabold text-blue-600 dark:text-blue-400 px-2 py-0.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800">
                      {t.tabletNumber}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mt-2">
                      {t.tabletName}
                    </h3>
                  </div>

                  {t.status === 'Available' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Available
                    </span>
                  ) : t.status === 'Assigned' ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                      <Clock className="w-3 h-3 text-blue-500" /> Assigned
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                      <AlertTriangle className="w-3 h-3 text-rose-500" /> Maintenance
                    </span>
                  )}
                </div>

                {/* Hardware Spec */}
                <div className="mt-3 text-xs space-y-1">
                  <div className="text-slate-600 dark:text-slate-300 font-semibold">
                    {t.brand} • {t.model}
                  </div>
                  <div className="text-slate-400 text-[11px] flex items-center gap-1">
                    <Boxes className="w-3.5 h-3.5 text-amber-500" />
                    Storage Location: <strong className="text-slate-700 dark:text-slate-300">{t.boxNumber || 'Not in Box'}</strong>
                  </div>
                </div>

                {/* Assigned Student info if assigned */}
                {t.assignedToStudentName && (
                  <div className="mt-3 p-2.5 rounded-2xl bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-100 dark:border-indigo-900/40 text-xs">
                    <div className="text-[10px] uppercase font-bold text-indigo-500 flex items-center justify-between">
                      <span>Assigned Student</span>
                      {(() => {
                        const st = students.find(s => s.id === t.assignedToStudentId || s.name === t.assignedToStudentName);
                        return st ? (
                          <span className="font-mono text-indigo-700 dark:text-indigo-300 bg-indigo-100 dark:bg-indigo-900/60 px-1.5 py-0.5 rounded text-[10px] font-bold">
                            PIN: {st.pinNumber}
                          </span>
                        ) : null;
                      })()}
                    </div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">{t.assignedToStudentName}</div>
                  </div>
                )}
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-1 text-xs">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenManualBoxModal(t)}
                    className="px-2.5 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/40 dark:hover:bg-amber-900/50 text-amber-800 dark:text-amber-200 font-bold text-xs border border-amber-200 dark:border-amber-800 transition flex items-center gap-1 cursor-pointer"
                    title="Manually assign or move tablet to a storage box"
                  >
                    <Boxes className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                    <span>{t.boxId ? 'Move Box' : 'Box In'}</span>
                  </button>

                  <button
                    onClick={() => setQrModalTablet(t)}
                    className="p-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-semibold transition cursor-pointer"
                    title="View QR & Barcode Tag"
                  >
                    <QrCode className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                  </button>
                </div>

                <div className="flex items-center gap-1">
                  {t.status === 'Available' && (
                    <button
                      onClick={() => onQuickAssign(t)}
                      className="px-2.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition cursor-pointer"
                    >
                      Assign
                    </button>
                  )}
                  <button
                    onClick={() => handleOpenEdit(t)}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg"
                    title="Edit Tablet"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id, t.tabletNumber)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg"
                    title="Delete Tablet"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

            </div>
          ))
        )}
      </div>

      {/* Add / Edit Tablet Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in duration-200">
            
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <TabletIcon className="w-5 h-5 text-blue-600" />
                {editingTablet ? 'Edit Tablet Asset' : 'Register New Tablet Hardware'}
              </h3>
              <button
                onClick={() => setIsFormOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveForm} className="p-6 space-y-4 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Tablet Internal Name *</label>
                <input
                  type="text"
                  required
                  value={formData.tabletName}
                  onChange={(e) => setFormData({ ...formData, tabletName: e.target.value })}
                  placeholder="e.g. Tab-Alpha-01"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Asset Tag Number *</label>
                <input
                  type="text"
                  required
                  value={formData.tabletNumber}
                  onChange={(e) => setFormData({ ...formData, tabletNumber: e.target.value })}
                  placeholder="e.g. TBL-8001"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-mono font-bold text-blue-600 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Brand *</label>
                  <select
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                  >
                    <option value="Samsung">Samsung</option>
                    <option value="Apple">Apple</option>
                    <option value="Lenovo">Lenovo</option>
                    <option value="Xiaomi">Xiaomi</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Hardware Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as TabletStatus })}
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                  >
                    <option value="Available">Available</option>
                    <option value="Assigned">Assigned</option>
                    <option value="Maintenance">Maintenance</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Model Description *</label>
                <input
                  type="text"
                  required
                  value={formData.model}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  placeholder="e.g. Galaxy Tab A9 64GB WiFi"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center justify-between">
                  <span>Storage Box / Cabinet Assignment</span>
                  <span className="text-[10px] text-amber-600 font-normal">Max 7 tablets / box</span>
                </label>
                <select
                  value={formData.boxId}
                  onChange={(e) => setFormData({ ...formData, boxId: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none font-medium text-slate-800 dark:text-slate-200"
                >
                  <option value="">-- Standalone Unboxed (Not in Box) --</option>
                  {boxes.map((b) => {
                    const occ = getBoxOccupancy(b.id);
                    const isCurrent = editingTablet?.boxId === b.id;
                    const isFull = occ >= 7 && !isCurrent;
                    return (
                      <option key={b.id} value={b.id} disabled={isFull}>
                        {b.boxNumber} ({b.boxName}) - {occ}/7 tablets {isFull ? ' [FULL]' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">Entry Date</label>
                <input
                  type="date"
                  value={formData.entryDate}
                  onChange={(e) => setFormData({ ...formData, entryDate: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 outline-none font-mono"
                />
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold transition shadow-md shadow-blue-600/30"
                >
                  {editingTablet ? 'Update Asset' : 'Save Asset'}
                </button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* QR & Barcode Preview Modal */}
      {qrModalTablet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden text-center p-6 space-y-4">
            
            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <QrCode className="w-4 h-4 text-indigo-600" />
                Physical Asset Badge Label
              </h3>
              <button
                onClick={() => setQrModalTablet(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-2xl border-2 border-dashed border-indigo-300 dark:border-indigo-700 inline-block w-full">
              <div className="text-xs font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400">
                INSTITUTE TABLET FLEET
              </div>
              <div className="text-lg font-black text-slate-900 dark:text-slate-100 mt-1">
                {qrModalTablet.tabletNumber}
              </div>
              <div className="text-xs font-semibold text-slate-500 mb-3">
                {qrModalTablet.tabletName} • {qrModalTablet.brand}
              </div>

              {/* Real 2D Scannable QR Code */}
              <div className="w-40 h-40 mx-auto bg-white p-2.5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-center">
                <QRCodeImage value={qrModalTablet.qrCode || qrModalTablet.tabletNumber} size={140} />
              </div>

              {/* Barcode Visual */}
              <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                <div className="text-[10px] font-mono text-slate-400 flex justify-center gap-1">
                  {Array.from({ length: 18 }).map((_, i) => (
                    <span key={i} className={`h-6 ${i % 2 === 0 ? 'w-1 bg-slate-900 dark:bg-white' : 'w-0.5 bg-slate-400'}`} />
                  ))}
                </div>
                <div className="text-[10px] font-mono font-bold text-slate-600 dark:text-slate-300 mt-1">
                  {qrModalTablet.barcode}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <button
                onClick={() => window.print()}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>Print Asset Tag</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Scan Result Toast Notification */}
      {scanNotification && (
        <div className="fixed bottom-6 right-6 z-50 bg-rose-900 text-white px-4 py-3 rounded-2xl shadow-xl border border-rose-700 flex items-center gap-3 text-xs font-semibold animate-in slide-in-from-bottom duration-200">
          <AlertTriangle className="w-5 h-5 text-rose-300 shrink-0" />
          <span>{scanNotification}</span>
          <button onClick={() => setScanNotification(null)} className="ml-2 text-rose-300 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Camera QR Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onScanSuccess={handleScanSuccess}
        title="Scan Tablet QR / Barcode Tag"
        subtitle="Point camera at physical QR label on back of tablet"
        sampleTablets={tablets}
      />

      {/* Scanned Tablet Quick Action Modal */}
      {scannedTabletModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-150 p-6 space-y-4">
            
            <div className="flex justify-between items-start border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-600 dark:text-indigo-400 tracking-wider">
                  Camera Scan Result Identified
                </span>
                <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 mt-0.5 flex items-center gap-2">
                  <Check className="w-5 h-5 text-emerald-500" />
                  {scannedTabletModal.tabletName}
                </h3>
              </div>
              <button
                onClick={() => setScannedTabletModal(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Asset Tag:</span>
                <span className="font-mono font-extrabold text-blue-600 dark:text-blue-400">{scannedTabletModal.tabletNumber}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Hardware Spec:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{scannedTabletModal.brand} • {scannedTabletModal.model}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Box Vault:</span>
                <span className="font-bold text-amber-600">{scannedTabletModal.boxNumber || 'Unboxed'}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Status:</span>
                <span className={`font-bold ${
                  scannedTabletModal.status === 'Available' ? 'text-emerald-600' :
                  scannedTabletModal.status === 'Assigned' ? 'text-blue-600' : 'text-rose-600'
                }`}>
                  {scannedTabletModal.status}
                </span>
              </div>

              {scannedTabletModal.assignedToStudentName && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 mt-2">
                  <span className="text-slate-500 block text-[11px]">Assigned Student:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100">{scannedTabletModal.assignedToStudentName}</span>
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2">
              {scannedTabletModal.status === 'Available' ? (
                <button
                  onClick={() => {
                    const t = scannedTabletModal;
                    setScannedTabletModal(null);
                    onQuickAssign(t);
                  }}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs shadow-md shadow-indigo-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ArrowRightLeft className="w-4 h-4" />
                  <span>Assign Tablet to Student (Check-Out)</span>
                </button>
              ) : (
                <button
                  onClick={() => {
                    const t = scannedTabletModal;
                    setScannedTabletModal(null);
                    onQuickAssign(t);
                  }}
                  className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-md shadow-blue-600/30 transition flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Eye className="w-4 h-4" />
                  <span>Manage Active Assignment</span>
                </button>
              )}

              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={() => {
                    const t = scannedTabletModal;
                    setScannedTabletModal(null);
                    handleOpenManualBoxModal(t);
                  }}
                  className="py-2 rounded-xl bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-200 font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer border border-amber-200 dark:border-amber-800"
                >
                  <Boxes className="w-3.5 h-3.5 text-amber-600" />
                  <span>Move Box</span>
                </button>

                <button
                  onClick={() => {
                    const t = scannedTabletModal;
                    setScannedTabletModal(null);
                    setQrModalTablet(t);
                  }}
                  className="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 text-indigo-600" />
                  <span>QR Label</span>
                </button>

                <button
                  onClick={() => {
                    const t = scannedTabletModal;
                    setScannedTabletModal(null);
                    handleOpenEdit(t);
                  }}
                  className="py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition flex items-center justify-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5 text-slate-600" />
                  <span>Edit Asset</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Manual Single-Tablet Box-In Placement Modal */}
      {manualBoxTablet && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">
                  Manual Box Assignment
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mt-0.5">
                  <Boxes className="w-5 h-5 text-amber-600" />
                  Store {manualBoxTablet.tabletNumber} ({manualBoxTablet.tabletName})
                </h3>
              </div>
              <button
                onClick={() => setManualBoxTablet(null)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div className="p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-amber-800 dark:text-amber-300 font-semibold block">Current Storage Status:</span>
                  <span className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                    {manualBoxTablet.boxNumber ? `Box ${manualBoxTablet.boxNumber}` : 'Standalone Unboxed (Not in Box)'}
                  </span>
                </div>
                <span className="px-2.5 py-1 rounded-xl bg-white dark:bg-slate-800 font-mono text-[11px] font-bold text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800">
                  {manualBoxTablet.tabletNumber}
                </span>
              </div>

              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-2">
                  Select Destination Storage Box Cabinet:
                </label>

                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {/* Option: Unbox / Remove */}
                  <div
                    onClick={() => setSelectedBoxIdForTablet('UNBOX')}
                    className={`p-3.5 rounded-2xl border-2 transition cursor-pointer flex items-center justify-between ${
                      selectedBoxIdForTablet === 'UNBOX' || !selectedBoxIdForTablet
                        ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 dark:border-indigo-500'
                        : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        selectedBoxIdForTablet === 'UNBOX' || !selectedBoxIdForTablet ? 'border-indigo-600 bg-indigo-600' : 'border-slate-300'
                      }`}>
                        {(selectedBoxIdForTablet === 'UNBOX' || !selectedBoxIdForTablet) && (
                          <div className="w-1.5 h-1.5 rounded-full bg-white" />
                        )}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100">Remove from Box (Standalone Unboxed)</div>
                        <div className="text-[11px] text-slate-500">Tablet will not belong to any cabinet box</div>
                      </div>
                    </div>
                  </div>

                  {/* List of Cabinet Boxes */}
                  {boxes.map((box) => {
                    const occ = getBoxOccupancy(box.id);
                    const isCurrent = manualBoxTablet.boxId === box.id;
                    const isFull = occ >= 7 && !isCurrent;
                    const isSelected = selectedBoxIdForTablet === box.id;

                    return (
                      <div
                        key={box.id}
                        onClick={() => !isFull && setSelectedBoxIdForTablet(box.id)}
                        className={`p-3.5 rounded-2xl border-2 transition ${
                          isFull
                            ? 'opacity-50 border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/40 cursor-not-allowed'
                            : isSelected
                            ? 'border-amber-500 bg-amber-50/60 dark:bg-amber-950/40 dark:border-amber-500 cursor-pointer'
                            : 'border-slate-200 dark:border-slate-800 hover:border-amber-300 cursor-pointer'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              isSelected ? 'border-amber-600 bg-amber-600' : 'border-slate-300'
                            }`}>
                              {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                <span>{box.boxNumber}</span>
                                <span className="text-xs text-slate-500 font-normal">({box.boxName})</span>
                                {isCurrent && (
                                  <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                    Current Location
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-500">{box.location}</div>
                            </div>
                          </div>

                          <div className="text-right">
                            <span className={`font-mono text-xs font-bold ${isFull ? 'text-rose-600' : 'text-amber-600 dark:text-amber-400'}`}>
                              {occ} / 7 Tablets
                            </span>
                            {isFull && <div className="text-[10px] text-rose-500 font-bold">Cabinet Full</div>}
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full mt-2 overflow-hidden">
                          <div
                            className={`h-full ${isFull ? 'bg-rose-500' : 'bg-amber-500'}`}
                            style={{ width: `${Math.min(100, (occ / 7) * 100)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setManualBoxTablet(null)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleConfirmManualBoxPlacement}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition shadow-md shadow-amber-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Save Box Placement</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Batch Manual Box Placement Organizer Modal */}
      {isBatchBoxModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            
            <div className="p-5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-amber-600 tracking-wider">
                  Bulk Manual Box-In
                </span>
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 mt-0.5">
                  <Boxes className="w-5 h-5 text-amber-600" />
                  Batch Tablet Box Organizer
                </h3>
              </div>
              <button
                onClick={() => setIsBatchBoxModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              
              <div>
                <label className="block font-bold text-slate-700 dark:text-slate-300 mb-1">
                  1. Select Destination Box Cabinet:
                </label>
                <select
                  value={batchTargetBoxId}
                  onChange={(e) => {
                    setBatchTargetBoxId(e.target.value);
                  }}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 font-bold text-slate-900 dark:text-slate-100 outline-none"
                >
                  {boxes.map((b) => {
                    const occ = getBoxOccupancy(b.id);
                    const free = 7 - occ;
                    return (
                      <option key={b.id} value={b.id} disabled={free <= 0}>
                        {b.boxNumber} ({b.boxName}) - {occ}/7 tablets ({free} free slot{free !== 1 ? 's' : ''})
                      </option>
                    );
                  })}
                </select>
              </div>

              {batchTargetBoxId && (() => {
                const targetBox = boxes.find((b) => b.id === batchTargetBoxId);
                const currentOcc = targetBox ? getBoxOccupancy(targetBox.id) : 0;
                const freeSlots = 7 - currentOcc;

                return (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="font-bold text-slate-700 dark:text-slate-300">
                        2. Select Unboxed Tablets to Store (Max {freeSlots} available):
                      </label>
                      <span className="font-mono text-[11px] font-bold text-amber-600">
                        {selectedBatchTabletIds.length} / {freeSlots} Selected
                      </span>
                    </div>

                    {unboxedTablets.length === 0 ? (
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 text-center text-slate-500">
                        No unboxed tablets currently available in inventory.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                        {unboxedTablets.map((t) => {
                          const isChecked = selectedBatchTabletIds.includes(t.id);
                          const reachMax = !isChecked && selectedBatchTabletIds.length >= freeSlots;

                          return (
                            <label
                              key={t.id}
                              className={`p-3 rounded-2xl border transition flex items-center justify-between cursor-pointer ${
                                isChecked
                                  ? 'border-amber-500 bg-amber-50/70 dark:bg-amber-950/40'
                                  : reachMax
                                  ? 'opacity-40 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 cursor-not-allowed'
                                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                <input
                                  type="checkbox"
                                  disabled={reachMax}
                                  checked={isChecked}
                                  onChange={(e) => {
                                    if (e.target.checked) {
                                      if (selectedBatchTabletIds.length < freeSlots) {
                                        setSelectedBatchTabletIds([...selectedBatchTabletIds, t.id]);
                                      }
                                    } else {
                                      setSelectedBatchTabletIds(selectedBatchTabletIds.filter((id) => id !== t.id));
                                    }
                                  }}
                                  className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500"
                                />
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                                    <span className="font-mono text-blue-600 dark:text-blue-400">{t.tabletNumber}</span>
                                    <span>{t.tabletName}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500">{t.brand} • {t.model}</div>
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}

              <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsBatchBoxModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!batchTargetBoxId || selectedBatchTabletIds.length === 0}
                  onClick={handleConfirmBatchPlacement}
                  className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-bold transition shadow-md shadow-amber-600/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Confirm Box Storage</span>
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTablet && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <Trash2 className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-slate-900">Confirm Tablet Asset Deletion</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete tablet asset <strong className="text-slate-900">{deletingTablet.number}</strong>? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setDeletingTablet(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDeleteTablet}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
              >
                Delete Tablet
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
