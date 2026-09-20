import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowToObject, rowsToObjects } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('booking_id');
    const mobile = searchParams.get('mobile');

    if (!bookingId || !mobile) {
      return NextResponse.json({ error: 'Booking ID and Mobile number are required' }, { status: 400 });
    }

    // Look up booking
    const bookingResult = await dbExecute(
      `SELECT b.*, d.date, s.time, s.vehicle_time
       FROM bookings b
       JOIN dates d ON b.date_id = d.id
       JOIN slots s ON b.slot_id = s.id
       WHERE b.booking_id = ? AND b.payment_status = 'confirmed'`,
      [bookingId]
    );
    const booking = rowToObject(bookingResult);

    if (!booking) {
      return NextResponse.json({ error: 'No confirmed booking found with this ID' }, { status: 404 });
    }

    // Verify mobile matches primary passenger
    const passengerResult = await dbExecute(
      "SELECT * FROM passengers WHERE booking_id = ? AND (mobile = ? OR booking_id IN (SELECT booking_id FROM bookings WHERE booking_id = ? AND customer_mobile = ?))",
      [bookingId, mobile, bookingId, mobile]
    );
    const passengers = rowsToObjects(passengerResult);

    const primaryPassenger = passengers[0] || null;
    if (!primaryPassenger) {
      const customerMobile = booking.customer_mobile as string;
      if (customerMobile !== mobile) {
        return NextResponse.json({ error: 'Mobile number does not match this booking' }, { status: 403 });
      }
    }

    // Return full booking details
    return NextResponse.json({
      booking_id: booking.booking_id,
      serial_number: booking.serial_number,
      date: booking.date,
      time: booking.time,
      vehicle_time: booking.vehicle_time,
      exam_center: booking.exam_center,
      passenger_count: booking.passenger_count,
      amount: booking.amount,
      payment_status: booking.payment_status,
      razorpay_payment_id: booking.razorpay_payment_id,
      razorpay_order_id: booking.razorpay_order_id,
      razorpay_status: booking.razorpay_status,
      razorpay_method: booking.razorpay_method,
      created_at: booking.created_at,
      passengers: passengers.map((p: any) => ({
        name: p.name,
        mobile: p.mobile,
        gender: p.gender,
      })),
    });
  } catch (err: any) {
    console.error('[API /bookings/lookup] error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to look up booking' }, { status: 500 });
  }
}