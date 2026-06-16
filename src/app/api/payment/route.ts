import { NextResponse } from 'next/server';
import db, { rowsToObjects } from '@/lib/db';
import { v4 as uuidv4 } from 'uuid';
import { generateBookingDocument, getDocumentPath } from '@/lib/document';

export async function POST(request: Request) {
  try {
    const { booking_id, utr_number } = await request.json();

    if (!booking_id) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    const bookingResult = await db.execute({
      sql: `SELECT b.*, d.date, s.time
           FROM bookings b
           JOIN dates d ON b.date_id = d.id
           JOIN slots s ON b.slot_id = s.id
           WHERE b.booking_id = ?`,
      args: [booking_id],
    });

    if (bookingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    const booking = rowsToObjects(bookingResult)[0];

    if (booking.payment_status === 'confirmed') {
      return NextResponse.json({ error: 'Payment already completed' }, { status: 400 });
    }

    const paymentId = uuidv4();

    await db.execute({
      sql: "UPDATE bookings SET payment_status = 'confirmed', payment_id = ?, utr_number = ? WHERE booking_id = ?",
      args: [paymentId, utr_number || '', booking_id],
    });

    const passengersResult = await db.execute({
      sql: 'SELECT * FROM passengers WHERE booking_id = ?',
      args: [booking_id],
    });
    const passengers = rowsToObjects(passengersResult) as { name: string; mobile: string; gender: string }[];

    const docPath = getDocumentPath(booking_id);
    await generateBookingDocument(
      {
        bookingId: booking_id,
        paymentStatus: 'confirmed',
        date: booking.date as string,
        time: booking.time as string,
        passengerCount: booking.passenger_count as number,
        amount: booking.amount as number,
        passengers: passengers.map((p) => ({
          name: p.name,
          mobile: p.mobile,
          gender: p.gender,
        })),
      },
      docPath
    );

    return NextResponse.json({
      success: true,
      payment_id: paymentId,
      booking_id,
      message: 'Payment successful',
    });
  } catch {
    return NextResponse.json({ error: 'Payment processing failed' }, { status: 500 });
  }
}
