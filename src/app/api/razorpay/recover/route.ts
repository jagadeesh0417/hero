import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowToObject } from '@/lib/db';
import { fetchOrderStatus, fetchOrderPayments, confirmBooking } from '@/lib/razorpay';

export async function POST(request: NextRequest) {
  try {
    const { booking_id } = await request.json();

    if (!booking_id) {
      return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });
    }

    console.log(`[Recover] Attempting recovery for booking ${booking_id}`);

    // Fetch booking
    const bookingResult = await dbExecute(
      'SELECT * FROM bookings WHERE booking_id = ?',
      [booking_id]
    );
    const booking = rowToObject(bookingResult);

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // If already confirmed, return success
    if (booking.payment_status === 'confirmed') {
      return NextResponse.json({
        success: true,
        status: 'confirmed',
        booking_id,
        serial_number: booking.serial_number,
      });
    }

    const razorpayOrderId = booking.razorpay_order_id as string;
    if (!razorpayOrderId) {
      return NextResponse.json({ success: false, status: 'no_order', error: 'No Razorpay order found for this booking' });
    }

    // Check Razorpay order status
    let order;
    try {
      order = await fetchOrderStatus(razorpayOrderId);
    } catch (err: any) {
      console.error(`[Recover] fetchOrderStatus error:`, err?.message || err);
      return NextResponse.json({ success: false, status: 'error', error: 'Could not reach Razorpay. Please try again.' });
    }

    if (order.status !== 'paid') {
      console.log(`[Recover] Order ${razorpayOrderId} status is ${order.status} — not yet paid`);
      return NextResponse.json({ success: false, status: order.status, error: 'Payment not completed yet.' });
    }

    // Order is paid — fetch payments and confirm
    let payments;
    try {
      payments = await fetchOrderPayments(razorpayOrderId);
    } catch (err: any) {
      console.error(`[Recover] fetchOrderPayments error:`, err?.message || err);
      return NextResponse.json({ success: false, status: 'error', error: 'Payment confirmed but could not fetch details.' });
    }

    const paidPayment = payments.find(p => p.status === 'captured') || payments[0];
    if (!paidPayment) {
      return NextResponse.json({ success: false, status: 'error', error: 'No payment record found.' });
    }

    // Confirm the booking
    const result = await confirmBooking(booking_id, razorpayOrderId, paidPayment.id);

    if (!result.success) {
      console.error(`[Recover] confirmBooking failed:`, result.error);
      return NextResponse.json({ success: false, status: 'error', error: result.error || 'Booking confirmation failed.' });
    }

    console.log(`[Recover] Booking ${booking_id} recovered successfully with serial ${result.serial_number}`);
    return NextResponse.json({
      success: true,
      status: 'confirmed',
      booking_id,
      serial_number: result.serial_number,
    });
  } catch (err: any) {
    console.error('[Recover] Unhandled error:', err?.message || err);
    return NextResponse.json({ success: false, status: 'error', error: 'Recovery failed. Please contact support.' });
  }
}