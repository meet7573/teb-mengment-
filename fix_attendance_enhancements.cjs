const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');

// 1. Add scanToast UI if not present
if (!code.includes('scanToast && (')) {
  code = code.replace(
    /\{\/\* Summary Cards \*\/\}/,
    `{scanToast && (
        <div className={\`p-4 rounded-xl font-bold text-sm flex items-center justify-center gap-2 shadow-sm mb-4 \${scanToast.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-rose-50 text-rose-700 border border-rose-100'}\`}>
          {scanToast.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          {scanToast.message}
        </div>
      )}
      
      {/* Summary Cards */}`
  );
}

// 2. Fix handleSaveAttendance to show success toast
code = code.replace(
  /onSaveAttendanceRecords\(updatedList\);\n  \};/,
  `onSaveAttendanceRecords(updatedList);
    setScanToast({ message: 'Attendance saved successfully!', type: 'success' });
    setTimeout(() => setScanToast(null), 3000);
  };`
);

// 3. Remove hover effect on tr
code = code.replace(
  /className="hover:bg-slate-50\/50 transition-colors group"/g,
  `className="hover:bg-slate-50/50 transition-colors"`
);

// 4. Remove opacity hiding on action buttons
code = code.replace(
  /className="flex items-center justify-end gap-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"/g,
  `className="flex items-center justify-end gap-2"`
);

// 5. Add Tab Use Time to Table Headers
code = code.replace(
  /<th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Time<\/th>/g,
  `<th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Time</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Tab Use Time</th>`
);

// 6. Add Tab Use Time to Table Rows
const tabUseTimeHtml = `
                      <td className="px-6 py-4">
                        <span className="text-sm font-bold text-slate-700">
                          {isIn ? (
                            <span className="text-blue-600 animate-pulse flex items-center gap-1.5"><Clock className="w-4 h-4"/> Running...</span>
                          ) : isOut ? (
                            student.totalDuration || calculateDuration(student.checkInTime, student.checkOutTime, selectedDate)
                          ) : (
                            '--'
                          )}
                        </span>
                      </td>`;
code = code.replace(
  /<td className="px-6 py-4 text-right">/g,
  `${tabUseTimeHtml}
                      <td className="px-6 py-4 text-right">`
);

fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', code);
console.log('Fixed attendance enhancements');
