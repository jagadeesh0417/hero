import { NextRequest, NextResponse } from 'next/server';
import db, { rowsToObjects } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import fs from 'fs';
import { getDocumentPath } from '@/lib/document';

export async function GET(request: NextRequest) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const download = searchParams.get('download');

  if (download) {
    const docPath = getDocumentPath(download);
    if (!fs.existsSync(docPath)) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const buffer = fs.readFileSync(docPath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="${download}.docx"`,
      },
    });
  }

  const result = await db.execute({
    sql: `SELECT b.booking_id, b.passenger_count, b.payment_status, b.amount, b.created_at, d.date, s.time
         FROM bookings b
         JOIN dates d ON b.date_id = d.id
         JOIN slots s ON b.slot_id = s.id
         WHERE b.payment_status = 'confirmed'
         ORDER BY b.created_at DESC`,
  });

  const bookings = rowsToObjects(result) as Record<string, unknown>[];
  const documents = bookings.map((b) => ({
    booking_id: b.booking_id,
    date: b.date,
    time: b.time,
    passenger_count: b.passenger_count,
    amount: b.amount,
    payment_status: b.payment_status,
    created_at: b.created_at,
    has_document: fs.existsSync(getDocumentPath(b.booking_id as string)),
  }));

  return NextResponse.json(documents);
}
