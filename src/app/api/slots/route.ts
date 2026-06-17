import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowsToObjects } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateId = searchParams.get('date_id');

    let result;
    if (dateId) {
      result = await dbExecute('SELECT * FROM slots WHERE date_id = ? ORDER BY time ASC', [Number(dateId)]);
    } else {
      result = await dbExecute(
        `SELECT s.*, d.date FROM slots s 
         JOIN dates d ON s.date_id = d.id 
         ORDER BY d.date DESC, s.time ASC`
      );
    }

    return NextResponse.json(rowsToObjects(result));
  } catch (err: any) {
    console.error('[API /slots] GET error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to fetch slots' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { date_id, time } = await request.json();
    if (!date_id || !time) {
      return NextResponse.json({ error: 'date_id and time are required' }, { status: 400 });
    }

    const result = await dbExecute(
      'INSERT INTO slots (date_id, time) VALUES (?, ?)',
      [date_id, time]
    );

    return NextResponse.json(
      { id: Number(result.lastInsertRowid), date_id, time },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[API /slots] POST error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to create slot' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, time, enabled } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (time !== undefined) { updates.push('time = ?'); values.push(time); }
    if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    values.push(id);
    await dbExecute(`UPDATE slots SET ${updates.join(', ')} WHERE id = ?`, values);

    return NextResponse.json({ message: 'Slot updated' });
  } catch (err: any) {
    console.error('[API /slots] PUT error:', err?.message || err);
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

    await dbExecute('DELETE FROM slots WHERE id = ?', [Number(id)]);
    return NextResponse.json({ message: 'Slot deleted' });
  } catch (err: any) {
    console.error('[API /slots] DELETE error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to delete slot' }, { status: 500 });
  }
}
