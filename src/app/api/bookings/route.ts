import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowsToObjects, getDb } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { generateBookingId } from '@/lib/utils';

export async function GET(request: NextRequest) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    let query = `
      SELECT b.*, d.date, s.time, s.vehicle_time
      FROM bookings b
      JOIN dates d ON b.date_id = d.id
      JOIN slots s ON b.slot_id = s.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (search) {
      query += ' AND (b.booking_id LIKE ? OR d.date LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    if (status) {
      query += ' AND b.payment_status = ?';
      params.push(status);
    }

    query += ' ORDER BY b.created_at DESC';

    const result = await dbExecute(query, params);
    return NextResponse.json(rowsToObjects(result));
  } catch (err: any) {
    console.error('[API /bookings] GET error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { date_id, slot_id, passengers, exam_center } = await request.json();

    if (!date_id || !slot_id || !passengers || !Array.isArray(passengers) || passengers.length === 0) {
      return NextResponse.json({ error: 'Invalid booking data' }, { status: 400 });
    }

    if (!exam_center) {
      return NextResponse.json({ error: 'Exam center is required' }, { status: 400 });
    }

    for (const p of passengers) {
      if (!p.name || !p.mobile || !p.gender) {
        return NextResponse.json({ error: 'All passenger fields are required' }, { status: 400 });
      }
      if (!/^[6-9]\d{9}$/.test(p.mobile)) {
        return NextResponse.json({ error: `Invalid mobile number for ${p.name}` }, { status: 400 });
      }
    }

    const slotResult = await dbExecute('SELECT * FROM slots WHERE id = ? AND enabled = 1', [slot_id]);
    if (slotResult.rows.length === 0) {
      return NextResponse.json({ error: 'Slot not found or disabled' }, { status: 400 });
    }

    const priceResult = await dbExecute("SELECT value FROM settings WHERE key = 'price_per_ticket'");
    const priceRow = priceResult.rows[0] as any;
    const pricePerTicket = priceRow ? Number(priceRow.value) : 500;
    const amount = passengers.length * pricePerTicket;
    const bookingId = generateBookingId();

    const db = await getDb();
    const tx = await db.transaction('write');
    try {
      await tx.execute({
        sql: 'INSERT INTO bookings (booking_id, date_id, slot_id, passenger_count, amount, payment_status, exam_center) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [bookingId, date_id, slot_id, passengers.length, amount, 'pending', exam_center],
      });

      for (const p of passengers) {
        await tx.execute({
          sql: 'INSERT INTO passengers (booking_id, name, mobile, gender) VALUES (?, ?, ?, ?)',
          args: [bookingId, p.name, p.mobile, p.gender],
        });
      }

      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }

    return NextResponse.json(
      {
        booking_id: bookingId,
        amount,
        passenger_count: passengers.length,
        payment_status: 'pending',
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[API /bookings] POST error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
