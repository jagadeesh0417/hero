import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { verifyPaymentSignature, confirmBooking } from '@/lib/razorpay';
import { dbExecute } from '@/lib/db';

export const maxDuration = 30;

async function logEvent(orderId: string, paymentId: string, event: string, status: string, bookingId: string, errorMsg?: string) {
  try {
    await dbExecute(
      `INSERT INTO payment_events (razorpay_order_id, razorpay_payment_id, event, status, signature_valid, booking_id, raw_payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [orderId, paymentId || '', event, status, status === 'signature_valid' ? 1 : 0, bookingId || '', errorMsg || '']
    );
  } catch (err: any) {
    console.error('[Verify] logEvent error:', err?.message || err);
  }
}

export async function POST(request: NextRequest) {
  try {
    const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();

    if (!booking_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing required payment fields' }, { status: 400 });
    }

    await logEvent(razorpay_order_id, razorpay_payment_id, 'checkout_callback', 'received', booking_id);

    const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      await logEvent(razorpay_order_id, razorpay_payment_id, 'checkout_callback', 'signature_invalid', booking_id, `Signature verification failed`);
      console.error(`[Verify] Invalid signature for booking ${booking_id}, order ${razorpay_order_id}`);
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    await logEvent(razorpay_order_id, razorpay_payment_id, 'checkout_callback', 'signature_valid', booking_id);

    const result = await confirmBooking(booking_id, razorpay_order_id, razorpay_payment_id);

    if (!result.success) {
      await logEvent(razorpay_order_id, razorpay_payment_id, 'checkout_callback', 'confirm_failed', booking_id, result.error || '');
      console.error(`[Verify] confirmBooking failed for ${booking_id}: ${result.error}`);
      return NextResponse.json({ error: result.error || 'Payment verification failed' }, { status: 500 });
    }

    // Revalidate admin pages so data updates immediately
    try {
      revalidatePath('/admin');
      revalidatePath('/api/documents');
    } catch (err: any) {
      console.error('[Verify] revalidatePath error:', err?.message || err);
    }

    await logEvent(razorpay_order_id, razorpay_payment_id, 'checkout_callback', 'confirmed', booking_id);

    return NextResponse.json({
      success: true,
      payment_id: razorpay_payment_id,
      booking_id,
      serial_number: result.serial_number,
    });
  } catch (err: any) {
    console.error('[Verify] Error:', err?.name, err?.message, err?.stack);
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}