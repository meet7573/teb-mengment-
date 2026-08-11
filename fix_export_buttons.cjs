const fs = require('fs');
let code = fs.readFileSync('src/components/Attendance/DigitalAttendance.tsx', 'utf-8');

const oldHeaderButtons = `          <button 
            onClick={() => onNavigate && onNavigate('dashboard')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors border border-slate-200"
          >
            Back to Dashboard
          </button>`;

const newHeaderButtons = `          <button 
            onClick={() => onNavigate && onNavigate('dashboard')}
            className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-sm rounded-xl transition-colors border border-slate-200"
          >
            Back to Dashboard
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleExportPDF}
              className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold text-sm rounded-xl transition-colors border border-rose-200 flex items-center gap-2"
            >
              PDF
            </button>
            <button
              onClick={handleExportExcel}
              className="px-4 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold text-sm rounded-xl transition-colors border border-emerald-200 flex items-center gap-2"
            >
              Excel
            </button>
          </div>`;

code = code.replace(oldHeaderButtons, newHeaderButtons);

fs.writeFileSync('src/components/Attendance/DigitalAttendance.tsx', code);
