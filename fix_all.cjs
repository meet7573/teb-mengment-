const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');

// I will remove all declarations of handleSetStatus, handleCheckIn, handleCheckOut using simple parsing
// It's safer to just let the script do it.

const returnIndex = code.indexOf('  return (\n    <div className="max-w-6xl');
let beforeReturn = code.substring(0, returnIndex);
let afterReturn = code.substring(returnIndex);

function removeFunc(name, str) {
  let startIndex = str.indexOf(`  const ${name} =`);
  if (startIndex === -1) return str;
  // find the end of the function block. we can count brackets.
  let bracketCount = 0;
  let inFunc = false;
  let endIndex = -1;
  for (let i = startIndex; i < str.length; i++) {
    if (str[i] === '{') {
      inFunc = true;
      bracketCount++;
    } else if (str[i] === '}') {
      bracketCount--;
      if (inFunc && bracketCount === 0) {
        endIndex = i + 1; // include closing bracket
        // skip trailing semicolon and newline if any
        if (str[endIndex] === ';') endIndex++;
        if (str[endIndex] === '\n') endIndex++;
        break;
      }
    }
  }
  if (endIndex !== -1) {
    return str.substring(0, startIndex) + removeFunc(name, str.substring(endIndex));
  }
  return str;
}

beforeReturn = removeFunc('handleSetStatus', beforeReturn);
beforeReturn = removeFunc('handleCheckIn', beforeReturn);
beforeReturn = removeFunc('handleCheckOut', beforeReturn);

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

fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', beforeReturn + newHandlers + afterReturn);
console.log('Fixed handlers cleanly');
