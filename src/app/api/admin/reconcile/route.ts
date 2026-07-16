import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { dbExecute, rowToObject } from '@/lib/db';
import { confirmBooking } from '@/lib/razorpay';
import Razorpay from 'razorpay';

export const maxDuration = 60;

export async function POST() {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const results: { scanned: number; repaired: string[]; mismatched: string[]; orphaned: string[]; errors: string[] } = {
    scanned: 0,
    repaired: [],
    mismatched: [],
    orphaned: [],
    errors: [],
  };

  try {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return NextResponse.json({ error: 'Razorpay not configured' }, { status: 500 });
    }

    const rzp = new Razorpay({ key_id: keyId, key_secret: keySecret });

    // Fetch orders from last 30 days, up to 100
    const orders = await rzp.orders.all({ from: Math.floor(Date.now() / 1000) - 30 * 86400, count: 100 });

    for (const order of orders.items || []) {
      results.scanned++;

      if (order.status !== 'paid') continue;

      const razorpayOrderId = order.id;
      const bookingResult = await dbExecute(
        "SELECT booking_id, payment_status, amount FROM bookings WHERE razorpay_order_id = ?",
        [razorpayOrderId]
      );
      const booking = rowToObject(bookingResult);

      if (!booking) {
        results.orphaned.push(razorpayOrderId);
        continue;
      }

      const paymentStatus = booking.payment_status as string;
      const bookingId = booking.booking_id as string;
      const bookingAmount = Number(booking.amount) || 0;
      const paidAmount = (Number(order.amount_paid) || 0) / 100; // paise to rupees

      if (paymentStatus === 'confirmed') continue; // already OK

      if (Math.abs(bookingAmount - paidAmount) > 1) {
        // Amount mismatch — log for manual review
        results.mismatched.push(`${bookingId}: expected ₹${bookingAmount}, paid ₹${paidAmount}`);
        continue;
      }

      // Fetch payment ID for this order
      let paymentId = '';
      try {
        const payments = await rzp.orders.fetchPayments(razorpayOrderId);
        const captured = (payments.items || []).find((p: any) => p.status === 'captured');
        if (captured) paymentId = captured.id;
      } catch (err: any) {
        console.error(`[Reconcile] fetchPayments error for ${razorpayOrderId}:`, err?.message || err);
      }

      if (!paymentId) {
        results.errors.push(`${bookingId}: paid but no payment ID found`);
        continue;
      }

      // Confirm the booking
      const result = await confirmBooking(bookingId, razorpayOrderId, paymentId);
      if (result.success) {
        results.repaired.push(`${bookingId} → serial ${result.serial_number}`);
        console.log(`[Reconcile] Repaired booking ${bookingId}`);
      } else {
        results.errors.push(`${bookingId}: ${result.error}`);
      }
    }

    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    console.error('[Reconcile] Error:', err?.name, err?.message, err?.stack);
    return NextResponse.json({ error: 'Reconciliation failed', detail: err?.message }, { status: 500 });
  }
}