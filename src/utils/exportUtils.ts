import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student, DailyAttendanceRecord, AttendanceDetail } from '../types';

export function exportToExcel(data: any[], fileName: string, sheetName = 'Data') {
  if (!data || data.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

export function exportToPDF(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  fileName: string,
  orientation: 'portrait' | 'landscape' = 'portrait'
) {
  const doc = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: 'a4',
  });

  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text('Student Tablet Management & Digital Attendance System', 14, 15);
  
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text(title, 14, 22);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

  autoTable(doc, {
    startY: 32,
    head: [headers],
    body: rows,
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 3 },
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255] },
  });

  const pageCount = (doc as any).internal.getNumberOfPages();
  doc.setFontSize(8);
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.getWidth() - 14,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'right' }
    );
  }

  doc.save(`${fileName}.pdf`);
}

// Trigger browser print
export function printDocument() {
  window.print();
}

// Helper to parse Excel (.xlsx) or CSV files into JSON objects
export async function parseStudentImportFile(file: File): Promise<{
  data: any[];
  error?: string;
}> {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        const workbook = XLSX.read(buffer, { type: 'array' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        resolve({ data: jsonData });
      } catch (err: any) {
        resolve({ data: [], error: err.message || 'Failed to parse file.' });
      }
    };
    reader.onerror = () => resolve({ data: [], error: 'Failed to read file.' });
    reader.readAsArrayBuffer(file);
  });
}

// Helper to download a sample Excel import template for students
export function downloadStudentImportTemplate() {
  const sampleData = [
    {
      'Student PIN': 'PIN-1010',
      'Student Name': 'Aarav Mehta',
      'Standard': 'Std 10',
      'Coaching Batch': 'Yes',
      'Status': 'Active'
    },
    {
      'Student PIN': 'PIN-1011',
      'Student Name': 'Ananya Sharma',
      'Standard': 'Std 9',
      'Coaching Batch': 'No',
      'Status': 'Active'
    },
    {
      'Student PIN': 'PIN-1012',
      'Student Name': 'Rohan Verma',
      'Standard': 'Std 12',
      'Coaching Batch': 'Yes',
      'Status': 'Active'
    }
  ];
  exportToExcel(sampleData, 'Student_Import_Template', 'Template');
}

