import React from 'react';
import { 
  Users, 
  Tablet, 
  Boxes, 
  ClipboardCheck, 
  UserCheck, 
  UserX, 
  Clock, 
  ArrowUpRight, 
  FileSpreadsheet,
  CheckCircle2,
  Calendar,
  Sparkles
} from 'lucide-react';
import { Student, Tablet as TabletType, TabletBox, DailyAttendanceRecord } from '../../types';

interface DashboardViewProps {
  students: Student[];
  tablets: TabletType[];
  boxes: TabletBox[];
  attendanceRecords: DailyAttendanceRecord[];
  onNavigate: (tab: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  students,
  tablets,
  boxes,
  attendanceRecords,
  onNavigate,
}) => {
  // Metrics Calculation
  const totalStudents = students.length;
  const coachingStudents = students.filter(s => s.isCoachingStudent).length;

  const totalTablets = tablets.length;
  const assignedTablets = tablets.filter(t => t.status === 'Assigned').length;
  const availableTablets = tablets.filter(t => t.status === 'Available').length;
  const maintenanceTablets = tablets.filter(t => t.status === 'Maintenance').length;

  const totalBoxes = boxes.length;

  // Today's attendance
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayRecord = attendanceRecords.find(r => r.date === todayStr) || attendanceRecords[0];

  let presentCount = 0;
  let absentCount = 0;
  let lateCount = 0;
  let leaveCount = 0;

  if (todayRecord && todayRecord.details) {
    todayRecord.details.forEach(d => {
      if (d.status === 'Present') presentCount++;
      else if (d.status === 'Absent') absentCount++;
      else if (d.status === 'Late') lateCount++;
      else if (d.status === 'Leave') leaveCount++;
    });
  }

  const attendanceRate = totalStudents > 0 ? Math.round(((presentCount + lateCount) / totalStudents) * 100) : 0;

  // Standard breakdown calculation
  const standardsList: ('Std 8' | 'Std 9' | 'Std 10' | 'Std 11' | 'Std 12')[] = ['Std 8', 'Std 9', 'Std 10', 'Std 11', 'Std 12'];
  const standardStats = standardsList.map(std => {
    const stdStudents = students.filter(s => s.standard === std);
    const stdAssigned = stdStudents.filter(s => s.assignedTabletId).length;
    return {
      standard: std,
      count: stdStudents.length,
      assigned: stdAssigned,
    };
  });

  return (
    <div className="space-y-6">
      
      {/* Top Welcome Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white p-6 md:p-8 shadow-md">
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 backdrop-blur-md text-white text-xs font-bold border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              Digital Tablet Management & Attendance Portal
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Institutional Digital Dashboard
            </h2>
            <p className="text-blue-100 text-xs sm:text-sm leading-relaxed">
              Real-time student digital attendance register, tablet box storage control (max 7 slots per box), and automated inventory tracking.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onNavigate('attendance')}
              className="px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white font-extrabold text-xs shadow-md transition flex items-center gap-2 cursor-pointer"
            >
              <ClipboardCheck className="w-4 h-4" />
              <span>Mark Attendance</span>
            </button>
            <button
              onClick={() => onNavigate('boxes')}
              className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold text-xs border border-white/20 transition flex items-center gap-2 cursor-pointer backdrop-blur-md"
            >
              <Boxes className="w-4 h-4 text-amber-300" />
              <span>Tablet Boxes</span>
            </button>
          </div>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Students */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Students Roster</span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalStudents}</span>
            <span className="text-xs font-bold text-blue-600">Total Enrolled</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Coaching Batch:</span>
            <span className="font-bold text-amber-600">{coachingStudents}</span>
          </div>
        </div>

        {/* Tablet Fleet */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-blue-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Tablet Inventory</span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <Tablet className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalTablets}</span>
            <span className="text-xs font-bold text-blue-600">Total Tablets</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              Assigned: <strong className="text-emerald-600">{assignedTablets}</strong>
            </span>
            <span className="flex items-center gap-1">
              Available: <strong className="text-blue-600">{availableTablets}</strong>
            </span>
          </div>
        </div>

        {/* Tablet Boxes */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-amber-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Storage Boxes</span>
            <div className="p-2.5 rounded-xl bg-amber-50 text-amber-600 border border-amber-100">
              <Boxes className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-slate-900">{totalBoxes}</span>
            <span className="text-xs font-bold text-amber-600">Active Boxes</span>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
            <span>Slot Rule:</span>
            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px]">
              Max 7 / Box
            </span>
          </div>
        </div>

        {/* Attendance Rate */}
        <div className="p-5 rounded-2xl bg-white border border-slate-200 shadow-xs hover:border-emerald-500/40 transition">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">Today's Attendance</span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 border border-emerald-100">
              <ClipboardCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <div>
              <span className="text-3xl font-extrabold text-slate-900">{attendanceRate}%</span>
              <span className="text-xs font-bold text-emerald-600 ml-1.5">Present</span>
            </div>
            <div className="text-[11px] font-semibold text-slate-400">
              {todayRecord?.date || todayStr}
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold">
            <span className="text-emerald-600">P: {presentCount}</span>
            <span className="text-rose-600">A: {absentCount}</span>
            <span className="text-amber-600">L: {lateCount}</span>
            <span className="text-blue-600">LV: {leaveCount}</span>
          </div>
        </div>

      </div>

      {/* Main Grid Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Attendance Details Breakdown (2 Cols) */}
        <div className="lg:col-span-2 p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Attendance Status Breakdown
              </h3>
              <p className="text-xs text-slate-500 mt-0.5 font-medium">
                Daily record for {todayRecord?.date || todayStr} ({todayRecord?.isLocked ? 'Locked' : 'Active'})
              </p>
            </div>
            <button
              onClick={() => onNavigate('attendance')}
              className="text-xs font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer"
            >
              Open Register <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Progress Bar Visual */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs font-bold text-slate-700">
              <span>Attendance Rate Progress ({presentCount + lateCount} / {totalStudents} Students)</span>
              <span>{attendanceRate}%</span>
            </div>
            <div className="h-3 rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
              <div style={{ width: `${(presentCount / totalStudents) * 100}%` }} className="bg-emerald-500 transition-all duration-500" />
              <div style={{ width: `${(lateCount / totalStudents) * 100}%` }} className="bg-amber-500 transition-all duration-500" />
              <div style={{ width: `${(leaveCount / totalStudents) * 100}%` }} className="bg-blue-500 transition-all duration-500" />
              <div style={{ width: `${(absentCount / totalStudents) * 100}%` }} className="bg-rose-500 transition-all duration-500" />
            </div>
          </div>

          {/* Status Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200/70">
              <div className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> Present
              </div>
              <div className="text-2xl font-black text-emerald-900 mt-1">{presentCount}</div>
            </div>

            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/70">
              <div className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                <UserX className="w-3.5 h-3.5" /> Absent
              </div>
              <div className="text-2xl font-black text-rose-900 mt-1">{absentCount}</div>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200/70">
              <div className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Late
              </div>
              <div className="text-2xl font-black text-amber-900 mt-1">{lateCount}</div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200/70">
              <div className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> On Leave
              </div>
              <div className="text-2xl font-black text-blue-900 mt-1">{leaveCount}</div>
            </div>
          </div>

          {/* Standard-Wise Breakdown */}
          <div className="pt-2">
            <h4 className="text-xs font-extrabold uppercase text-slate-500 mb-3 tracking-wider">
              Standard-wise Tablet Assignment
            </h4>
            <div className="space-y-2">
              {standardStats.map((st) => (
                <div key={st.standard} className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                  <span className="font-bold text-slate-800 w-20">{st.standard}</span>
                  <div className="flex-1 mx-4">
                    <div className="h-2 rounded-full bg-slate-200 overflow-hidden">
                      <div 
                        style={{ width: `${st.count > 0 ? (st.assigned / st.count) * 100 : 0}%` }}
                        className="h-full bg-blue-600 rounded-full"
                      />
                    </div>
                  </div>
                  <span className="text-slate-600 font-mono font-bold">
                    {st.assigned}/{st.count} ({st.count > 0 ? Math.round((st.assigned / st.count) * 100) : 0}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>

        {/* Right Actions & Tablet Boxes Vault (1 Col) */}
        <div className="space-y-6">
          
          {/* Quick Shortcuts */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Quick System Shortcuts</h3>
            
            <div className="space-y-2">
              <button
                onClick={() => onNavigate('attendance')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 font-bold text-xs transition border border-blue-200 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <ClipboardCheck className="w-4 h-4 text-blue-600" />
                  <span>Mark Attendance</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-blue-600" />
              </button>

              <button
                onClick={() => onNavigate('boxes')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 font-bold text-xs transition border border-amber-200 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Boxes className="w-4 h-4 text-amber-600" />
                  <span>Manage Tablet Boxes (Max 7)</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-amber-600" />
              </button>

              <button
                onClick={() => onNavigate('students')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-bold text-xs transition border border-emerald-200 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <Users className="w-4 h-4 text-emerald-600" />
                  <span>Student Directory</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-emerald-600" />
              </button>

              <button
                onClick={() => onNavigate('reports')}
                className="w-full flex items-center justify-between p-3 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-900 font-bold text-xs transition border border-purple-200 cursor-pointer"
              >
                <div className="flex items-center gap-2.5">
                  <FileSpreadsheet className="w-4 h-4 text-purple-600" />
                  <span>Export System Reports</span>
                </div>
                <ArrowUpRight className="w-3.5 h-3.5 text-purple-600" />
              </button>
            </div>
          </div>

          {/* Tablet Box Storage Grid */}
          <div className="p-6 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-500" />
                Tablet Storage Boxes
              </h3>
              <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                Max 7 Slots
              </span>
            </div>

            <div className="space-y-3">
              {boxes.map((box) => {
                const filled = box.tablets.length;

                return (
                  <div key={box.id} className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                    <div className="flex items-center justify-between font-bold text-slate-900">
                      <span>{box.boxNumber} - {box.boxName}</span>
                      <span className={filled === 7 ? 'text-rose-600 font-extrabold' : 'text-slate-600'}>
                        {filled} / 7 Slots
                      </span>
                    </div>
                    
                    {/* Visual 7-slot mini bar */}
                    <div className="grid grid-cols-7 gap-1">
                      {Array.from({ length: 7 }).map((_, idx) => (
                        <div
                          key={idx}
                          className={`h-2.5 rounded-xs transition-all ${
                            idx < filled ? 'bg-amber-500' : 'bg-slate-200'
                          }`}
                        />
                      ))}
                    </div>

                    <div className="text-[10px] text-slate-500 flex justify-between font-medium">
                      <span>{box.location}</span>
                      <span>{7 - filled} slots free</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
