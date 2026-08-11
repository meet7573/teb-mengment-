const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');

// 1. Add state for inTimeFilter and outTimeFilter
code = code.replace(
  /const \[selectedStatusFilter, setSelectedStatusFilter\] = useState<string>\('All'\);/,
  `const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('All');
  const [inTimeFilter, setInTimeFilter] = useState<string>('');
  const [outTimeFilter, setOutTimeFilter] = useState<string>('');`
);

// 2. Add filtering logic for inTimeFilter and outTimeFilter
code = code.replace(
  /      return matchSearch && matchStd && matchCoaching && matchStatus;\n    \}\);\n  \}, \[activeDetails, search, selectedStandard, selectedCoaching, selectedStatusFilter\]\);/,
  `      const matchInTime = !inTimeFilter || (d.checkInTime && d.checkInTime?.toLowerCase()?.includes(inTimeFilter?.toLowerCase()));
      const matchOutTime = !outTimeFilter || (d.checkOutTime && d.checkOutTime?.toLowerCase()?.includes(outTimeFilter?.toLowerCase()));

      return matchSearch && matchStd && matchCoaching && matchStatus && matchInTime && matchOutTime;
    });
  }, [activeDetails, search, selectedStandard, selectedCoaching, selectedStatusFilter, inTimeFilter, outTimeFilter]);`
);

// 3. Add filter UI
const filterHtml = `          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shrink-0">
            <Clock className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="In Time (e.g. 09:00)"
              value={inTimeFilter}
              onChange={(e) => setInTimeFilter(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none w-32 placeholder:font-normal"
            />
          </div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 px-3 py-2 rounded-xl shrink-0">
            <Clock className="w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Out Time (e.g. 05:00)"
              value={outTimeFilter}
              onChange={(e) => setOutTimeFilter(e.target.value)}
              className="bg-transparent text-sm font-semibold text-slate-700 outline-none w-32 placeholder:font-normal"
            />
          </div>`;

code = code.replace(
  /<option value="No">Regular<\/option>\n            <\/select>\n          <\/div>\n        <\/div>/,
  `<option value="No">Regular</option>
            </select>
          </div>
${filterHtml}
        </div>`
);

fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', code);
console.log('Fixed attendance filters');
