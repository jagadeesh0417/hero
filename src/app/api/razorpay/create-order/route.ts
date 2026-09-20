import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { dbExecute, rowToObject } from '@/lib/db';
import { createOrder, assertRazorpayEnv, fetchOrderStatus } from '@/lib/razorpay';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    assertRazorpayEnv();

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

    const amount = Number(booking.amount);
    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid booking amount' }, { status: 400 });
    }

    const expectedAmountPaise = Math.round(amount * 100);

    // Reuse an existing Razorpay order when the booking already has one that is
    // still payable. Razorpay supports retries against the same order_id, so a
    // retry/cancelled checkout must NOT create a duplicate order.
    const existingOrderId = (booking.razorpay_order_id as string) || '';
    let order: { id: string; amount: number; currency: string } | null = null;
    let reusedOrder = false;

    if (existingOrderId) {
      try {
        const existing = await fetchOrderStatus(existingOrderId);
        const isPayable =
          (existing.status === 'created' || existing.status === 'attempted') &&
          existing.amount === expectedAmountPaise &&
          existing.amount_due > 0;
        if (isPayable) {
          order = { id: existingOrderId, amount: existing.amount_due, currency: 'INR' };
          reusedOrder = true;
          console.log(`[create-order] Reusing existing order ${existingOrderId} for booking ${booking_id}`);
        }
      } catch (err: unknown) {
        console.warn(`[create-order] Reuse check failed for ${existingOrderId} (${err instanceof Error ? err.message : err}) — will create a new order`);
      }
    }

    if (!order) {
      order = await createOrder(amount, booking_id);
      console.log(`[create-order] Created new order ${order.id} for booking ${booking_id}, amount_paise=${expectedAmountPaise}`);
    }

    const passengersResult = await dbExecute(
      'SELECT name, mobile FROM passengers WHERE booking_id = ? ORDER BY id LIMIT 1',
      [booking_id]
    );
    const primaryPassenger = (passengersResult.rows[0] || {}) as any;

    // Generate receipt token — unguessable, used to authorise receipt download
    const receiptToken = crypto.randomBytes(24).toString('hex');

    await dbExecute(
      `UPDATE bookings SET razorpay_order_id = ?, customer_name = ?, customer_mobile = ?, receipt_token = ? WHERE booking_id = ?`,
      [order.id, primaryPassenger.name || '', primaryPassenger.mobile || '', receiptToken, booking_id]
    );

    // Log payment event (order_created for fresh orders, order_reused on retry)
    try {
      await dbExecute(
        `INSERT INTO payment_events (razorpay_order_id, razorpay_payment_id, event, status, amount, booking_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [order.id, '', reusedOrder ? 'order_reused' : 'order_created', 'created', Math.round(amount * 100), booking_id]
      );
    } catch (e: any) {
      console.error('[create-order] logPaymentEvent error:', e?.message || e);
    }

    return NextResponse.json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
      key_id: process.env.RAZORPAY_KEY_ID || '',
      customer_name: primaryPassenger.name || 'Customer',
      customer_mobile: primaryPassenger.mobile || '',
      receipt_token: receiptToken,
      booking_id,
    });
  } catch (err: any) {
    console.error('[create-order] Error:', JSON.stringify(err, Object.getOwnPropertyNames(err)));
    // Razorpay SDK errors carry structured fields — surface them
    const statusCode = err.statusCode || 500;
    const description = err.error?.description || err.message || 'Failed to create payment order';
    const code = err.error?.code;
    const field = err.error?.field;
    return NextResponse.json({
      error: description,
      ...(code ? { code } : {}),
      ...(field ? { field } : {}),
    }, { status: statusCode });
  }
}