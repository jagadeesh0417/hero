import ExcelJS from 'exceljs';
import { slotLabel } from './slots';

export interface BookingRow {
  booking_id: string;
  name: string;
  mobile: string;
  gender: string;
  serial_number?: number;
  exam_center: string;
  date: string;
  time: string;
  passenger_count: number;
  amount: number;
  payment_status: string;
  created_at: string;
}

const HEADER_COLUMNS = [
  'Sl No',
  'Booking ID',
  'Customer Name',
  'Mobile Number',
  'Gender',
  'Exam Center',
  'Travel Date',
  'Slot',
  'Passengers',
  'Amount (₹)',
  'Payment Status',
  'Booking Date & Time',
];

const COL_WIDTHS = [10, 14, 22, 16, 10, 36, 16, 18, 12, 14, 16, 20];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
}

function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export async function generateDateExcel(
  dateStr: string,
  bookings: BookingRow[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Suman Travels';
  workbook.created = new Date();

  const ws = workbook.addWorksheet(formatDate(dateStr), {
    pageSetup: { orientation: 'landscape', fitToPage: true },
  });

  // Column widths
  COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

  // Styles
  const titleFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1E3A5F' } };
  const groupFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF1E3A5F' } };
  const slotFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF2E86C1' } };
  const headerFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
  const dataFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 10 };
  const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
  const altFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
  const borderStyle: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFE2E8F0' } };
  const border = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

  // Title row
  const titleRow = ws.addRow([`Travel Date: ${formatDate(dateStr)}`]);
  titleRow.font = titleFont;
  ws.mergeCells(`A${titleRow.number}:L${titleRow.number}`);
  titleRow.height = 30;

  ws.addRow([]); // spacer

  // Group bookings by exam_center, then by slot
  const groups: Record<string, Record<string, BookingRow[]>> = {};
  for (const b of bookings) {
    const center = b.exam_center || 'Not Specified';
    const slot = slotLabel(b.time);
    if (!groups[center]) groups[center] = {};
    if (!groups[center][slot]) groups[center][slot] = [];
    groups[center][slot].push(b);
  }

  let rowNum = ws.rowCount;

  for (const [center, slots] of Object.entries(groups)) {
    // Exam Center header row
    const centerRow = ws.addRow([`EXAM CENTER: ${center}`]);
    centerRow.font = groupFont;
    ws.mergeCells(`A${centerRow.number}:L${centerRow.number}`);
    centerRow.height = 24;
    ws.addRow([]);

    for (const [slot, rows] of Object.entries(slots)) {
      // Slot header row
      const slotRow = ws.addRow([slot]);
      slotRow.font = slotFont;
      ws.mergeCells(`A${slotRow.number}:L${slotRow.number}`);
      slotRow.height = 22;

      // Column headers
      const headerRow = ws.addRow(HEADER_COLUMNS);
      headerRow.font = headerFont;
      headerRow.fill = headerFill;
      headerRow.eachCell((cell) => { cell.border = border; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });
      headerRow.height = 22;

      // Data rows
      for (let i = 0; i < rows.length; i++) {
        const b = rows[i];
        const dataRow = ws.addRow([
          b.serial_number || '-',
          b.booking_id,
          b.name,
          b.mobile,
          b.gender || '-',
          b.exam_center || 'Not Specified',
          b.date,
          slotLabel(b.time),
          b.passenger_count,
          b.amount,
          b.payment_status === 'confirmed' ? 'Confirmed' : b.payment_status,
          formatDateTime(b.created_at),
        ]);
        dataRow.font = dataFont;
        dataRow.eachCell((cell, col) => {
          cell.border = border;
          cell.alignment = { vertical: 'middle', horizontal: col <= 3 ? 'left' : 'center' };
        });
        if (i % 2 === 1) dataRow.eachCell((cell) => { cell.fill = altFill; });
      }

      ws.addRow([]); // spacer after slot group
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}

export async function generateAllDatesExcel(
  dateGroups: Record<string, BookingRow[]>
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Suman Travels';
  workbook.created = new Date();

  for (const [dateStr, bookings] of Object.entries(dateGroups)) {
    const ws = workbook.addWorksheet(formatDate(dateStr), {
      pageSetup: { orientation: 'landscape', fitToPage: true },
    });

    COL_WIDTHS.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

    const titleFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1E3A5F' } };
    const groupFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 12, bold: true, color: { argb: 'FF1E3A5F' } };
    const slotFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF2E86C1' } };
    const headerFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    const dataFont: Partial<ExcelJS.Font> = { name: 'Arial', size: 10 };
    const headerFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E3A5F' } };
    const altFill: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F7FA' } };
    const borderStyle: Partial<ExcelJS.Border> = { style: 'thin', color: { argb: 'FFE2E8F0' } };
    const border = { top: borderStyle, bottom: borderStyle, left: borderStyle, right: borderStyle };

    const titleRow = ws.addRow([`Travel Date: ${formatDate(dateStr)}`]);
    titleRow.font = titleFont;
    ws.mergeCells(`A${titleRow.number}:L${titleRow.number}`);
    titleRow.height = 30;
    ws.addRow([]);

    const groups: Record<string, Record<string, BookingRow[]>> = {};
    for (const b of bookings) {
      const center = b.exam_center || 'Not Specified';
      const slot = slotLabel(b.time);
      if (!groups[center]) groups[center] = {};
      if (!groups[center][slot]) groups[center][slot] = [];
      groups[center][slot].push(b);
    }

    for (const [center, slots] of Object.entries(groups)) {
      const centerRow = ws.addRow([`EXAM CENTER: ${center}`]);
      centerRow.font = groupFont;
      ws.mergeCells(`A${centerRow.number}:L${centerRow.number}`);
      centerRow.height = 24;
      ws.addRow([]);

      for (const [slot, rows] of Object.entries(slots)) {
        const slotRow = ws.addRow([slot]);
        slotRow.font = slotFont;
        ws.mergeCells(`A${slotRow.number}:L${slotRow.number}`);
        slotRow.height = 22;

        const headerRow = ws.addRow(HEADER_COLUMNS);
        headerRow.font = headerFont;
        headerRow.fill = headerFill;
        headerRow.eachCell((cell) => { cell.border = border; cell.alignment = { vertical: 'middle', horizontal: 'center' }; });
        headerRow.height = 22;

        for (let i = 0; i < rows.length; i++) {
          const b = rows[i];
          const dataRow = ws.addRow([
            b.serial_number || '-',
            b.booking_id,
            b.name,
            b.mobile,
            b.gender || '-',
            b.exam_center || 'Not Specified',
            b.date,
            slotLabel(b.time),
            b.passenger_count,
            b.amount,
            b.payment_status === 'confirmed' ? 'Confirmed' : b.payment_status,
            formatDateTime(b.created_at),
          ]);
          dataRow.font = dataFont;
          dataRow.eachCell((cell, col) => {
            cell.border = border;
            cell.alignment = { vertical: 'middle', horizontal: col <= 3 ? 'left' : 'center' };
          });
          if (i % 2 === 1) dataRow.eachCell((cell) => { cell.fill = altFill; });
        }

        ws.addRow([]);
      }
    }
  }

  const buf = await workbook.xlsx.writeBuffer();
  return Buffer.from(buf);
}
