import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowToObject } from '@/lib/db';
import { verifyWebhookSignature } from '@/lib/bharatpe';

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get('x-bharatpe-signature') || '';
    const secret = process.env.BHARATPE_WEBHOOK_SECRET || '';

    // Verify webhook signature if secret is configured
    if (secret && !verifyWebhookSignature(body, signature, secret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const payload = JSON.parse(body);
    const { order_id, status, txn_id, amount, payment_timestamp } = payload;

    if (!order_id) {
      return NextResponse.json({ error: 'Missing order_id' }, { status: 400 });
    }

    const booking = rowToObject(
      await dbExecute(
        "SELECT booking_id, payment_status FROM bookings WHERE bharatpe_order_id = ? OR booking_id = ?",
        [order_id, order_id]
      )
    );
    const bkId = booking?.booking_id as string | undefined;
    const bkStatus = booking?.payment_status as string | undefined;

    if (!bkId) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
    }

    if (status === 'SUCCESS' && bkStatus !== 'confirmed') {
      await dbExecute(
        `UPDATE bookings SET payment_status = 'confirmed', bharatpe_txn_id = ?,
         payment_timestamp = datetime('now') WHERE booking_id = ?`,
        [txn_id || '', bkId]
      );
    } else if (status === 'FAILED' && bkStatus !== 'confirmed') {
      await dbExecute(
        "UPDATE bookings SET payment_status = 'failed' WHERE booking_id = ?",
        [bkId]
      );
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('[API /bharatpe/webhook] error:', err?.message || err);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}
