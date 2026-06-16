import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowsToObjects, rowToObject } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  try {
    const { bookingId } = await params;

    const bookingResult = await dbExecute(
      `SELECT b.*, d.date, s.time
       FROM bookings b
       JOIN dates d ON b.date_id = d.id
       JOIN slots s ON b.slot_id = s.id
       WHERE b.booking_id = ?`,
      [bookingId]
    );

    const booking = rowToObject(bookingResult);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const passengersResult = await dbExecute(
      'SELECT * FROM passengers WHERE booking_id = ?',
      [bookingId]
    );
    const passengers = rowsToObjects(passengersResult);

    return NextResponse.json({ ...booking, passengers } as any);
  } catch (err: any) {
    console.error('[API /bookings/:id] GET error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to fetch booking' }, { status: 500 });
  }
}
