import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowToObject } from '@/lib/db';
import { fetchOrderStatus, fetchOrderPayments, confirmBooking } from '@/lib/razorpay';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf-8'), Buffer.from(b, 'utf-8'));
  } catch {
    return false;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const { searchParams } = new URL(_request.url);
  const token = searchParams.get('t');

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 401, headers: { 'Cache-Control': 'no-store' } });
  }

  try {
    const result = await dbExecute(
      'SELECT booking_id, payment_status, serial_number, receipt_token, amount FROM bookings WHERE booking_id = ?',
      [bookingId]
    );
    const booking = rowToObject(result);

    if (!booking) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    // Constant-time token comparison
    const storedToken = (booking.receipt_token as string) || '';
    if (!storedToken || !timingSafeEqual(token, storedToken)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    const paymentStatus = booking.payment_status as string;
    const serialNumber = booking.serial_number as number | null;

    // Terminal states — return immediately
    if (paymentStatus === 'confirmed') {
      console.log(`[Status] Booking ${bookingId} already confirmed`);
      return NextResponse.json(
        { status: 'confirmed', booking_id: bookingId, serial_number: serialNumber },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (paymentStatus === 'failed') {
      console.log(`[Status] Booking ${bookingId} payment failed`);
      return NextResponse.json(
        { status: 'failed', booking_id: bookingId, message: 'Payment failed. Please try again.' },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (paymentStatus === 'cancelled') {
      console.log(`[Status] Booking ${bookingId} payment cancelled`);
      return NextResponse.json(
        { status: 'cancelled', booking_id: bookingId, message: 'Payment was cancelled.' },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    if (paymentStatus === 'expired') {
      console.log(`[Status] Booking ${bookingId} payment expired`);
      return NextResponse.json(
        { status: 'expired', booking_id: bookingId, message: 'Payment session expired.' },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Check if there's a Razorpay order to poll
    const orderResult = await dbExecute(
      "SELECT razorpay_order_id FROM bookings WHERE booking_id = ? AND razorpay_order_id != ''",
      [bookingId]
    );
    const orderRow = rowToObject(orderResult);
    const razorpayOrderId = orderRow?.razorpay_order_id as string | undefined;

    if (razorpayOrderId) {
      try {
        const order = await fetchOrderStatus(razorpayOrderId);
        if (order.status === 'paid') {
          console.log(`[Status] Order ${razorpayOrderId} is paid, auto-confirming booking ${bookingId}`);
          // Actively confirm the booking — don't just return paid_detected
          try {
            const payments = await fetchOrderPayments(razorpayOrderId);
            const paidPayment = payments.find(p => p.status === 'captured') || payments[0];
            if (paidPayment) {
              const confirmResult = await confirmBooking(bookingId, razorpayOrderId, paidPayment.id);
              if (confirmResult.success) {
                console.log(`[Status] Auto-confirmed booking ${bookingId}, serial=${confirmResult.serial_number}`);
                return NextResponse.json(
                  { status: 'confirmed', booking_id: bookingId, serial_number: confirmResult.serial_number },
                  { headers: { 'Cache-Control': 'no-store' } }
                );
              } else {
                console.error(`[Status] Auto-confirm failed for ${bookingId}: ${confirmResult.error}`);
              }
            }
          } catch (confirmErr: any) {
            console.error(`[Status] Auto-confirm error for ${bookingId}:`, confirmErr?.message || confirmErr);
          }
          // Fallback: if confirm fails, still tell frontend to retry
          return NextResponse.json(
            { status: 'paid_detected', message: 'Payment detected, confirming...', booking_id: bookingId },
            { headers: { 'Cache-Control': 'no-store' } }
          );
        }
        return NextResponse.json(
          { status: order.status, message: 'Awaiting payment...', booking_id: bookingId },
          { headers: { 'Cache-Control': 'no-store' } }
        );
      } catch (err: any) {
        console.error(`[Status] fetchOrderStatus error for ${razorpayOrderId}:`, err?.message || err);
      }
    }

    return NextResponse.json(
      { status: 'pending', message: 'Payment not yet completed', booking_id: bookingId },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err: any) {
    console.error('[Status] Error:', err?.name, err?.message, err?.stack);
    return NextResponse.json({ error: 'Failed to check status' }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}