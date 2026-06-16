import { NextRequest, NextResponse } from 'next/server';
import db, { rowsToObjects } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const dateId = searchParams.get('date_id');

  let result;
  if (dateId) {
    result = await db.execute({
      sql: 'SELECT * FROM slots WHERE date_id = ? ORDER BY time ASC',
      args: [Number(dateId)],
    });
  } else {
    result = await db.execute({
      sql: `SELECT s.*, d.date FROM slots s 
           JOIN dates d ON s.date_id = d.id 
           ORDER BY d.date DESC, s.time ASC`,
    });
  }

  return NextResponse.json(rowsToObjects(result));
}

export async function POST(request: Request) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { date_id, time, capacity } = await request.json();
    if (!date_id || !time || !capacity) {
      return NextResponse.json({ error: 'date_id, time, and capacity are required' }, { status: 400 });
    }

    const result = await db.execute({
      sql: 'INSERT INTO slots (date_id, time, capacity, available) VALUES (?, ?, ?, ?)',
      args: [date_id, time, capacity, capacity],
    });

    return NextResponse.json(
      { id: Number(result.lastInsertRowid), date_id, time, capacity },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Failed to create slot' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, time, capacity, enabled } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (time !== undefined) { updates.push('time = ?'); values.push(time); }
    if (capacity !== undefined) { updates.push('capacity = ?', 'available = ?'); values.push(capacity, capacity); }
    if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    await db.execute({
      sql: `UPDATE slots SET ${updates.join(', ')} WHERE id = ?`,
      args: values,
    });

    return NextResponse.json({ message: 'Slot updated' });
  } catch {
    return NextResponse.json({ error: 'Failed to update slot' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await db.execute({ sql: 'DELETE FROM slots WHERE id = ?', args: [Number(id)] });
    return NextResponse.json({ message: 'Slot deleted' });
  } catch {
    return NextResponse.json({ error: 'Failed to delete slot' }, { status: 500 });
  }
}
