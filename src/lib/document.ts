import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
  Header,
  Footer,
  PageNumber,
  HeadingLevel,
  TableLayoutType,
} from 'docx';
import fs from 'fs';
import path from 'path';
import { to12h } from './slots';

const BUSINESS_NAME = 'SUMAN TRAVELS';
const PHONE = '+91 9848579053';
const ADDRESS_LINE1 = 'Lalitha Nagar, NGO Colony';
const ADDRESS_LINE2 = 'Nandyala, Andhra Pradesh – 518502';

interface PassengerDoc {
  name: string;
  mobile: string;
  gender: string;
}

interface BookingDocData {
  bookingId: string;
  paymentStatus: string;
  date: string;
  time: string;
  vehicleTime?: string;
  passengerCount: number;
  amount: number;
  passengers: PassengerDoc[];
}

function createHeaderRow(texts: string[]): TableRow {
  return new TableRow({
    tableHeader: true,
    children: texts.map(
      (text) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text, bold: true, color: 'FFFFFF', size: 20 }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
          shading: { type: 'solid', color: '1E3A5F', fill: '1E3A5F' },
          width: { size: 25, type: WidthType.PERCENTAGE },
        })
    ),
  });
}

function createDataRow(values: string[]): TableRow {
  return new TableRow({
    children: values.map(
      (value, i) =>
        new TableCell({
          children: [
            new Paragraph({
              children: [new TextRun({ text: value, size: 20 })],
              alignment: AlignmentType.CENTER,
            }),
          ],
          width: { size: 25, type: WidthType.PERCENTAGE },
        })
    ),
  });
}

export async function generateBookingDocument(
  data: BookingDocData,
  outputPath?: string
): Promise<Buffer> {
  const doc = new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Arial', size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                children: [
                  new TextRun({
                    text: `${BUSINESS_NAME} | Exam Travel Booking`,
                    bold: true,
                    size: 16,
                    color: '1E3A5F',
                  }),
                ],
                alignment: AlignmentType.RIGHT,
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  new TextRun({ text: 'Page ', size: 18 }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 18,
                  }),
                  new TextRun({ text: ' of ', size: 18 }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 18,
                  }),
                ],
                alignment: AlignmentType.CENTER,
              }),
            ],
          }),
        },
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: BUSINESS_NAME,
                bold: true,
                size: 48,
                color: '1E3A5F',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 100 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'EXAM TRAVEL BOOKING RECEIPT',
                bold: true,
                size: 32,
                color: '2E86C1',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'BUSINESS INFORMATION',
                bold: true,
                size: 24,
                color: '1E3A5F',
              }),
            ],
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `${BUSINESS_NAME}`, bold: true, size: 22 }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: `Phone: ${PHONE}`, size: 20 })],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: ADDRESS_LINE1, size: 20 })],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [new TextRun({ text: ADDRESS_LINE2, size: 20 })],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '─'.repeat(80),
                size: 16,
                color: '999999',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'BOOKING INFORMATION',
                bold: true,
                size: 24,
                color: '1E3A5F',
              }),
            ],
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Booking ID: `, bold: true, size: 20 }),
              new TextRun({ text: `${data.bookingId}`, size: 20 }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Payment Status: `, bold: true, size: 20 }),
              new TextRun({
                text: `${data.paymentStatus.toUpperCase()}`,
                size: 20,
                color: data.paymentStatus === 'confirmed' ? '008000' : 'FF0000',
              }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Booking Date: `, bold: true, size: 20 }),
              new TextRun({
                text: `${new Date().toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' })}`,
                size: 20,
              }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Travel Date: `, bold: true, size: 20 }),
              new TextRun({ text: `${data.date}`, size: 20 }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Exam Time: `, bold: true, size: 20 }),
              new TextRun({ text: `${data.time}`, size: 20 }),
            ],
            spacing: { after: 60 },
          }),
          ...(data.vehicleTime
            ? [new Paragraph({
                children: [
                  new TextRun({ text: `Vehicle Start: `, bold: true, size: 20 }),
                  new TextRun({ text: `${to12h(data.vehicleTime || '')}`, size: 20, color: 'CC5500' }),
                ],
                spacing: { after: 60 },
              })]
            : []),
          new Paragraph({
            children: [
              new TextRun({ text: `Passenger Count: `, bold: true, size: 20 }),
              new TextRun({ text: `${data.passengerCount}`, size: 20 }),
            ],
            spacing: { after: 60 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: `Total Amount: `, bold: true, size: 20 }),
              new TextRun({
                text: `₹${data.amount.toLocaleString('en-IN')}`,
                size: 20,
                color: '1E3A5F',
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '─'.repeat(80),
                size: 16,
                color: '999999',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'PASSENGER DETAILS',
                bold: true,
                size: 24,
                color: '1E3A5F',
              }),
            ],
            spacing: { before: 200, after: 200 },
          }),
          new Table({
            rows: [
              createHeaderRow(['#', 'Name', 'Mobile Number', 'Gender']),
              ...data.passengers.map((p, i) =>
                createDataRow([
                  String(i + 1),
                  p.name,
                  p.mobile,
                  p.gender,
                ])
              ),
            ],
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: '─'.repeat(80),
                size: 16,
                color: '999999',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 400, after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'Thank you for choosing SUMAN TRAVELS!',
                bold: true,
                size: 22,
                color: '1E3A5F',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: 'This is a computer-generated receipt.',
                size: 18,
                color: '666666',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { before: 100 },
          }),
        ],
      },
    ],
  });

  const buffer = Buffer.from(await Packer.toBuffer(doc));

  if (outputPath) {
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, buffer);
  }

  return buffer;
}

export function getDocumentDir(): string {
  const isVercel = process.env.VERCEL === '1';
  const dir = isVercel
    ? path.join('/tmp', 'documents')
    : path.join(process.cwd(), 'data', 'documents');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function getDocumentPath(bookingId: string): string {
  return path.join(getDocumentDir(), `${bookingId}.docx`);
}
