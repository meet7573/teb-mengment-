const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf-8');

const alertLogic = `
async function checkAndSendAbsenceAlerts(studentId, date) {
  const records = appDb.attendance
    .filter(a => a.student_id === studentId)
    .sort((a, b) => b.attendance_date.localeCompare(a.attendance_date));
  
  let consecutiveAbsences = 0;
  for (const record of records) {
    if (record.status === 'Absent') {
      consecutiveAbsences++;
    } else if (record.status === 'Present') {
      break;
    }
  }

  // "More than three consecutive days" -> > 3 (so 4 or more)
  if (consecutiveAbsences > 3) {
    const student = appDb.students.find(s => s.pin_no === studentId);
    if (student) {
      const parentEmail = \`parent_\${studentId}@example.com\`; // Mock email
      const subject = \`Absence Alert: \${student.name}\`;
      const text = \`Dear Parent/Guardian,\\n\\nThis is an automated alert. Your ward, \${student.name}, has been marked absent for \${consecutiveAbsences} consecutive days as of \${date}. Please contact the administration.\\n\\nRegards,\\nAttendance System\`;
      
      // We will only send this if we haven't sent it recently.
      // To keep it simple, we just call sendMail here.
      await sendMail(parentEmail, subject, text);
    }
  }
}
`;

if (!code.includes('checkAndSendAbsenceAlerts')) {
  code = code.replace('// Attendance API', alertLogic + '\n// Attendance API');
  
  // Now inject into POST /api/attendance
  code = code.replace(
    /saveAppDB\(\);\n\s*res\.json\(\{ message: 'Attendance saved successfully' \}\);/,
    `saveAppDB();
    for (const record of attendance) {
      if (record.status === 'Absent') {
         await checkAndSendAbsenceAlerts(record.pin_no, date);
      }
    }
    res.json({ message: 'Attendance saved successfully' });`
  );

  // Inject into POST /api/sync/attendance
  code = code.replace(
    /saveAppDB\(\);\n\s*res\.json\(\{ message: 'Attendance synced successfully' \}\);/,
    `saveAppDB();
    const checked = new Set();
    for (const record of records) {
      const date = record.date;
      for (const detail of record.details) {
         if (detail.status === 'Absent' && !checked.has(detail.studentId)) {
           checked.add(detail.studentId);
           await checkAndSendAbsenceAlerts(detail.studentId, date);
         }
      }
    }
    res.json({ message: 'Attendance synced successfully' });`
  );
  
  fs.writeFileSync('server.ts', code);
  console.log('Injected logic');
} else {
  console.log('Already injected');
}
