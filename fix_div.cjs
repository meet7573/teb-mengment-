const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');

// The main wrapper is `    <div className="max-w-5xl mx-auto space-y-6 pb-28 font-sans text-slate-800 relative min-h-screen">`
// Let's add a closing </div> right before the modals!

code = code.replace('{/* Student Attendance History Modal */}', '</div>\n\n      {/* Student Attendance History Modal */}');

fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', code);
