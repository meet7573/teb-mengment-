const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');

const returnIndex = code.indexOf('  return (\n    <div className="max-w-5xl');
if (returnIndex === -1) {
    console.error("Could not find the return statement");
    process.exit(1);
}

const beforeReturn = code.substring(0, returnIndex);

const newHandlers = `
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

`;

const newUI = `  return (
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
        </div>
      </div>

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
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredDetails.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-16 text-center text-slate-400">
                    <Search className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                    <p className="text-base font-bold text-slate-600">No students found</p>
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
                    <tr key={student.studentId} className="hover:bg-slate-50/50 transition-colors group">
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
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleSetStatus(student.studentId, 'Present')}
                            disabled={currentRecord.isLocked}
                            title="Mark Present"
                            className={\`p-2 rounded-lg flex items-center justify-center transition-colors \${isPresent && !isIn && !isOut ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-emerald-100 hover:text-emerald-600'}\`}
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleSetStatus(student.studentId, 'Absent')}
                            disabled={currentRecord.isLocked}
                            title="Mark Absent"
                            className={\`p-2 rounded-lg flex items-center justify-center transition-colors \${isAbsent ? 'bg-rose-500 text-white' : 'bg-slate-100 text-slate-500 hover:bg-rose-100 hover:text-rose-600'}\`}
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                          
                          <div className="w-px h-6 bg-slate-200 mx-1"></div>
                          
                          <button
                            onClick={() => handleCheckIn(student.studentId)}
                            disabled={currentRecord.isLocked || isIn || isOut}
                            title="Check In"
                            className={\`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center transition-colors \${isIn ? 'bg-blue-500 text-white shadow-sm ring-2 ring-blue-500 ring-offset-1' : 'bg-slate-100 text-slate-600 hover:bg-blue-100 hover:text-blue-700 disabled:opacity-40'}\`}
                          >
                            IN
                          </button>
                          <button
                            onClick={() => handleCheckOut(student.studentId)}
                            disabled={currentRecord.isLocked || !isIn}
                            title="Check Out"
                            className={\`px-3 py-2 rounded-lg text-xs font-bold flex items-center justify-center transition-colors \${isOut ? 'bg-purple-500 text-white shadow-sm ring-2 ring-purple-500 ring-offset-1' : 'bg-slate-100 text-slate-600 hover:bg-purple-100 hover:text-purple-700 disabled:opacity-40'}\`}
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
`;

const newCode = beforeReturn + newHandlers + newUI;
fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', newCode);
console.log('Successfully updated DigitalAttendance.tsx');
