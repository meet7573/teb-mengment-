const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');

// 1. Filter out invalid/inactive students in the merge logic
const useE = `  useEffect(() => {
    const detailsMap = new Map<string, AttendanceDetail>(currentRecord.details.map(d => [d.studentId, d]));
    const validStudents = students.filter(s => s.name?.trim() && s.pinNumber?.trim() && s.status === 'Active');
    const mergedDetails: AttendanceDetail[] = validStudents.map(s => {`;
code = code.replace(/  useEffect\(\(\) => \{\n    const detailsMap = new Map<string, AttendanceDetail>\(currentRecord\.details\.map\(d => \[d\.studentId, d\]\)\);\n    const mergedDetails: AttendanceDetail\[\] = students\.map\(s => \{/, useE);

// 2. Add Mobile, Class, Batch to search
const matchSearch = `const query = search?.toLowerCase()?.trim() || '';
      const matchSearch =
        !query ||
        d.studentName?.toLowerCase()?.includes(query) ||
        d.pinNumber?.toLowerCase()?.includes(query) ||
        (d.assignedTabletNumber && d.assignedTabletNumber?.toLowerCase()?.includes(query)) ||
        d.standard?.toLowerCase()?.includes(query) ||
        (d.isCoachingStudent ? 'coaching' : 'regular').includes(query) ||
        ((d as any).mobileNumber && (d as any).mobileNumber?.toLowerCase()?.includes(query));`;

code = code.replace(/      const matchSearch =[\s\S]*?\(d\.assignedTabletNumber && d\.assignedTabletNumber\?\.toLowerCase\(\)\?\.includes\(search\?\.toLowerCase\(\)\)\);/, matchSearch);

fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', code);
console.log('Fixed attendance list');
