const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');

code = code.replace(
  /        \(\(d as any\)\.mobileNumber && \(d as any\)\.mobileNumber\?\.toLowerCase\(\)\?\.includes\(query\)\);/,
  `        ((d as any).mobileNumber && (d as any).mobileNumber?.toLowerCase()?.includes(query)) ||
        d.studentId?.toLowerCase()?.includes(query);`
);

fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', code);
