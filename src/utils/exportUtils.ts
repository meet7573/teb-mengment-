import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Student, DailyAttendanceRecord, AttendanceDetail } from '../types';

// Helper to convert array of objects into downloadable Excel sheet
export function exportToExcel(data: any[], fileName: string, sheetName = 'Data') {
  if (!data || data.length === 0) return;
  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  XLSX.writeFile(workbook, `${fileName}_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// Helper to create PDF with autotable
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

  // Header Title
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // dark slate
  doc.text('Student Tablet Management & Digital Attendance System', 14, 15);
  
  doc.setFontSize(12);
  doc.setTextColor(71, 85, 105);
  doc.text(title, 14, 22);

  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);

  // Auto Table
  autoTable(doc, {
    startY: 32,
    head: [headers],
    body: rows,
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42], // Slate-900
      textColor: [255, 255, 255],
      fontSize: 10,
      fontStyle: 'bold',
      halign: 'left',
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [51, 65, 85],
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 32, right: 14, bottom: 20, left: 14 },
  });

  // Footer page numbers
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `Page ${i} of ${pageCount} - Confidential Academic Report`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'center' }
    );
  }

  doc.save(`${fileName}_${new Date().toISOString().slice(0, 10)}.pdf`);
}

export interface DailyAttendancePDFOptions {
  schoolName?: string;
  selectedDate: string;
  selectedStandard?: string;
  students: Student[];
  attendanceRecords: DailyAttendanceRecord[];
}

export function generateDailyAttendancePDF({
  schoolName = 'Excellence Academy & Digital Campus',
  selectedDate,
  selectedStandard = 'All',
  students,
  attendanceRecords,
}: DailyAttendancePDFOptions) {
  // 1. Find record for selected date if exists
  const record = attendanceRecords.find((r) => r.date === selectedDate);
  const detailsMap = new Map<string, AttendanceDetail>();
  if (record) {
    record.details.forEach((d) => detailsMap.set(d.studentId, d));
  }

  // 2. Filter students by standard
  const filteredStudents = students.filter((s) => {
    return selectedStandard === 'All' || s.standard === selectedStandard;
  });

  // 3. Prepare rows
  const rows = filteredStudents.map((s) => {
    const detail = detailsMap.get(s.id);

    const checkIn = detail?.checkInTime && detail.checkInTime.trim() !== '' ? detail.checkInTime : '-';
    const checkOut = detail?.checkOutTime && detail.checkOutTime.trim() !== '' ? detail.checkOutTime : '-';

    // Status Determination: Present / Absent
    let statusText: 'Present' | 'Absent' = 'Absent';
    if (detail) {
      if (
        detail.status === 'Present' ||
        detail.status === 'Checked In' ||
        detail.status === 'Checked Out' ||
        detail.status === 'Late' ||
        (detail.checkInTime && detail.checkInTime !== '-')
      ) {
        statusText = 'Present';
      }
    }

    return {
      pinNumber: s.pinNumber,
      name: s.name,
      standard: s.standard,
      checkInTime: checkIn,
      checkOutTime: checkOut,
      status: statusText,
    };
  });

  // 4. Sort by Student PIN in ascending order (Requirement 7)
  rows.sort((a, b) =>
    a.pinNumber.localeCompare(b.pinNumber, undefined, { numeric: true, sensitivity: 'base' })
  );

  // 5. Calculate Summary Statistics (Requirement 5)
  const totalStudents = rows.length;
  const presentStudents = rows.filter((r) => r.status === 'Present').length;
  const absentStudents = totalStudents - presentStudents;
  const attendancePercentage =
    totalStudents > 0 ? ((presentStudents / totalStudents) * 100).toFixed(1) + '%' : '0.0%';

  // 6. Generate A4 Portrait PDF
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  // Header Banner
  doc.setFillColor(15, 23, 42); // Slate-900
  doc.rect(0, 0, pageWidth, 28, 'F');

  // School Name
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text(schoolName, 14, 11);

  // Report Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(251, 191, 36); // Amber-400 accent
  doc.text('Daily Attendance Report', 14, 19);

  // Generated Date & Time
  const now = new Date();
  const formattedGenTime = `${now.toISOString().slice(0, 10)} ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // Slate-300
  doc.text(`Generated: ${formattedGenTime}`, pageWidth - 14, 19, { align: 'right' });

  // Filter Sub-header box
  doc.setFillColor(241, 245, 249); // Slate-100
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(14, 32, pageWidth - 28, 12, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(`Selected Date: ${selectedDate}`, 18, 39.5);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Standard/Class: ${selectedStandard}`, 110, 39.5);

  // Summary Metrics Section
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, 48, pageWidth - 28, 16, 2, 2, 'FD');

  const colWidth = (pageWidth - 28) / 4;

  // Metric 1: Total
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('TOTAL STUDENTS', 14 + colWidth * 0.5, 53, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(15, 23, 42);
  doc.text(String(totalStudents), 14 + colWidth * 0.5, 60, { align: 'center' });

  // Metric 2: Present
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('PRESENT STUDENTS', 14 + colWidth * 1.5, 53, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(16, 185, 129); // Emerald-600
  doc.text(String(presentStudents), 14 + colWidth * 1.5, 60, { align: 'center' });

  // Metric 3: Absent
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('ABSENT STUDENTS', 14 + colWidth * 2.5, 53, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(225, 29, 72); // Rose-600
  doc.text(String(absentStudents), 14 + colWidth * 2.5, 60, { align: 'center' });

  // Metric 4: Percentage
  doc.setFontSize(7.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(100, 116, 139);
  doc.text('ATTENDANCE %', 14 + colWidth * 3.5, 53, { align: 'center' });
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229); // Indigo-600
  doc.text(attendancePercentage, 14 + colWidth * 3.5, 60, { align: 'center' });

  // Table Columns
  const headers = [
    'Sr. No.',
    'Student PIN',
    'Student Name',
    'Standard/Class',
    'IN Time',
    'OUT Time',
    'Status',
  ];

  const tableBody = rows.map((r, idx) => [
    idx + 1,
    r.pinNumber,
    r.name,
    r.standard,
    r.checkInTime,
    r.checkOutTime,
    r.status,
  ]);

  autoTable(doc, {
    startY: 68,
    head: [headers],
    body: tableBody,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 41, 59], // Slate 800
      textColor: [255, 255, 255],
      fontSize: 8.5,
      fontStyle: 'bold',
      halign: 'center',
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [51, 65, 85],
      valign: 'middle',
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 14 },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 28 },
      2: { halign: 'left' },
      3: { halign: 'center', cellWidth: 28 },
      4: { halign: 'center', cellWidth: 26 },
      5: { halign: 'center', cellWidth: 26 },
      6: { halign: 'center', fontStyle: 'bold', cellWidth: 24 },
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.column.index === 6) {
        if (data.cell.raw === 'Present') {
          data.cell.styles.textColor = [16, 185, 129];
        } else if (data.cell.raw === 'Absent') {
          data.cell.styles.textColor = [225, 29, 72];
        }
      }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    margin: { top: 32, right: 14, bottom: 20, left: 14 },
  });

  // Footer & Page Numbers
  const totalPages = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(148, 163, 184);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, doc.internal.pageSize.getHeight() - 12, pageWidth - 14, doc.internal.pageSize.getHeight() - 12);

    doc.text(
      `Daily Attendance Report • Date: ${selectedDate}`,
      14,
      doc.internal.pageSize.getHeight() - 6
    );

    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - 14,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'right' }
    );
  }

  doc.save(`Attendance_Report_${selectedDate}.pdf`);
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

