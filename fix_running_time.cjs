const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');

// We need to add a small component at the top to handle the interval for live duration.
// Since DigitalAttendance.tsx is getting big, let's just create an inline component.

const liveDurationComponent = `
const RunningDuration = ({ checkInTime, selectedDate }: { checkInTime: string, selectedDate: string }) => {
  const [duration, setDuration] = useState(calculateDuration(checkInTime, undefined, selectedDate));

  useEffect(() => {
    const timer = setInterval(() => {
      setDuration(calculateDuration(checkInTime, undefined, selectedDate));
    }, 60000); // update every minute
    return () => clearInterval(timer);
  }, [checkInTime, selectedDate]);

  return (
    <span className="text-blue-600 animate-pulse flex items-center gap-1.5">
      <Clock className="w-4 h-4"/> {duration}
    </span>
  );
};
`;

code = code.replace(
  /export const DigitalAttendance: React\.FC<DigitalAttendanceProps> = \(\{/,
  `${liveDurationComponent}\nexport const DigitalAttendance: React.FC<DigitalAttendanceProps> = ({`
);

const oldRunningText = `<span className="text-blue-600 animate-pulse flex items-center gap-1.5"><Clock className="w-4 h-4"/> Running...</span>`;
const newRunningText = `<RunningDuration checkInTime={student.checkInTime || ''} selectedDate={selectedDate} />`;

code = code.replace(oldRunningText, newRunningText);

fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', code);
