import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowsToObjects } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { generateDateExcel, generateAllDatesExcel } from '@/lib/excel';
import { getISTNow, getISTComponents } from '@/lib/dates';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const downloadDate = searchParams.get('download');

    if (downloadDate) {
      console.log(`[Documents] Download requested for ${downloadDate}`);
      const bookings = await getBookingsForDate(downloadDate);
      if (bookings.length === 0) {
        console.log(`[Documents] No bookings found for ${downloadDate}`);
        return NextResponse.json({ error: 'No bookings found for this date' }, { status: 404 });
      }

      const buf = await generateDateExcel(downloadDate, bookings);
      const { dd, mm, yyyy } = getISTComponents(downloadDate);

      console.log(`[Documents] Generated Excel for ${downloadDate}: ${bookings.length} bookings`);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${dd}-${mm}-${yyyy}.xlsx"`,
          'Cache-Control': 'no-store, must-revalidate',
        },
      });
    }

    // List all dates that have confirmed bookings
    const datesResult = await dbExecute(
      `SELECT d.date, COUNT(*) as booking_count
       FROM bookings b
       JOIN dates d ON b.date_id = d.id
       WHERE b.payment_status = 'confirmed'
       GROUP BY d.date
       ORDER BY d.date DESC`
    );

    const dateRows = rowsToObjects(datesResult) as { date: string; booking_count: number }[];
    const documents = dateRows.map((r) => ({
      date: r.date,
      booking_count: r.booking_count,
    }));

    console.log(`[Documents] Listed ${documents.length} dates with confirmed bookings`);
    return NextResponse.json(documents, {
      headers: { 'Cache-Control': 'no-store, must-revalidate' },
    });
  } catch (err: any) {
    console.error('[API /documents] GET error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { date } = await request.json();
    const targetDate = date || getPreviousISTDate();

    console.log(`[Documents] Generating report for ${targetDate}`);
    const bookings = await getBookingsForDate(targetDate);

    if (bookings.length === 0) {
      console.log(`[Documents] No bookings found for ${targetDate}`);
      return NextResponse.json({ error: 'No confirmed bookings for this date' }, { status: 404 });
    }

    const buf = await generateDateExcel(targetDate, bookings);
    const { dd, mm, yyyy } = getISTComponents(targetDate);

    console.log(`[Documents] Generated report for ${targetDate}: ${bookings.length} bookings`);
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${dd}-${mm}-${yyyy}.xlsx"`,
        'Cache-Control': 'no-store, must-revalidate',
      },
    });
  } catch (err: any) {
    console.error('[API /documents] POST error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to generate report' }, { status: 500 });
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
