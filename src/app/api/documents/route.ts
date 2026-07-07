import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowsToObjects, rowToObject } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { generateBookingDocument } from '@/lib/document';

export async function GET(request: NextRequest) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const download = searchParams.get('download');

    if (download) {
      const bookingResult = await dbExecute(
        `SELECT b.booking_id, b.passenger_count, b.payment_status, b.amount, b.created_at, d.date, s.time, s.vehicle_time
         FROM bookings b
         JOIN dates d ON b.date_id = d.id
         JOIN slots s ON b.slot_id = s.id
         WHERE b.booking_id = ?`,
        [download]
      );
      const booking = rowToObject(bookingResult);
      if (!booking) {
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      const passengersResult = await dbExecute(
        'SELECT name, mobile, gender FROM passengers WHERE booking_id = ? ORDER BY id',
        [download]
      );
      const passengers = rowsToObjects(passengersResult) as { name: string; mobile: string; gender: string }[];

      const buf = await generateBookingDocument({
        bookingId: download,
        paymentStatus: booking.payment_status as string,
        date: booking.date as string,
        time: booking.time as string,
        vehicleTime: (booking.vehicle_time as string) || undefined,
        examCenter: (booking.exam_center as string) || undefined,
        passengerCount: Number(booking.passenger_count),
        amount: Number(booking.amount),
        passengers,
      });

      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${download}.docx"`,
        },
      });
    }

    const result = await dbExecute(
      `SELECT b.booking_id, b.passenger_count, b.payment_status, b.amount, b.created_at, d.date, s.time
       FROM bookings b
       JOIN dates d ON b.date_id = d.id
       JOIN slots s ON b.slot_id = s.id
       WHERE b.payment_status = 'confirmed'
       ORDER BY b.created_at DESC`
    );

    const bookings = rowsToObjects(result) as Record<string, unknown>[];
    const documents = bookings.map((b) => ({
      booking_id: b.booking_id,
      date: b.date,
      time: b.time,
      passenger_count: b.passenger_count,
      amount: b.amount,
      payment_status: b.payment_status,
      created_at: b.created_at,
      has_document: true,
    }));

    return NextResponse.json(documents);
  } catch (err: any) {
    console.error('[API /documents] GET error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}
