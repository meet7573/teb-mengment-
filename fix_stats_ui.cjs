const fs = require('fs');
let code = fs.readFileSync('src/components/Students/StudentManagement.tsx', 'utf-8');

code = code.replace(
  /<div className="p-4 bg-white rounded-2xl border border-slate-200\/80 shadow-2xs">/g,
  '<div className="p-5 bg-white rounded-3xl border border-slate-200 shadow-sm">'
);

code = code.replace(
  /<div className="p-4 bg-white rounded-2xl border border-emerald-200\/80 shadow-2xs">/g,
  '<div className="p-5 bg-white rounded-3xl border border-emerald-200 shadow-sm">'
);

code = code.replace(
  /<div className="p-4 bg-white rounded-2xl border border-amber-200\/80 shadow-2xs">/g,
  '<div className="p-5 bg-white rounded-3xl border border-amber-200 shadow-sm">'
);

code = code.replace(
  /<div className="p-4 bg-white rounded-2xl border border-rose-200\/80 shadow-2xs">/g,
  '<div className="p-5 bg-white rounded-3xl border border-rose-200 shadow-sm">'
);

fs.writeFileSync('src/components/Students/StudentManagement.tsx', code);
