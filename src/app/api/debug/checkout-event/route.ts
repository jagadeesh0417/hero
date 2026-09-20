import { NextRequest, NextResponse } from 'next/server';
import { dbExecute } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { bookingId, event, detail } = await request.json();
    const userAgent = request.headers.get('user-agent') || '';

    if (!bookingId || !event) {
      return NextResponse.json({ error: 'bookingId and event are required' }, { status: 400 });
    }

    // Write to payment_events table
    await dbExecute(
      `INSERT INTO payment_events (razorpay_order_id, razorpay_payment_id, event, status, signature_valid, booking_id, raw_payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        '',
        '',
        `client_${event}`,
        detail || 'info',
        0,
        bookingId,
        JSON.stringify({ userAgent: userAgent.slice(0, 200), detail: detail || '' }).slice(0, 2000),
      ]
    );

    return NextResponse.json({ logged: true });
  } catch (err: any) {
    console.error('[checkout-event] Error:', err?.name, err?.message);
    return NextResponse.json({ error: 'Failed to log event' }, { status: 500 });
  }
}