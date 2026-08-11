const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');
if (!code.includes('Clock,')) {
    code = code.replace(/import {/, 'import { Clock,');
    fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', code);
    console.log('Added Clock import');
} else {
    console.log('Clock import already exists');
}
