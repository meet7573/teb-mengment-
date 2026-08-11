const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');

// The new handlers we added start at line 813 and go up to the return statement.
// We can just regex replace them.
const replaceRegex = /  const handleCheckIn = \(studentId: string\) => \{[\s\S]*?setActiveDetails\(updated\);\n  \};\n\n/g;
code = code.replace(replaceRegex, '');

fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', code);
console.log('Removed duplicates');
