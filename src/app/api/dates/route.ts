import { NextResponse } from 'next/server';
import { dbExecute, rowsToObjects } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

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
    if (existing.rows.length > 0) return NextResponse.json({ error: 'Date already exists' }, { status: 400 });

    const result = await dbExecute('INSERT INTO dates (date) VALUES (?)', [date]);
    return NextResponse.json({ id: Number(result.lastInsertRowid), date }, { status: 201 });
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
    return NextResponse.json({ message: 'Date updated' });
  } catch (err: any) {
    console.error('[API /dates] PUT error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to update date' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    await dbExecute('DELETE FROM dates WHERE id = ?', [Number(id)]);
    return NextResponse.json({ message: 'Date deleted' });
  } catch (err: any) {
    console.error('[API /dates] DELETE error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to delete date' }, { status: 500 });
  }
}
