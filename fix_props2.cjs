const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');
code = code.replace(
  'activeRole,\n}) => {',
  'activeRole,\n  onNavigate,\n}) => {'
);
fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', code);
