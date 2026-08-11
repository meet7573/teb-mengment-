const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');

code = code.replace(
  /const validStudents = students\.filter\(s => s\.name\?\.trim\(\) && s\.pinNumber\?\.trim\(\) && s\.status === 'Active'\);/,
  `const validStudents = students
      .filter(s => s.name?.trim() && s.pinNumber?.trim() && s.status === 'Active')
      .filter((s, index, self) => index === self.findIndex((t) => t.id === s.id));`
);

fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', code);
