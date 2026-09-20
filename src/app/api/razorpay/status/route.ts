import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowToObject } from '@/lib/db';
import { fetchOrderStatus, fetchOrderPayments, confirmBooking } from '@/lib/razorpay';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bookingId = searchParams.get('booking_id');

    if (!bookingId) {
      return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });
    }

    // Fetch booking
    const bookingResult = await dbExecute(
      'SELECT * FROM bookings WHERE booking_id = ?',
      [bookingId]
    );
    const booking = rowToObject(bookingResult);

    if (!booking) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    // Terminal statuses — return immediately without Razorpay API call
    if (booking.payment_status === 'confirmed') {
      console.log(`[Status] Booking ${bookingId} already confirmed`);
      return NextResponse.json({
        status: 'confirmed',
        booking_id: bookingId,
        serial_number: booking.serial_number,
      });
    }

    if (booking.payment_status === 'failed') {
      console.log(`[Status] Booking ${bookingId} payment failed`);
      return NextResponse.json({
        status: 'failed',
        booking_id: bookingId,
        message: 'Payment failed. Please try again.',
      });
    }

    if (booking.payment_status === 'cancelled') {
      console.log(`[Status] Booking ${bookingId} payment cancelled`);
      return NextResponse.json({
        status: 'cancelled',
        booking_id: bookingId,
        message: 'Payment was cancelled.',
      });
    }

    if (booking.payment_status === 'expired') {
      console.log(`[Status] Booking ${bookingId} payment expired`);
      return NextResponse.json({
        status: 'expired',
        booking_id: bookingId,
        message: 'Payment session expired.',
      });
    }

    const razorpayOrderId = booking.razorpay_order_id as string;
    if (!razorpayOrderId) {
      return NextResponse.json({ status: 'pending', message: 'Payment not yet initiated' });
    }

    // Fetch order status from Razorpay
    let order;
    try {
      order = await fetchOrderStatus(razorpayOrderId);
      console.log(`[Status] Order ${razorpayOrderId} status: ${order.status}`);
    } catch (err: any) {
      console.error(`[Status] fetchOrderStatus error for ${razorpayOrderId}:`, err?.message || err);
      return NextResponse.json({ status: 'error', error: 'Failed to check payment status with Razorpay' });
    }

    if (order.status !== 'paid') {
      return NextResponse.json({ status: order.status, message: 'Awaiting payment...' });
    }

    // Order is paid — fetch the payment ID and confirm the booking
    let payments;
    try {
      payments = await fetchOrderPayments(razorpayOrderId);
      console.log(`[Status] Payments for order ${razorpayOrderId}: ${payments.length} found`);
    } catch (err: any) {
      console.error(`[Status] fetchOrderPayments error for ${razorpayOrderId}:`, err?.message || err);
      return NextResponse.json({ status: 'error', error: 'Payment confirmed but could not fetch payment details' });
    }

    const paidPayment = payments.find(p => p.status === 'captured') || payments[0];
    if (!paidPayment) {
      return NextResponse.json({ status: 'error', error: 'No payment record found for this order' });
    }

    console.log(`[Status] Confirming booking ${bookingId} with payment ${paidPayment.id}`);
    const result = await confirmBooking(bookingId, razorpayOrderId, paidPayment.id);

    if (!result.success) {
      console.error(`[Status] confirmBooking failed for ${bookingId}:`, result.error);
      return NextResponse.json({ status: 'error', error: result.error || 'Booking confirmation failed' });
    }

    console.log(`[Status] Booking ${bookingId} confirmed with serial ${result.serial_number}`);
    return NextResponse.json({
      status: 'confirmed',
      booking_id: bookingId,
      serial_number: result.serial_number,
    });
  } catch (err: any) {
    console.error('[Status] Unhandled error:', err?.message || err);
    return NextResponse.json({ status: 'error', error: 'Failed to check payment status' });
  }
}