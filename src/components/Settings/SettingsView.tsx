import React, { useState } from 'react';
import { 
  Settings as SettingsIcon, 
  Building2, 
  Calendar, 
  Download, 
  Upload, 
  RefreshCw, 
  ShieldCheck, 
  CheckCircle2, 
  AlertTriangle,
  Database,
  User,
  Sliders
} from 'lucide-react';
import { UserRole } from '../../types';
import { getStoredRole, saveStoredRole, logAuditAction } from '../../utils/storage';

interface SettingsViewProps {
  activeRole: UserRole;
  onRoleChange: (role: UserRole) => void;
  onResetData: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  activeRole,
  onRoleChange,
  onResetData,
}) => {
  const [schoolName, setSchoolName] = useState(() => {
    return localStorage.getItem('stm_school_name') || 'Excellence Academy & Digital Campus';
  });
  const [academicYear, setAcademicYear] = useState(() => {
    return localStorage.getItem('stm_academic_year') || '2025 - 2026';
  });
  const [cancellationWindow, setCancellationWindow] = useState(() => {
    return localStorage.getItem('stm_cancellation_window_mins') || '30';
  });

  const [savedSuccess, setSavedSuccess] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSaveGeneralSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('stm_school_name', schoolName);
    localStorage.setItem('stm_academic_year', academicYear);
    localStorage.setItem('stm_cancellation_window_mins', cancellationWindow);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
    logAuditAction('System User', activeRole, 'SETTINGS_UPDATE', 'System', `Updated Settings (Cancel Window: ${cancellationWindow} mins)`);
  };

  const handleExportAllData = () => {
    const dataObj = {
      students: localStorage.getItem('stm_students'),
      tablets: localStorage.getItem('stm_tablets'),
      boxes: localStorage.getItem('stm_boxes'),
      assignments: localStorage.getItem('stm_assignments'),
      attendanceRecords: localStorage.getItem('stm_attendance'),
      schoolName,
      academicYear,
      exportedAt: new Date().toISOString(),
    };
    const jsonStr = JSON.stringify(dataObj, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Attendance_System_Backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    logAuditAction('System User', activeRole, 'DATA_EXPORT', 'System', 'Exported complete database backup JSON');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.students) localStorage.setItem('stm_students', parsed.students);
        if (parsed.tablets) localStorage.setItem('stm_tablets', parsed.tablets);
        if (parsed.boxes) localStorage.setItem('stm_boxes', parsed.boxes);
        if (parsed.assignments) localStorage.setItem('stm_assignments', parsed.assignments);
        if (parsed.attendanceRecords) localStorage.setItem('stm_attendance', parsed.attendanceRecords);
        if (parsed.schoolName) {
          localStorage.setItem('stm_school_name', parsed.schoolName);
          setSchoolName(parsed.schoolName);
        }
        alert('Database restored successfully! Page will reload now.');
        window.location.reload();
      } catch (err) {
        alert('Invalid JSON backup file.');
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmReset = () => {
    onResetData();
    setShowResetConfirm(false);
    alert('System data reset to initial default records.');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <SettingsIcon className="w-5 h-5" />
            </div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">System Settings</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage institutional details, user access roles, data backups, and system reset controls
          </p>
        </div>

        {savedSuccess && (
          <div className="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-200 flex items-center gap-2 animate-fadeIn">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Settings saved successfully!</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* General School Configuration */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Building2 className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Institution Details
            </h2>
          </div>

          <form onSubmit={handleSaveGeneralSettings} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">School / Organization Name</label>
              <input
                type="text"
                value={schoolName}
                onChange={(e) => setSchoolName(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-xs text-slate-900 font-medium outline-none focus:border-indigo-600 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Academic Year</label>
              <input
                type="text"
                value={academicYear}
                onChange={(e) => setAcademicYear(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-xs text-slate-900 font-medium outline-none focus:border-indigo-600 transition"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Cancellation Window (Minutes)</label>
              <select
                value={cancellationWindow}
                onChange={(e) => setCancellationWindow(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-xs text-slate-900 font-medium outline-none focus:border-indigo-600 transition"
              >
                <option value="15">15 Minutes</option>
                <option value="30">30 Minutes</option>
                <option value="60">1 Hour</option>
                <option value="120">2 Hours</option>
              </select>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition flex items-center justify-center gap-2 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Save Details</span>
            </button>
          </form>
        </div>

        {/* User Role Control */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <ShieldCheck className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Access Role & Privileges
            </h2>
          </div>

          <div className="space-y-4">
            <p className="text-xs text-slate-500">
              Select your current operating access level for administrative actions and audit logging:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {[
                { role: 'Admin' as UserRole, desc: 'Full privileges' },
                { role: 'Staff' as UserRole, desc: 'Daily operations' },
                { role: 'Viewer' as UserRole, desc: 'Read-only access' },
              ].map(({ role, desc }) => (
                <button
                  key={role}
                  onClick={() => onRoleChange(role)}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer ${
                    activeRole === role
                      ? 'border-indigo-600 bg-indigo-50/60 ring-2 ring-indigo-600/20'
                      : 'border-slate-200 hover:border-slate-300 bg-slate-50'
                  }`}
                >
                  <div className="font-extrabold text-xs text-slate-900">{role}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{desc}</div>
                </button>
              ))}
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs text-slate-600 flex items-center gap-3">
              <User className="w-4 h-4 text-slate-400 shrink-0" />
              <div>
                Active Role: <strong className="text-indigo-600">{activeRole}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Database & Data Management */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-5 md:col-span-2">
          <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
            <Database className="w-4 h-4 text-indigo-600" />
            <h2 className="text-xs font-black uppercase tracking-wider text-slate-900">
              Database Backup & Recovery
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Export Backup */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="font-bold text-xs text-slate-900">Export System Data</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Download a JSON backup containing all students, boxes, assignments, and attendance records.
                </p>
              </div>
              <button
                onClick={handleExportAllData}
                className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON Backup</span>
              </button>
            </div>

            {/* Restore Data */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="font-bold text-xs text-slate-900">Restore System Data</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Upload a previously exported JSON backup file to restore database records.
                </p>
              </div>
              <label className="w-full py-2 px-3 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200 transition flex items-center justify-center gap-2 cursor-pointer text-center">
                <Upload className="w-3.5 h-3.5" />
                <span>Import JSON Backup</span>
                <input
                  type="file"
                  accept=".json"
                  onChange={handleImportJSON}
                  className="hidden"
                />
              </label>
            </div>

            {/* Reset System Data */}
            <div className="p-4 rounded-2xl bg-rose-50/50 border border-rose-200 flex flex-col justify-between space-y-3">
              <div>
                <h3 className="font-bold text-xs text-rose-900">Reset System Data</h3>
                <p className="text-[11px] text-rose-700/80 mt-1">
                  Reset local storage records back to default sample data.
                </p>
              </div>
              <button
                onClick={() => setShowResetConfirm(true)}
                className="w-full py-2 px-3 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reset Database</span>
              </button>
            </div>
          </div>
        </div>

      </div>

      {/* Reset Modal */}
      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white max-w-md w-full p-6 rounded-3xl border border-slate-200 shadow-xl space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h3 className="text-base font-black text-slate-900">Confirm System Reset</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to reset all students, boxes, assignments, and daily attendance records back to default settings?
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReset}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
              >
                Yes, Reset System Data
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
