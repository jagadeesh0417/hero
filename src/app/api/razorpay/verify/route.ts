import { NextRequest, NextResponse } from 'next/server';
import { getDb, rowToObject } from '@/lib/db';
import { verifyPaymentSignature, fetchPayment } from '@/lib/razorpay';

const SLOT_BASE: Record<string, number> = {
  '07:30': 1000,
  '10:30': 2000,
  '13:00': 3000,
  '15:30': 4000,
};

function getSlotBase(time: string): number {
  return SLOT_BASE[time] || 1000;
}

export async function POST(request: NextRequest) {
  try {
    const { booking_id, razorpay_order_id, razorpay_payment_id, razorpay_signature } = await request.json();

    if (!booking_id || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json({ error: 'Missing required payment fields' }, { status: 400 });
    }

    const isValid = verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);
    if (!isValid) {
      return NextResponse.json({ error: 'Payment verification failed' }, { status: 400 });
    }

    let paymentDetails;
    try {
      paymentDetails = await fetchPayment(razorpay_payment_id);
    } catch {
      return NextResponse.json({ error: 'Failed to fetch payment details from Razorpay' }, { status: 502 });
    }

    const db = await getDb();
    const tx = await db.transaction('write');

    try {
      const bookingResult = await tx.execute({
        sql: "SELECT b.*, s.time FROM bookings b JOIN slots s ON b.slot_id = s.id WHERE b.booking_id = ?",
        args: [booking_id],
      });
      const booking = rowToObject(bookingResult);

      if (!booking) {
        await tx.rollback();
        return NextResponse.json({ error: 'Booking not found' }, { status: 404 });
      }

      if (booking.payment_status === 'confirmed') {
        await tx.rollback();
        return NextResponse.json({ error: 'Payment already completed' }, { status: 400 });
      }

      const slotTime = booking.time as string;
      const base = getSlotBase(slotTime);
      const dateId = booking.date_id as number;
      const slotId = booking.slot_id as number;

      const maxResult = await tx.execute({
        sql: "SELECT MAX(serial_number) as max_serial FROM bookings WHERE date_id = ? AND slot_id = ? AND payment_status = 'confirmed'",
        args: [dateId, slotId],
      });
      const maxRow = rowToObject(maxResult);
      const maxSerial = maxRow?.max_serial ? Number(maxRow.max_serial) : 0;
      const nextSerial = maxSerial > 0 ? maxSerial + 1 : base;

      await tx.execute({
        sql: `UPDATE bookings SET 
          payment_status = 'confirmed',
          razorpay_payment_id = ?,
          razorpay_status = ?,
          razorpay_method = ?,
          razorpay_bank_ref = ?,
          serial_number = ?,
          payment_timestamp = datetime('now')
        WHERE booking_id = ?`,
        args: [
          razorpay_payment_id,
          paymentDetails.status,
          paymentDetails.method,
          paymentDetails.bank_transaction_id || '',
          nextSerial,
          booking_id,
        ],
      });

      await tx.commit();

      return NextResponse.json({
        success: true,
        payment_id: razorpay_payment_id,
        booking_id,
        serial_number: nextSerial,
      });
    } catch (e) {
      try { await tx.rollback(); } catch {}
      throw e;
    }
  } catch (err: any) {
    console.error('[API /razorpay/verify] error:', err?.message || err);
    return NextResponse.json({ error: 'Payment verification failed' }, { status: 500 });
  }
}
