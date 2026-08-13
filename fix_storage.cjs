const fs = require('fs');
let code = fs.readFileSync('src/utils/storage.ts', 'utf8');

code = code.replace("import { db } from '../lib/firebase';\\nimport { collection, setDoc, doc, getDocs, writeBatch } from 'firebase/firestore';\\n", "");

code = code.replace(
  /export async function clearAllDatabase\(\) \{[\s\S]*?await batch\.commit\(\);\n\}/,
  \`export async function clearAllDatabase() {
  const collections = ['students', 'tablets', 'boxes', 'assignments', 'attendance', 'auditLogs'];
  for (const c of collections) {
    localStorage.removeItem('db_' + c);
  }
}\`
);

code = code.replace(
  /export async function logAuditAction[\s\S]*?await setDoc\(doc\(db, 'auditLogs', newLog\.id\), newLog\);\n\}/,
  \`export async function logAuditAction(userName: string, userRole: UserRole, action: string, module: AuditLog['module'], details: string) {
  const newLog: AuditLog = {
    id: 'log-' + Date.now(),
    timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    userName,
    userRole,
    action,
    module,
    details,
  };
  const currentLogs = JSON.parse(localStorage.getItem('db_auditLogs') || '[]');
  currentLogs.push(newLog);
  localStorage.setItem('db_auditLogs', JSON.stringify(currentLogs));
}\`
);

fs.writeFileSync('src/utils/storage.ts', code);
