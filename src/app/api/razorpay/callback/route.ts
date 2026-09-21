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

// Shared handler for Razorpay's browser callback (hosted checkout with
// redirect:true or callback_method configured on Razorpay's side). This is ONLY
// a fallback/reconciliation mechanism: the current checkout uses the inline
// Razorpay handler + POST /api/razorpay/verify, so customers never navigate to
// this URL in the normal flow. Whatever the method, the callback ALWAYS
// verifies the payment server-side and then redirects the browser to a real
// customer-facing page — never an API body, never a 405.
async function handleCallback(baseUrl: string, params: URLSearchParams, redirectStatus: 307 | 303) {
  const redir = (relative: string) => NextResponse.redirect(new URL(relative, baseUrl), redirectStatus);

  const orderId = params.get('razorpay_order_id') || '';
  const paymentId = params.get('razorpay_payment_id') || '';
  const signature = params.get('razorpay_signature') || '';
  const errorCode = params.get('error_code') || '';
  const errorDescription = params.get('error_description') || '';

  if (!orderId) {
    console.error('[RzCallback] No razorpay_order_id in callback');
    return redir('/book?error=payment_failed');
  }

  const bookingResult = await dbExecute(
    'SELECT booking_id, payment_status FROM bookings WHERE razorpay_order_id = ?',
    [orderId]
  );
  const booking = rowToObject(bookingResult);

  if (!booking) {
    console.error(`[RzCallback] No booking found for order ${orderId}`);
    return redir('/book?error=payment_failed');
  }

  const bookingId = booking.booking_id as string;
  await logEvent(orderId, paymentId, 'checkout_return', errorCode ? 'failed' : paymentId ? 'received' : 'cancelled', bookingId, errorDescription || '');

  // Successful payment — verify the signature server-side, then confirm.
  if (paymentId && signature) {
    const isValid = verifyPaymentSignature(orderId, paymentId, signature);
    await logEvent(orderId, paymentId, 'checkout_return', isValid ? 'signature_valid' : 'signature_invalid', bookingId);

    if (!isValid) {
      console.error(`[RzCallback] Invalid signature for order ${orderId}, payment ${paymentId}`);
      return redir(`/book?error=payment_failed&id=${encodeURIComponent(bookingId)}`);
    }

    let result;
    try {
      result = await confirmBooking(bookingId, orderId, paymentId);
    } catch (err: unknown) {
      // confirmBooking throws only after exhausting its DB retries. Never show
      // the customer a raw 500 after a successful payment — send them back to a
      // recovery state that knows the payment succeeded (no second charge).
      console.error(`[RzCallback] confirmBooking threw for ${bookingId}:`, err instanceof Error ? err.message : err);
      await logEvent(orderId, paymentId, 'confirm_throw', 'server_error', bookingId, err instanceof Error ? err.message : 'unknown');
      return redir(`/book?error=payment_detected&id=${encodeURIComponent(bookingId)}`);
    }

    if (result.success) {
      console.log(`[RzCallback] Booking ${bookingId} confirmed, serial=${result.serial_number}`);
      try {
        revalidatePath('/admin');
        revalidatePath('/api/documents');
      } catch (err: unknown) {
        console.error('[RzCallback] revalidatePath error:', err instanceof Error ? err.message : err);
      }
      return redir(`/success?id=${encodeURIComponent(bookingId)}`);
    }

    console.error(`[RzCallback] confirmBooking failed for ${bookingId}: ${result.error}`);
    return redir(`/book?error=server_error&id=${encodeURIComponent(bookingId)}`);
  }

  // Cancelled or failed payment — leave the booking pending so the customer can
  // retry against the same payable order (create-order reuses non-duplicate orders).
  if (errorCode) {
    console.warn(`[RzCallback] Payment failed for booking ${bookingId}, order ${orderId}: ${errorDescription || errorCode}`);
  } else {
    console.log(`[RzCallback] Payment cancelled for booking ${bookingId}, order ${orderId}`);
  }
  return redir(`/book?error=payment_failed&id=${encodeURIComponent(bookingId)}`);
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  return handleCallback(request.url, url.searchParams, 307);
}

// If Razorpay is (still) configured with callback_method: 'POST' — e.g. an
// older checkout snippet or dashboard setting — the browser posts the same
// fields. Accept both form-encoded and JSON so it can never 405, verify,
// confirm, then redirect to a real page.
export async function POST(request: NextRequest) {
  const contentType = request.headers.get('content-type') || '';
  let params = new URLSearchParams();

  if (contentType.includes('application/json')) {
    try {
      const body = await request.json();
      for (const [k, v] of Object.entries(body)) {
        if (typeof v === 'string') params.set(k, v);
      }
    } catch (err: unknown) {
      console.error('[RzCallback] Invalid JSON body:', err instanceof Error ? err.message : err);
    }
  } else {
    const text = await request.text();
    try {
      params = new URLSearchParams(text);
    } catch (err: unknown) {
      console.error('[RzCallback] Invalid form body:', err instanceof Error ? err.message : err);
    }
  }

  return handleCallback(request.url, params, 303);
}