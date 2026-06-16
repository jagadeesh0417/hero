import { NextRequest, NextResponse } from 'next/server';
import db, { rowsToObjects } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;

  const bookingResult = await db.execute({
    sql: `SELECT b.*, d.date, s.time
         FROM bookings b
         JOIN dates d ON b.date_id = d.id
         JOIN slots s ON b.slot_id = s.id
         WHERE b.booking_id = ?`,
    args: [bookingId],
  });

  if (bookingResult.rows.length === 0) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const booking = rowsToObjects(bookingResult)[0];

  const passengersResult = await db.execute({
    sql: 'SELECT * FROM passengers WHERE booking_id = ?',
    args: [bookingId],
  });
  const passengers = rowsToObjects(passengersResult);

  return NextResponse.json({ ...booking, passengers } as any);
}
