import React, { useState } from 'react';
import { Database, X, ShieldCheck, Search, Filter, RefreshCw } from 'lucide-react';
import { AuditLog } from '../../types';
import { getAuditLogs, initLocalStorage } from '../../utils/storage';

interface AuditLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onResetData: () => void;
}

export const AuditLogsModal: React.FC<AuditLogsModalProps> = ({
  isOpen,
  onClose,
  onResetData,
}) => {
  const [search, setSearch] = useState('');
  const [selectedModule, setSelectedModule] = useState<string>('All');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const logs = getAuditLogs();

  const filteredLogs = logs.filter((log) => {
    const matchSearch =
      log.action.toLowerCase().includes(search.toLowerCase()) ||
      log.details.toLowerCase().includes(search.toLowerCase()) ||
      log.userName.toLowerCase().includes(search.toLowerCase());

    const matchModule = selectedModule === 'All' || log.module === selectedModule;

    return matchSearch && matchModule;
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl border border-slate-200 overflow-hidden text-xs flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-indigo-600" />
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Security Audit & Event Log Stream
              </h3>
              <p className="text-[11px] text-slate-500">
                Tamper-evident audit trail tracking all attendance, tablet allocations, and box changes
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Bar */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search audit details, action, user..."
              className="w-full pl-9 pr-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs outline-none focus:border-indigo-600"
            />
          </div>

          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="px-3 py-1.5 bg-white rounded-xl border border-slate-200 text-xs outline-none font-medium"
          >
            <option value="All">All Modules</option>
            <option value="Students">Students</option>
            <option value="Tablets">Tablets</option>
            <option value="Tablet Boxes">Tablet Boxes</option>
            <option value="Assignments">Assignments</option>
            <option value="Attendance">Attendance</option>
          </select>

          <button
            onClick={() => setShowResetConfirm(true)}
            className="px-3 py-1.5 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold text-[11px] transition flex items-center gap-1 cursor-pointer shrink-0"
            title="Restore default seed data"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Reset Data</span>
          </button>
        </div>

        {/* Log List */}
        <div className="p-4 space-y-2 overflow-y-auto flex-1 bg-white">
          {filteredLogs.length === 0 ? (
            <div className="py-12 text-center text-slate-400">
              No audit logs matched search query.
            </div>
          ) : (
            filteredLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-2xl bg-slate-50/70 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-indigo-600">
                      {log.action}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-200 text-slate-700">
                      {log.module}
                    </span>
                  </div>
                  <div className="text-slate-800 font-medium mt-1">
                    {log.details}
                  </div>
                </div>

                <div className="text-right text-[11px] text-slate-500 font-mono shrink-0">
                  <div>{log.userName} ({log.userRole})</div>
                  <div>{log.timestamp}</div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>

      {showResetConfirm && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs z-60 flex items-center justify-center p-4">
          <div className="bg-white max-w-sm w-full p-5 rounded-2xl border border-slate-200 shadow-xl space-y-3">
            <h4 className="text-sm font-bold text-slate-900">Reset System Data</h4>
            <p className="text-xs text-slate-600">
              Are you sure you want to reset system data back to initial seed state? Custom changes will be restored to defaults.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => setShowResetConfirm(false)}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onResetData();
                  setShowResetConfirm(false);
                }}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white shadow-xs transition cursor-pointer"
              >
                Reset Data
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
