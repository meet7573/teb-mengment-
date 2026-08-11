const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');

const returnIndex = code.indexOf('  return (\n    <div className="max-w-6xl');
if (returnIndex === -1) {
    console.error("Could not find the return statement");
    process.exit(1);
}

const beforeReturn = code.substring(0, returnIndex);
const afterReturn = code.substring(returnIndex);

const newHandlers = `
  const handleSetStatus = (studentId: string, status: AttendanceStatus) => {
    if (currentRecord.isLocked) return;
    const timeNow = getCurrentTime12h();
    const updated = activeDetails.map((d) => {
      if (d.studentId === studentId) {
        let checkIn = d.checkInTime;
        let checkOut = d.checkOutTime;
        if (status === 'Present' || status === 'Late') {
          if (!checkIn) checkIn = timeNow;
        } else if (status === 'Absent' || status === 'Leave') {
          checkIn = undefined;
          checkOut = undefined;
        }
        return {
          ...d,
          status,
          checkInTime: checkIn,
          checkOutTime: checkOut,
          totalDuration: calculateDuration(checkIn, checkOut, selectedDate),
          markedAt: new Date().toLocaleTimeString(),
        };
      }
      return d;
    });
    setActiveDetails(updated);
  };

  const handleCheckIn = (studentId: string) => {
    if (currentRecord.isLocked) return;
    const timeNow = getCurrentTime12h();
    const updated = activeDetails.map((d) => {
      if (d.studentId === studentId) {
        return {
          ...d,
          status: 'Checked In' as AttendanceStatus,
          checkInTime: timeNow,
          markedAt: new Date().toLocaleTimeString(),
        };
      }
      return d;
    });
    setActiveDetails(updated);
  };

  const handleCheckOut = (studentId: string) => {
    if (currentRecord.isLocked) return;
    const timeNow = getCurrentTime12h();
    const updated = activeDetails.map((d) => {
      if (d.studentId === studentId) {
        return {
          ...d,
          status: 'Checked Out' as AttendanceStatus,
          checkOutTime: timeNow,
          totalDuration: calculateDuration(d.checkInTime, timeNow, selectedDate),
          markedAt: new Date().toLocaleTimeString(),
        };
      }
      return d;
    });
    setActiveDetails(updated);
  };

`;

code = beforeReturn + newHandlers + afterReturn;
fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', code);
console.log('Added handlers');
