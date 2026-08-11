import React, { useState, useMemo } from 'react';
import { 
  BarChart3, 
  FileSpreadsheet, 
  FileText, 
  Printer, 
  Users, 
  Sparkles,
  Filter,
  Calendar,
  CheckCircle2,
  XCircle,
  Percent,
  Download
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { Student, Tablet as TabletType, TabletBox, DailyAttendanceRecord, UserRole } from '../../types';
import { exportToExcel, exportToPDF, printDocument } from '../../utils/exportUtils';
import { logAuditAction } from '../../utils/storage';

interface ReportsViewProps {
  students: Student[];
  tablets: TabletType[];
  boxes: TabletBox[];
  attendanceRecords: DailyAttendanceRecord[];
  activeRole: UserRole;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  students,
  tablets,
  boxes,
  attendanceRecords,
  activeRole,
}) => {
  const [reportType, setReportType] = useState<
    'Daily' | 'Weekly' | 'Monthly' | 'Student' | 'Standard' | 'Coaching' | 'Tablet' | 'Box'
  >('Daily');

  // Daily Report Filters (Requirement 11)
  const [selectedDate, setSelectedDate] = useState<string>(
    () => attendanceRecords[0]?.date || new Date().toISOString().slice(0, 10)
  );
  const [selectedStandard, setSelectedStandard] = useState<string>('All');

  // Compute Daily Attendance Data specifically filtered & sorted by Student PIN ascending (Requirement 4, 7, 12)
  const dailyReportData = useMemo(() => {
    const record = attendanceRecords.find((r) => r.date === selectedDate);
    const detailsMap = new Map();
    if (record) {
      record.details.forEach((d) => detailsMap.set(d.studentId, d));
    }

    const filtered = students.filter((s) => {
      return selectedStandard === 'All' || s.standard === selectedStandard;
    });

    const rows = filtered.map((s) => {
      const detail = detailsMap.get(s.id);

      const checkIn = detail?.checkInTime && detail.checkInTime.trim() !== '' ? detail.checkInTime : '-';
      const checkOut = detail?.checkOutTime && detail.checkOutTime.trim() !== '' ? detail.checkOutTime : '-';

      let statusText: 'Present' | 'Absent' = 'Absent';
      if (detail) {
        if (
          detail.status === 'Present' ||
          detail.status === 'Checked In' ||
          detail.status === 'Checked Out' ||
          detail.status === 'Late' ||
          (detail.checkInTime && detail.checkInTime !== '-')
        ) {
          statusText = 'Present';
        }
      }

      return {
        pinNumber: s.pinNumber,
        studentName: s.name,
        standard: s.standard,
        checkInTime: checkIn,
        checkOutTime: checkOut,
        status: statusText,
      };
    });

    // Sort by Student PIN ascending
    rows.sort((a, b) =>
      a.pinNumber.localeCompare(b.pinNumber, undefined, { numeric: true, sensitivity: 'base' })
    );

    return rows.map((r, idx) => ({
      'Sr. No.': idx + 1,
      'Student PIN': r.pinNumber,
      'Student Name': r.studentName,
      'Standard/Class': r.standard,
      'IN Time': r.checkInTime,
      'OUT Time': r.checkOutTime,
      'Status': r.status,
    }));
  }, [attendanceRecords, students, selectedDate, selectedStandard]);

  // Daily Summary Statistics
  const dailySummary = useMemo(() => {
    const total = dailyReportData.length;
    const present = dailyReportData.filter((r) => r['Status'] === 'Present').length;
    const absent = total - present;
    const rate = total > 0 ? ((present / total) * 100).toFixed(1) + '%' : '0.0%';
    return { total, present, absent, rate };
  }, [dailyReportData]);

  // Calculate trend data for the last 30 days
  const trendData = useMemo(() => {
    // Sort all records by date
    const sortedRecords = [...attendanceRecords].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    
    // Take the last 30 days
    const last30Days = sortedRecords.slice(-30);
    
    return last30Days.map(record => {
      let present = 0;
      let absent = 0;
      
      record.details.forEach(detail => {
        if (
          detail.status === 'Present' ||
          detail.status === 'Checked In' ||
          detail.status === 'Checked Out' ||
          detail.status === 'Late' ||
          (detail.checkInTime && detail.checkInTime !== '-')
        ) {
          present++;
        } else {
          absent++;
        }
      });
      
      // format date to "MMM DD"
      const dateObj = new Date(record.date);
      const formattedDate = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

      return {
        date: formattedDate,
        present,
        absent
      };
    });
  }, [attendanceRecords]);
  const reportData = useMemo(() => {
    switch (reportType) {
      case 'Daily':
        return dailyReportData;

      case 'Weekly':
      case 'Monthly': {
        return students.map((s) => {
          let presentDays = 0;
          let absentDays = 0;
          let lateDays = 0;
          let totalDays = 0;

          attendanceRecords.forEach((r) => {
            const detail = r.details.find((d) => d.studentId === s.id);
            if (detail) {
              totalDays++;
              if (detail.status === 'Present' || detail.status === 'Checked In' || detail.status === 'Checked Out') presentDays++;
              else if (detail.status === 'Absent') absentDays++;
              else if (detail.status === 'Late') lateDays++;
            }
          });

          const rate = totalDays > 0 ? Math.round(((presentDays + lateDays) / totalDays) * 100) : 100;

          return {
            'PIN Number': s.pinNumber,
            'Student Name': s.name,
            'Standard': s.standard,
            'Coaching Student': s.isCoachingStudent ? 'Yes' : 'No',
            'Days Tracked': totalDays,
            'Days Present': presentDays,
            'Days Late': lateDays,
            'Days Absent': absentDays,
            'Attendance Rate %': `${rate}%`,
          };
        });
      }

      case 'Student': {
        return students.map((s) => ({
          'PIN Number': s.pinNumber,
          'Student Name': s.name,
          'Standard': s.standard,
          'Coaching Batch': s.isCoachingStudent ? 'Yes' : 'No',
          'Assigned Tablet': s.assignedTabletNumber || 'Unassigned',
          'Status': s.status,
        }));
      }

      case 'Standard': {
        const standards = ['Std 8', 'Std 9', 'Std 10', 'Std 11', 'Std 12'];
        return standards.map((std) => {
          const stdStudents = students.filter((s) => s.standard === std);
          const assignedCount = stdStudents.filter((s) => s.assignedTabletId).length;
          const coachingCount = stdStudents.filter((s) => s.isCoachingStudent).length;

          return {
            'Standard Grade': std,
            'Total Enrolled Students': stdStudents.length,
            'Coaching Students': coachingCount,
            'Regular Students': stdStudents.length - coachingCount,
            'Tablets Assigned': assignedCount,
            'Tablet Allocation Rate': `${stdStudents.length > 0 ? Math.round((assignedCount / stdStudents.length) * 100) : 0}%`,
          };
        });
      }

      case 'Coaching': {
        const coachingStudents = students.filter((s) => s.isCoachingStudent);
        return coachingStudents.map((s) => ({
          'PIN Number': s.pinNumber,
          'Student Name': s.name,
          'Standard': s.standard,
          'Assigned Tablet': s.assignedTabletNumber || 'Unassigned',
          'Status': s.status,
        }));
      }

      case 'Tablet': {
        return tablets.map((t) => ({
          'Asset Tag': t.tabletNumber,
          'Device Name': t.tabletName,
          'Brand': t.brand,
          'Model': t.model,
          'Storage Box': t.boxNumber || 'Unboxed',
          'Status': t.status,
          'Assigned Student': t.assignedToStudentName || 'Available',
          'Entry Date': t.entryDate,
        }));
      }

      case 'Box': {
        return boxes.map((b) => ({
          'Box Number': b.boxNumber,
          'Box Vault Name': b.boxName,
          'Location': b.location,
          'Capacity Limit': '7 Tablets Max',
          'Current Devices Stored': `${b.tablets.length} / 7`,
          'Available Slots': 7 - b.tablets.length,
          'Status': b.tablets.length >= 7 ? 'Full Capacity' : 'Space Available',
        }));
      }

      default:
        return [];
    }
  }, [reportType, dailyReportData, students, tablets, boxes, attendanceRecords]);

  // Dedicated Daily Attendance PDF Generator Trigger
  const handleDownloadDailyPDF = () => {
    const headers = Object.keys(dailyReportData[0] || {});
    const rows = dailyReportData.map(d => Object.values(d));
    exportToPDF(`Daily Attendance - ${selectedDate}`, headers, rows, `Attendance_${selectedDate}`);
    logAuditAction('System User', activeRole, 'PDF_EXPORT', 'Attendance', `Exported Daily Attendance PDF Report for ${selectedDate}`);
  };

  // Generic Export handlers
  const handleExportExcel = () => {
    exportToExcel(reportData, `${reportType}_Report_${selectedDate}`);
    logAuditAction('System User', activeRole, 'EXCEL_EXPORT', 'System', `Exported ${reportType} report to Excel`);
  };

  const handleExportPDF = () => {
    if (reportType === 'Daily') {
      handleDownloadDailyPDF();
      return;
    }
    if (reportData.length === 0) return;
    const headers = Object.keys(reportData[0]);
    const rows = reportData.map((obj) => Object.values(obj) as (string | number)[]);
    exportToPDF(`${reportType} Comprehensive Academic Report`, headers, rows, `${reportType}_Report`);
    logAuditAction('System User', activeRole, 'PDF_EXPORT', 'System', `Exported ${reportType} report to PDF`);
  };

  return (
    <div className="space-y-6">
      
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-indigo-600" />
            Institutional Reports & Data Exports
          </h2>
          <p className="text-xs text-slate-500">
            Generate and download official Daily Attendance PDF reports, weekly summaries, and device audit logs
          </p>
        </div>

        <div className="flex items-center gap-2">
          {reportType === 'Daily' ? (
            <button
              onClick={handleDownloadDailyPDF}
              className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-rose-600/20"
            >
              <Download className="w-4 h-4" />
              <span>Download PDF</span>
            </button>
          ) : (
            <button
              onClick={handleExportPDF}
              className="px-3.5 py-2 rounded-xl bg-rose-50 text-rose-700 hover:bg-rose-100 font-semibold text-xs border border-rose-200 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
            >
              <FileText className="w-4 h-4" />
              <span>Export PDF</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="px-3.5 py-2 rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-semibold text-xs border border-emerald-200 transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Export Excel</span>
          </button>

          <button
            onClick={printDocument}
            className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector Pills */}
      <div className="p-2 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-wrap gap-1">
        {[
          { id: 'Daily', label: 'Daily Attendance Report' },
          { id: 'Weekly', label: 'Weekly Summary' },
          { id: 'Monthly', label: 'Monthly Summary' },
          { id: 'Student', label: 'Student Directory' },
          { id: 'Standard', label: 'Standard Breakdown' },
          { id: 'Coaching', label: 'Coaching Students' },
          { id: 'Tablet', label: 'Tablet Fleet' },
          { id: 'Box', label: 'Box Vault Audit' },
        ].map((item) => (
          <button
            key={item.id}
            onClick={() => setReportType(item.id as any)}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              reportType === item.id
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Filter Section for Daily Attendance PDF Report (Requirement 11) */}
      {reportType === 'Daily' && (
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Daily Attendance PDF Report Parameters
              </h3>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Filters apply directly to generated PDF & preview table
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 items-end">
            
            {/* Filter 1: Date (Required) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                <span>Attendance Date (Required)</span>
              </label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                required
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 transition"
              />
            </div>

            {/* Filter 2: Standard/Class (Optional) */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">
                Standard / Class (Optional)
              </label>
              <select
                value={selectedStandard}
                onChange={(e) => setSelectedStandard(e.target.value)}
                className="w-full px-3.5 py-2 rounded-xl border border-slate-300 bg-slate-50 focus:bg-white text-xs text-slate-900 font-bold outline-none focus:border-indigo-600 transition"
              >
                <option value="All">All Standards (Std 8 - 12)</option>
                <option value="Std 8">Std 8</option>
                <option value="Std 9">Std 9</option>
                <option value="Std 10">Std 10</option>
                <option value="Std 11">Std 11</option>
                <option value="Std 12">Std 12</option>
              </select>
            </div>

            {/* Download PDF Trigger Button */}
            <div>
              <button
                onClick={handleDownloadDailyPDF}
                className="w-full py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-600/20 transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF Report</span>
              </button>
            </div>

          </div>

          {/* Daily Attendance Summary Cards (Requirement 5) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Total Students</span>
                <Users className="w-4 h-4 text-slate-400" />
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1 font-mono">
                {dailySummary.total}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">Present Students</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <div className="text-2xl font-black text-emerald-700 mt-1 font-mono">
                {dailySummary.present}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-rose-50/80 border border-rose-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider">Absent Students</span>
                <XCircle className="w-4 h-4 text-rose-600" />
              </div>
              <div className="text-2xl font-black text-rose-700 mt-1 font-mono">
                {dailySummary.absent}
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-indigo-50/80 border border-indigo-200">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider">Attendance Rate</span>
                <Percent className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="text-2xl font-black text-indigo-700 mt-1 font-mono">
                {dailySummary.rate}
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 30 Days Attendance Trends Chart */}
      {reportType === 'Daily' && trendData.length > 0 && (
        <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                Daily Attendance Trends (Last 30 Days)
              </h3>
            </div>
          </div>
          
          <div className="w-full h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis 
                  dataKey="date" 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#64748B' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: '#64748B' }}
                />
                <Tooltip 
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{ borderRadius: '12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                  labelStyle={{ fontSize: '12px', color: '#64748B', marginBottom: '4px' }}
                />
                <Legend 
                  wrapperStyle={{ fontSize: '11px', fontWeight: '600', paddingTop: '10px' }}
                  iconType="circle"
                />
                <Bar dataKey="present" name="Present" fill="#10B981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                <Bar dataKey="absent" name="Absent" fill="#F43F5E" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Report Preview Table */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden text-xs">
        
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="font-bold text-slate-900 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span>{reportType} Academic & Hardware Report Preview</span>
          </div>
          <div className="text-[11px] font-mono text-slate-500">
            Total Records: {reportData.length}
          </div>
        </div>

        <div className="overflow-x-auto">
          {reportData.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              No report records found for the selected filter parameters.
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-100/70 text-slate-600 font-bold uppercase tracking-wider border-b border-slate-200">
                  {Object.keys(reportData[0]).map((key) => (
                    <th key={key} className="py-3 px-4">
                      {key}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reportData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition">
                    {Object.entries(row).map(([key, val], cellIdx) => {
                      const isStatusCol = key === 'Status' || key === 'Attendance Status';
                      const isPresent = val === 'Present' || val === 'Checked In' || val === 'Checked Out';
                      return (
                        <td key={cellIdx} className="py-3 px-4 text-slate-800 font-medium">
                          {isStatusCol ? (
                            <span
                              className={`px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                isPresent
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-800'
                              }`}
                            >
                              {String(val)}
                            </span>
                          ) : (
                            String(val)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>

    </div>
  );
};

