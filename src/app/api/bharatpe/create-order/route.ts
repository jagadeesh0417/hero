import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowToObject } from '@/lib/db';
import { createPaymentOrder } from '@/lib/bharatpe';

export async function POST(request: NextRequest) {
  try {
    const { booking_id } = await request.json();

    if (!booking_id) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 });
    }

    const bookingResult = await dbExecute(
      `SELECT b.*, d.date, s.time
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

    const passengersResult = await dbExecute(
      'SELECT name, mobile FROM passengers WHERE booking_id = ? ORDER BY id LIMIT 1',
      [booking_id]
    );
    const primaryPassenger = (passengersResult.rows[0] || {}) as any;

    const order = await createPaymentOrder(booking_id, Number(booking.amount), {
      name: primaryPassenger.name || 'Customer',
      mobile: primaryPassenger.mobile || '',
    });

    if (!order.success || !order.payment_url) {
      return NextResponse.json({ error: order.message || 'Failed to initiate payment' }, { status: 502 });
    }

    await dbExecute(
      "UPDATE bookings SET bharatpe_order_id = ? WHERE booking_id = ?",
      [order.order_id || '', booking_id]
    );

    return NextResponse.json({
      success: true,
      payment_url: order.payment_url,
      order_id: order.order_id,
    });
  } catch (err: any) {
    console.error('[API /bharatpe/create-order] error:', err?.message || err);
    return NextResponse.json({ error: 'Payment initiation failed' }, { status: 500 });
  }
}
