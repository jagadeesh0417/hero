import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { dbExecute, rowsToObjects } from '@/lib/db';
import { fetchOrderStatus, fetchOrderPayments, confirmBooking } from '@/lib/razorpay';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

interface FixResult {
  scanned: number;
  alreadyConfirmed: number;
  repaired: string[];
  failed: string[];
  noOrderId: number;
  notPaid: number;
  errors: string[];
}

export async function GET() {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const result: FixResult = {
    scanned: 0,
    alreadyConfirmed: 0,
    repaired: [],
    failed: [],
    noOrderId: 0,
    notPaid: 0,
    errors: [],
  };

  try {
    // Fetch all bookings with payment_status = 'pending' that have a razorpay_order_id
    const bookings = rowsToObjects(await dbExecute(
      "SELECT booking_id, razorpay_order_id, payment_status, amount FROM bookings WHERE payment_status = 'pending' AND razorpay_order_id != '' ORDER BY created_at DESC"
    ));

    result.scanned = bookings.length;

    for (const b of bookings) {
      const bookingId = b.booking_id as string;
      const razorpayOrderId = b.razorpay_order_id as string;

      if (!razorpayOrderId) {
        result.noOrderId++;
        continue;
      }

      console.log(`[FixStuck] Checking booking ${bookingId}, order=${razorpayOrderId}`);

      try {
        const order = await fetchOrderStatus(razorpayOrderId);

        if (order.status !== 'paid') {
          console.log(`[FixStuck] Booking ${bookingId}: order status = ${order.status}, skipping`);
          result.notPaid++;
          continue;
        }

        // Order is paid — fetch payment ID
        const payments = await fetchOrderPayments(razorpayOrderId);
        const capturedPayment = payments.find(p => p.status === 'captured') || payments[0];

        if (!capturedPayment) {
          result.errors.push(`${bookingId}: paid but no captured payment found`);
          continue;
        }

        // Confirm the booking
        const confirmResult = await confirmBooking(bookingId, razorpayOrderId, capturedPayment.id);

        if (confirmResult.success) {
          result.repaired.push(`${bookingId} → serial ${confirmResult.serial_number}`);
          console.log(`[FixStuck] ✓ Repaired booking ${bookingId}, serial=${confirmResult.serial_number}`);
        } else {
          result.failed.push(`${bookingId}: ${confirmResult.error}`);
          console.error(`[FixStuck] ✗ Failed to repair ${bookingId}: ${confirmResult.error}`);
        }
      } catch (err: any) {
        result.errors.push(`${bookingId}: ${err?.message || 'Unknown error'}`);
        console.error(`[FixStuck] Error processing ${bookingId}:`, err?.message || err);
      }
    }

    console.log(`[FixStuck] Complete: scanned=${result.scanned}, repaired=${result.repaired.length}, errors=${result.errors.length}`);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err: any) {
    console.error('[FixStuck] Unhandled error:', err?.message || err);
    return NextResponse.json({ error: 'Fix stuck bookings failed', detail: err?.message }, { status: 500 });
  }
}