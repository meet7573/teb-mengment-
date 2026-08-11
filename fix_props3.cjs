const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');
const search = 'export const DigitalAttendance: React.FC<DigitalAttendanceProps> = ({\n  students,\n  attendanceRecords,\n  onSaveAttendanceRecords,\n  activeRole,\n}) => {';
const replace = 'export const DigitalAttendance: React.FC<DigitalAttendanceProps> = ({\n  students,\n  attendanceRecords,\n  onSaveAttendanceRecords,\n  activeRole,\n  onNavigate,\n}) => {';
if (code.includes(search)) {
  code = code.replace(search, replace);
  fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', code);
  console.log('Fixed props');
} else {
  console.log('Could not find match');
}
