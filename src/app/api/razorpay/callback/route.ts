import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyPaymentSignature, confirmBooking } from '@/lib/razorpay';
import { dbExecute, rowToObject } from '@/lib/db';

export const dynamic = 'force-dynamic';

async function logEvent(orderId: string, paymentId: string, event: string, status: string, bookingId: string, errorMsg?: string) {
  try {
    await dbExecute(
      `INSERT INTO payment_events (razorpay_order_id, razorpay_payment_id, event, status, signature_valid, booking_id, raw_payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [orderId, paymentId || '', event, status, status === 'signature_valid' ? 1 : 0, bookingId || '', errorMsg || '']
    );
  } catch (err: unknown) {
    console.error('[RzCallback] logEvent error:', err instanceof Error ? err.message : err);
  }
}

// Razorpay redirects the customer's browser back to this URL after the hosted
// checkout (standard/web checkout with redirect:true). On success it appends
// razorpay_payment_id, razorpay_order_id and razorpay_signature. On a failed or
// cancelled payment those are absent and error fields are present instead.
export async function GET(request: NextRequest) {
  const base = request.url;
  const { searchParams } = new URL(base);

  const orderId = searchParams.get('razorpay_order_id') || '';
  const paymentId = searchParams.get('razorpay_payment_id') || '';
  const signature = searchParams.get('razorpay_signature') || '';
  const errorCode = searchParams.get('error_code') || '';
  const errorDescription = searchParams.get('error_description') || '';

  if (!orderId) {
    console.error('[RzCallback] No razorpay_order_id in callback');
    return NextResponse.redirect(new URL('/book?error=payment_failed', base));
  }

  const bookingResult = await dbExecute(
    'SELECT booking_id, payment_status FROM bookings WHERE razorpay_order_id = ?',
    [orderId]
  );
  const booking = rowToObject(bookingResult);

  if (!booking) {
    console.error(`[RzCallback] No booking found for order ${orderId}`);
    return NextResponse.redirect(new URL('/book?error=payment_failed', base));
  }

  const bookingId = booking.booking_id as string;
  await logEvent(orderId, paymentId, 'checkout_return', errorCode ? 'failed' : paymentId ? 'received' : 'cancelled', bookingId, errorDescription || '');

  // Successful payment — verify the signature server-side, then confirm.
  if (paymentId && signature) {
    const isValid = verifyPaymentSignature(orderId, paymentId, signature);
    await logEvent(orderId, paymentId, 'checkout_return', isValid ? 'signature_valid' : 'signature_invalid', bookingId);

    if (!isValid) {
      console.error(`[RzCallback] Invalid signature for order ${orderId}, payment ${paymentId}`);
      return NextResponse.redirect(new URL(`/book?error=payment_failed&id=${encodeURIComponent(bookingId)}`, base));
    }

    const result = await confirmBooking(bookingId, orderId, paymentId);

    if (result.success) {
      console.log(`[RzCallback] Booking ${bookingId} confirmed, serial=${result.serial_number}`);
      try {
        revalidatePath('/admin');
        revalidatePath('/api/documents');
      } catch (err: unknown) {
        console.error('[RzCallback] revalidatePath error:', err instanceof Error ? err.message : err);
      }
      return NextResponse.redirect(new URL(`/success?id=${encodeURIComponent(bookingId)}`, base));
    }

    console.error(`[RzCallback] confirmBooking failed for ${bookingId}: ${result.error}`);
    return NextResponse.redirect(new URL(`/book?error=server_error&id=${encodeURIComponent(bookingId)}`, base));
  }

  // Cancelled or failed payment — leave the booking pending so the customer can
  // retry against the same payable order (create-order reuses non-duplicate orders).
  if (errorCode) {
    console.warn(`[RzCallback] Payment failed for booking ${bookingId}, order ${orderId}: ${errorDescription || errorCode}`);
  } else {
    console.log(`[RzCallback] Payment cancelled for booking ${bookingId}, order ${orderId}`);
  }
  return NextResponse.redirect(new URL(`/book?error=payment_failed&id=${encodeURIComponent(bookingId)}`, base));
}