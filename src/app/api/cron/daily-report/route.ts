import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowsToObjects } from '@/lib/db';
import { generateDateExcel } from '@/lib/excel';
import { getISTNow, getISTComponents } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const auth = process.env.CRON_SECRET;
    if (auth && request.headers.get('authorization') !== `Bearer ${auth}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const targetDate = getPreviousISTDate();
    console.log(`[Cron/Daily Report] Generating report for ${targetDate}`);

    const bookings = await getBookingsForDate(targetDate);

    if (bookings.length === 0) {
      console.log(`[Cron/Daily Report] No bookings for ${targetDate}`);
      return NextResponse.json({
        ok: true,
        date: targetDate,
        bookingCount: 0,
        generated: false,
        reason: 'No confirmed bookings',
        timestamp: new Date().toISOString(),
      });
    }

    const buf = await generateDateExcel(targetDate, bookings);
    const { dd, mm, yyyy } = getISTComponents(targetDate);

    // Store the file in the database or return success
    console.log(`[Cron/Daily Report] Generated ${dd}-${mm}-${yyyy}.xlsx for ${targetDate}: ${bookings.length} bookings`);

    return NextResponse.json({
      ok: true,
      date: targetDate,
      bookingCount: bookings.length,
      generated: true,
      fileName: `${dd}-${mm}-${yyyy}.xlsx`,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Cron/Daily Report] Error:', err?.message || err);
    return NextResponse.json({ error: 'Daily report generation failed' }, { status: 500 });
  }
}

function getPreviousISTDate(): string {
  const now = getISTNow();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const dd = String(yesterday.getDate()).padStart(2, '0');
  const mm = String(yesterday.getMonth() + 1).padStart(2, '0');
  const yyyy = yesterday.getFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

async function getBookingsForDate(dateStr: string) {
  const result = await dbExecute(
    `SELECT b.booking_id, b.exam_center, b.passenger_count, b.amount,
            b.payment_status, b.created_at, b.serial_number,
            b.razorpay_payment_id, b.razorpay_order_id, b.razorpay_bank_ref,
            b.razorpay_status, b.razorpay_method, b.payment_timestamp,
            b.customer_name, b.customer_mobile, b.customer_email,
            d.date, s.time,
            (SELECT p.name FROM passengers p WHERE p.booking_id = b.booking_id ORDER BY p.id LIMIT 1) as name,
            (SELECT p.mobile FROM passengers p WHERE p.booking_id = b.booking_id ORDER BY p.id LIMIT 1) as mobile,
            (SELECT p.gender FROM passengers p WHERE p.booking_id = b.booking_id ORDER BY p.id LIMIT 1) as gender
     FROM bookings b
     JOIN dates d ON b.date_id = d.id
     JOIN slots s ON b.slot_id = s.id
     WHERE b.payment_status = 'confirmed' AND d.date = ?
     ORDER BY s.time ASC, b.created_at ASC`,
    [dateStr]
  );
  return rowsToObjects(result) as any[];
}
