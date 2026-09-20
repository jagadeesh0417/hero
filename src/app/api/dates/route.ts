import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowsToObjects, getDb } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { calcExpiresAt } from '@/lib/expiry';

export async function GET() {
  try {
    const result = await dbExecute('SELECT * FROM dates ORDER BY date DESC');
    return NextResponse.json(rowsToObjects(result));
  } catch (err: any) {
    console.error('[API /dates] GET error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to fetch dates' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { date } = await request.json();
    if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 });

    const existing = await dbExecute('SELECT id FROM dates WHERE date = ?', [date]);
    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Date already exists' }, { status: 400 });
    }

    const expiryRow = await dbExecute("SELECT value FROM settings WHERE key = 'slot_expiry_days'");
    const expiryDays = Number((expiryRow.rows[0] as any)?.value || 3);
    const expiresAt = expiryDays > 0 ? calcExpiresAt(date, expiryDays) : '';

    const db = await getDb();
    const tx = await db.transaction('write');

    try {
      const insertResult = await tx.execute({
        sql: 'INSERT INTO dates (date) VALUES (?)',
        args: [date],
      });
      const dateId = Number(insertResult.lastInsertRowid);

      const timings = ['07:30', '10:30', '13:00', '15:30'];
      for (const time of timings) {
        const existing = await tx.execute({
          sql: 'SELECT id FROM slots WHERE date_id = ? AND time = ?',
          args: [dateId, time],
        });
        if (existing.rows.length === 0) {
          await tx.execute({
            sql: "INSERT INTO slots (date_id, time, enabled, vehicle_time, expiry_days, expires_at, status) VALUES (?, ?, 1, ?, ?, ?, 'active')",
            args: [dateId, time, '', expiryDays, expiresAt],
          });
        }
      }

      await tx.commit();
      return NextResponse.json({ id: dateId, date }, { status: 201 });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (err: any) {
    console.error('[API /dates] POST error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to create date' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, date } = await request.json();
    if (!id || !date) return NextResponse.json({ error: 'ID and date are required' }, { status: 400 });

    await dbExecute('UPDATE dates SET date = ? WHERE id = ?', [date, id]);

    const expiryRow = await dbExecute("SELECT value FROM settings WHERE key = 'slot_expiry_days'");
    const expiryDays = Number((expiryRow.rows[0] as any)?.value || 3);
    const expiresAt = expiryDays > 0 ? calcExpiresAt(date, expiryDays) : '';
    await dbExecute("UPDATE slots SET expires_at = ? WHERE date_id = ? AND status = 'active'", [expiresAt, id]);

    return NextResponse.json({ message: 'Date updated' });
  } catch (err: any) {
    console.error('[API /dates] PUT error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to update date' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id || isNaN(Number(id))) {
      return NextResponse.json({ error: 'Valid date ID is required' }, { status: 400 });
    }

    const dateId = Number(id);

    const existing = await dbExecute('SELECT id, date FROM dates WHERE id = ?', [dateId]);
    if (!existing.rows || existing.rows.length === 0) {
      return NextResponse.json({ error: 'Date not found' }, { status: 404 });
    }

    const db = await getDb();
    const tx = await db.transaction('write');

    try {
      await tx.execute({ sql: 'DELETE FROM vehicles WHERE slot_id IN (SELECT id FROM slots WHERE date_id = ?)', args: [dateId] });
      await tx.execute({ sql: 'DELETE FROM slots WHERE date_id = ?', args: [dateId] });
      // Bookings are never deleted by date deletion — only slots and vehicles are removed.
      // Confirmed and pending booking records are preserved permanently.
      await tx.commit();
      return NextResponse.json({ message: 'Date slots deleted. All bookings preserved.' });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (err: any) {
    console.error('[API /dates] DELETE error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to delete date' }, { status: 500 });
  }
}
