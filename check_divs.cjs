const fs = require('fs');
const code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');
const returnStart = code.indexOf('return (');
const ui = code.substring(returnStart);
const opens = (ui.match(/<div/g) || []).length;
const closes = (ui.match(/<\/div>/g) || []).length;
console.log(`Opens: ${opens}, Closes: ${closes}`);
