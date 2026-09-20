import { NextResponse } from 'next/server';
import { dbExecute, rowsToObjects, rowToObject } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';

export async function POST(request: Request) {
  try {
    const { booking_id, utr_number } = await request.json();

    if (!booking_id) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    const bookingResult = await dbExecute(
      `SELECT b.*, d.date, s.time, s.vehicle_time
       FROM bookings b
       JOIN dates d ON b.date_id = d.id
       JOIN slots s ON b.slot_id = s.id
       WHERE b.booking_id = ?`,
      [booking_id]
    );

    const booking = rowToObject(bookingResult);
    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (booking.payment_status === 'confirmed') {
      return NextResponse.json({ error: 'Payment already completed' }, { status: 400 });
    }

    const paymentId = uuidv4();

    await dbExecute(
      "UPDATE bookings SET payment_status = 'confirmed', payment_id = ?, utr_number = ? WHERE booking_id = ?",
      [paymentId, utr_number || '', booking_id]
    );

    return NextResponse.json({
      success: true,
      payment_id: paymentId,
      booking_id,
      message: 'Payment successful',
    });
  } catch (err: any) {
    console.error('[API /payment] POST error:', err?.message || err);
    return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
  }
}
