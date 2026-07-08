import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowToObject } from '@/lib/db';
import { verifyPayment } from '@/lib/bharatpe';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orderId = searchParams.get('order_id') || searchParams.get('orderId');
    const txnStatus = searchParams.get('status') || searchParams.get('txn_status');
    const txnId = searchParams.get('txn_id') || searchParams.get('bharatpe_txn_id');

    if (!orderId) {
      return NextResponse.redirect(new URL('/book?error=missing_order', request.url));
    }

    let paymentStatus = 'pending';
    let verifiedTxnId = txnId || '';
    let verified = false;

    // Verify with BharatPe API
    const verification = await verifyPayment(orderId);
    if (verification.success && verification.status === 'SUCCESS') {
      paymentStatus = 'confirmed';
      verifiedTxnId = verification.txn_id || txnId || '';
      verified = true;
    } else if (verification.status === 'FAILED' || txnStatus === 'FAILED') {
      paymentStatus = 'failed';
    }

    // Update booking
    const bookingResult = await dbExecute(
      "SELECT booking_id, payment_status FROM bookings WHERE bharatpe_order_id = ? OR booking_id = ?",
      [orderId, orderId]
    );
    const booking = rowToObject(bookingResult);
    const bkId = booking?.booking_id as string | undefined;
    const bkStatus = booking?.payment_status as string | undefined;

    if (bkId) {
      if (paymentStatus === 'confirmed' && bkStatus !== 'confirmed') {
        await dbExecute(
          `UPDATE bookings SET payment_status = 'confirmed', bharatpe_txn_id = ?,
           payment_timestamp = datetime('now') WHERE booking_id = ?`,
          [verifiedTxnId, bkId]
        );
        return NextResponse.redirect(
          new URL(`/success?id=${bkId}`, request.url)
        );
      } else if (paymentStatus === 'failed') {
        await dbExecute(
          "UPDATE bookings SET payment_status = 'failed' WHERE booking_id = ?",
          [bkId]
        );
        return NextResponse.redirect(
          new URL(`/book?error=payment_failed&id=${bkId}`, request.url)
        );
      }
      // Already confirmed
      if (bkStatus === 'confirmed') {
        return NextResponse.redirect(
          new URL(`/success?id=${bkId}`, request.url)
        );
      }
    }

    return NextResponse.redirect(new URL('/book?error=unknown', request.url));
  } catch (err: any) {
    console.error('[API /bharatpe/callback] error:', err?.message || err);
    return NextResponse.redirect(new URL('/book?error=server_error', request.url));
  }
}
