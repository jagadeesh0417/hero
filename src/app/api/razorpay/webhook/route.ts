import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import crypto from 'crypto';
import { confirmBooking } from '@/lib/razorpay';
import { dbExecute, rowToObject } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';

function verifyWebhookSignature(body: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn('[Webhook] RAZORPAY_WEBHOOK_SECRET not set — skipping signature validation');
    return true;
  }
  const expected = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(body)
    .digest('hex');
  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected, 'utf-8'), Buffer.from(signature, 'utf-8'));
  } catch {
    return false;
  }
}

async function logPaymentEvent(razorpayOrderId: string, razorpayPaymentId: string, event: string, status: string, amount: number, signatureValid: boolean, bookingId: string | null, rawPayload: string) {
  try {
    await dbExecute(
      `INSERT INTO payment_events (razorpay_order_id, razorpay_payment_id, event, status, amount, signature_valid, booking_id, raw_payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [razorpayOrderId, razorpayPaymentId || '', event, status, amount, signatureValid ? 1 : 0, bookingId || '', rawPayload.slice(0, 2000)]
    );
  } catch (err: any) {
    console.error('[Webhook] logPaymentEvent error:', err?.message || err);
  }
}

async function processPayment(payment: any): Promise<NextResponse> {
  const razorpayPaymentId = payment.id;
  const razorpayOrderId = payment.order_id;
  const amount = Number(payment.amount) || 0;

  if (!razorpayPaymentId || !razorpayOrderId) {
    return NextResponse.json({ error: 'Missing payment or order ID' }, { status: 400 });
  }

  // Find the booking by razorpay_order_id
  const bookingResult = await dbExecute(
    "SELECT booking_id, payment_status FROM bookings WHERE razorpay_order_id = ?",
    [razorpayOrderId]
  );
  const booking = rowToObject(bookingResult);

  if (!booking) {
    console.error(`[Webhook] No booking found for order ${razorpayOrderId}`);
    await logPaymentEvent(razorpayOrderId, razorpayPaymentId, 'webhook', 'booking_not_found', amount, true, null, '');
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
  }

  const bookingId = booking.booking_id as string;
  const paymentStatus = booking.payment_status as string;

  if (paymentStatus === 'confirmed') {
    console.log(`[Webhook] Booking ${bookingId} already confirmed — skipping`);
    await logPaymentEvent(razorpayOrderId, razorpayPaymentId, 'webhook', 'already_confirmed', amount, true, bookingId, '');
    return NextResponse.json({ status: 'already_confirmed', booking_id: bookingId });
  }

  // Confirm the booking
  const result = await confirmBooking(bookingId, razorpayOrderId, razorpayPaymentId);

  if (!result.success) {
    console.error(`[Webhook] confirmBooking failed for ${bookingId}: ${result.error}`);
    await logPaymentEvent(razorpayOrderId, razorpayPaymentId, 'webhook', 'confirm_failed', amount, true, bookingId, '');
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  console.log(`[Webhook] Booking ${bookingId} confirmed via webhook, serial=${result.serial_number}`);
  await logPaymentEvent(razorpayOrderId, razorpayPaymentId, 'webhook', 'confirmed', amount, true, bookingId, '');
  try { revalidatePath('/admin'); revalidatePath('/api/documents'); } catch {}
  return NextResponse.json({ status: 'confirmed', booking_id: bookingId, serial_number: result.serial_number });
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-razorpay-signature') || '';
    const rawBody = await request.text();

    if (!verifyWebhookSignature(rawBody, signature)) {
      console.error('[Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const event = JSON.parse(rawBody);
    const eventType = event.event;
    const payment = event.payload?.payment?.entity;
    const order = event.payload?.order?.entity;

    await logPaymentEvent(
      order?.id || payment?.order_id || '',
      payment?.id || '',
      eventType,
      'received',
      Number(payment?.amount || order?.amount || 0),
      true,
      null,
      rawBody.slice(0, 500)
    );

    if (eventType === 'payment.captured' && payment) {
      console.log(`[Webhook] payment.captured: ${payment.id} for order ${payment.order_id}`);
      return await processPayment(payment);
    }

    if (eventType === 'order.paid' && order) {
      console.log(`[Webhook] order.paid: ${order.id}`);
      // For order.paid, fetch the payments to get the payment ID
      const { fetchOrderPayments } = await import('@/lib/razorpay');
      try {
        const payments = await fetchOrderPayments(order.id);
        const capturedPayment = payments.find((p: any) => p.status === 'captured') || payments[0];
        if (capturedPayment) {
          const mockPayment = { id: capturedPayment.id, order_id: order.id, amount: order.amount_paid || 0 };
          return await processPayment(mockPayment);
        }
        console.error(`[Webhook] order.paid but no payments found for ${order.id}`);
        return NextResponse.json({ status: 'no_payments', order_id: order.id });
      } catch (err: any) {
        console.error(`[Webhook] fetchOrderPayments error for order.paid:`, err?.message || err);
        return NextResponse.json({ error: 'Failed to fetch payments for order' }, { status: 500 });
      }
    }

    // Ignore other event types
    console.log(`[Webhook] Ignored event: ${eventType}`);
    return NextResponse.json({ status: 'ignored', event: eventType });
  } catch (err: any) {
    console.error('[Webhook] Error:', err?.name, err?.message, err?.stack);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}