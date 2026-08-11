const fs = require('fs');

let serverCode = fs.readFileSync('server.ts', 'utf-8');

// Remove sqlite imports
serverCode = serverCode.replace("import sqlite3 from 'sqlite3';\nimport { open } from 'sqlite';\n", "");

// Replace initialization
serverCode = serverCode.replace(/let sqlDb: any;[\s\S]*?console\.log\('SQLite Database initialized'\);/m, 
`let appDb: { students: any[], attendance: any[] } = { students: [], attendance: [] };
const dbAppFile = path.join(dataDir, 'app_data.json');

function saveAppDB() {
  fs.writeFileSync(dbAppFile, JSON.stringify(appDb, null, 2));
}

  if (fs.existsSync(dbAppFile)) {
    try {
      appDb = JSON.parse(fs.readFileSync(dbAppFile, 'utf-8'));
    } catch (e) {
      appDb = { students: [], attendance: [] };
    }
  } else {
    saveAppDB();
  }
  console.log('JSON Database initialized');`);

// Find the block where endpoints are defined, from // Students API down to the end of the /api/sync/all
serverCode = serverCode.replace(/\/\/ Students API[\s\S]*?res\.status\(500\)\.json\(\{ error: 'Internal server error' \}\);\n  \}\n\}\);/m, 
`// Students API
app.get('/api/students', async (req, res) => {
  try {
    const students = [...appDb.students].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/students', async (req, res) => {
  try {
    const { pin_no, name, std, course } = req.body;
    
    if (appDb.students.some(s => s.pin_no === pin_no)) {
      return res.status(400).json({ error: 'Student with this PIN already exists' });
    }

    appDb.students.push({
      pin_no, name, std, course, created_at: new Date().toISOString()
    });
    saveAppDB();
    
    res.json({ message: 'Student added successfully' });
  } catch (error: any) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.delete('/api/students/:pin_no', async (req, res) => {
  try {
    const { pin_no } = req.params;
    appDb.attendance = appDb.attendance.filter(a => a.student_id !== pin_no);
    appDb.students = appDb.students.filter(s => s.pin_no !== pin_no);
    saveAppDB();
    res.json({ message: 'Student deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Attendance API
app.get('/api/attendance/:date', async (req, res) => {
  try {
    const { date } = req.params;
    
    const result = appDb.students.map((student: any) => {
      const record = appDb.attendance.find((r: any) => r.student_id === student.pin_no && r.attendance_date === date);
      return {
        ...student,
        status: record ? record.status : 'Absent'
      };
    });
    
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/attendance', async (req, res) => {
  try {
    const { date, attendance } = req.body;
    
    for (const record of attendance) {
      const existing = appDb.attendance.find(a => a.student_id === record.pin_no && a.attendance_date === date);
      if (existing) {
        existing.status = record.status;
      } else {
        appDb.attendance.push({
          id: Date.now() + Math.random(),
          student_id: record.pin_no,
          attendance_date: date,
          status: record.status,
          created_at: new Date().toISOString()
        });
      }
    }
    
    saveAppDB();
    res.json({ message: 'Attendance saved successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/reports', async (req, res) => {
  try {
    const datesRaw = Array.from(new Set(appDb.attendance.map(a => a.attendance_date))).sort((a: string, b: string) => b.localeCompare(a)).slice(0, 30);
    
    const reports = [];
    
    for (const date of datesRaw) {
      const records = appDb.attendance.filter((r: any) => r.attendance_date === date);
      const present = records.filter((r: any) => r.status === 'Present').length;
      const absent = records.filter((r: any) => r.status === 'Absent').length;
      const total = present + absent;
      const percentage = total > 0 ? Math.round((present / total) * 100) : 0;
      
      reports.push({
        date,
        present,
        absent,
        total,
        percentage
      });
    }
    
    res.json(reports);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/sync/students', async (req, res) => {
  try {
    const students = req.body;
    appDb.students = [];
    for (const student of students) {
      appDb.students.push({
        pin_no: student.pinNumber, 
        name: student.name, 
        std: student.standard, 
        course: student.isCoachingStudent ? 'Coaching' : 'Regular', 
        created_at: student.createdAt || new Date().toISOString()
      });
    }
    saveAppDB();
    res.json({ message: 'Students synced successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/sync/attendance', async (req, res) => {
  try {
    const records = req.body; 
    appDb.attendance = [];
    for (const record of records) {
      const date = record.date;
      for (const detail of record.details) {
        appDb.attendance.push({
          id: Date.now() + Math.random(),
          student_id: detail.studentId,
          attendance_date: date,
          status: detail.status,
          created_at: new Date().toISOString()
        });
      }
    }
    saveAppDB();
    res.json({ message: 'Attendance synced successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/sync/all', async (req, res) => {
  try {
    const students = appDb.students.map((d: any) => ({
      id: d.pin_no, 
      pinNumber: d.pin_no,
      name: d.name,
      standard: d.std,
      isCoachingStudent: d.course === 'Coaching',
      status: 'Active',
      createdAt: d.created_at
    }));

    const attendanceMap = new Map();
    for (const row of appDb.attendance) {
      if (!attendanceMap.has(row.attendance_date)) {
        attendanceMap.set(row.attendance_date, {
          id: \`att-\${row.attendance_date}\`,
          date: row.attendance_date,
          status: 'Submitted',
          details: []
        });
      }
      attendanceMap.get(row.attendance_date).details.push({
        id: \`det-\${row.id}\`,
        studentId: row.student_id,
        status: row.status,
        timestamp: row.created_at
      });
    }
    const attendanceRecords = Array.from(attendanceMap.values());

    res.json({ students, attendanceRecords });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});`);

fs.writeFileSync('server.ts', serverCode);
