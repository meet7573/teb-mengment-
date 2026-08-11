const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');
code = code.replace(
  /<p className="text-base font-bold text-slate-600">No students found<\/p>/,
  `<p className="text-base font-bold text-slate-600">No Data Found</p>`
);
fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', code);
