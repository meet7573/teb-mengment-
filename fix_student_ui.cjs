const fs = require('fs');
let code = fs.readFileSync('src/components/Students/StudentManagement.tsx', 'utf-8');

// Update Table Headers
code = code.replace(
  /<th className="py-3\.5 px-4">Student Info<\/th>\n                <th className="py-3\.5 px-4">PIN Number<\/th>\n                <th className="py-3\.5 px-4">Standard<\/th>\n                <th className="py-3\.5 px-4">Coaching Batch<\/th>\n                <th className="py-3\.5 px-4">Assigned Tablet<\/th>\n                <th className="py-3\.5 px-4">Status<\/th>\n                <th className="py-3\.5 px-4 text-right">Actions<\/th>/,
  `<th className="py-4 px-6 text-left">Student Info</th>
                <th className="py-4 px-6 text-center">PIN Number</th>
                <th className="py-4 px-6 text-center">Standard</th>
                <th className="py-4 px-6 text-center">Coaching Batch</th>
                <th className="py-4 px-6 text-center">Assigned Tablet</th>
                <th className="py-4 px-6 text-center">Status</th>
                <th className="py-4 px-6 text-right">Actions</th>`
);

// Update Tbody Rows

code = code.replace(/<td className="py-3\.5 px-4">/g, '<td className="py-4 px-6 text-left">');

// We have 6 '<td className="py-4 px-6 text-left">' now per row, but some need to be center aligned.
// Let's replace the first one with left, and the next 4 with center.
// Actually, it's easier to just do a string replace on the specific structure.
code = code.replace(/<td className="py-4 px-6 text-left">\n\s*<span className="font-mono font-bold text-indigo-600/g, '<td className="py-4 px-6 text-center">\n                      <span className="font-mono font-bold text-indigo-600');
code = code.replace(/<td className="py-4 px-6 text-left">\n\s*<span className="font-semibold text-slate-800">/g, '<td className="py-4 px-6 text-center">\n                      <span className="font-semibold text-slate-800">');
code = code.replace(/<td className="py-4 px-6 text-left">\n\s*\{s\.isCoachingStudent \?/g, '<td className="py-4 px-6 text-center">\n                      {s.isCoachingStudent ?');
code = code.replace(/<td className="py-4 px-6 text-left">\n\s*\{s\.assignedTabletNumber \?/g, '<td className="py-4 px-6 text-center">\n                      {s.assignedTabletNumber ?');
code = code.replace(/<td className="py-4 px-6 text-left">\n\s*\{s\.status === 'Active' \?/g, '<td className="py-4 px-6 text-center">\n                      {s.status === \'Active\' ?');

code = code.replace(/<td className="py-3\.5 px-4 text-right">/g, '<td className="py-4 px-6 text-right">');

// Ensure button/actions are aligned right
code = code.replace(
  /<div className="flex items-center justify-end gap-1">/g,
  '<div className="flex items-center justify-end gap-1.5">'
);

// Update padding and fonts for the "No Student Records found" message
code = code.replace(
  /<td colSpan=\{7\} className="py-12 text-center text-slate-400 font-medium">\n\s*No student records found matching search filters\.\n\s*<\/td>/,
  `<td colSpan={7} className="py-20 text-center text-slate-500 font-semibold bg-slate-50/50">\n                    No student records found matching search filters.\n                  </td>`
);

// We need to ensure that the flex container of headers/buttons has the right style.
// The image shows very specific colored buttons.
// Import: Yellow border
// Export Excel: Green border
// Export PDF: Red border
// Add Student: Solid blue

// They already look like that in our code!
// Import: bg-amber-50 text-amber-800 border-amber-200
// Export Excel: bg-emerald-50 text-emerald-700 border-emerald-200
// Export PDF: bg-rose-50 text-rose-700 border-rose-200
// Add Student: bg-indigo-600 text-white
// So buttons are fine.

// Let's check spacing for header row
code = code.replace(
  /<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">/g,
  '<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">'
);

code = code.replace(
  /<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">/g,
  '<div className="grid grid-cols-2 sm:grid-cols-4 gap-4">'
);

code = code.replace(
  /<div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">/g,
  '<div className="p-5 rounded-3xl bg-white border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">'
);

code = code.replace(
  /<div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">/g,
  '<div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">'
);

// To make Assing Tablet button center:
code = code.replace(
  /className="px-2\.5 py-1 rounded-lg bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-\[11px\] font-semibold transition flex items-center gap-1 cursor-pointer border border-slate-200"/g,
  'className="mx-auto px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200 shadow-sm"'
);

// Center the pill of Coaching Student and Regular Batch
code = code.replace(
  /<span className="px-2\.5 py-1 rounded-full text-\[10px\] font-bold bg-amber-50 text-amber-700 border border-amber-200">/g,
  '<span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">'
);
code = code.replace(
  /<span className="px-2\.5 py-1 rounded-full text-\[10px\] font-medium bg-slate-100 text-slate-500">/g,
  '<span className="inline-flex px-3 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-600 border border-slate-200">'
);

// Ensure the page doesn't have a max width on main in App.tsx
// I will check App.tsx as well.

fs.writeFileSync('src/components/Students/StudentManagement.tsx', code);
