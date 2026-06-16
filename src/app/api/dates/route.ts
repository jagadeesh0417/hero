import { NextResponse } from 'next/server';
import db, { rowsToObjects } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  const result = await db.execute({ sql: 'SELECT * FROM dates ORDER BY date DESC' });
  return NextResponse.json(rowsToObjects(result));
}

export async function POST(request: Request) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { date } = await request.json();
    if (!date) return NextResponse.json({ error: 'Date is required' }, { status: 400 });

    const existing = await db.execute({ sql: 'SELECT id FROM dates WHERE date = ?', args: [date] });
    if (existing.rows.length > 0) return NextResponse.json({ error: 'Date already exists' }, { status: 400 });

    const result = await db.execute({ sql: 'INSERT INTO dates (date) VALUES (?)', args: [date] });
    return NextResponse.json({ id: Number(result.lastInsertRowid), date }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Failed to create date' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id, date } = await request.json();
    if (!id || !date) return NextResponse.json({ error: 'ID and date are required' }, { status: 400 });

    await db.execute({ sql: 'UPDATE dates SET date = ? WHERE id = ?', args: [date, id] });
    return NextResponse.json({ message: 'Date updated' });
  } catch {
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

    await db.execute({ sql: 'DELETE FROM dates WHERE id = ?', args: [Number(id)] });
    return NextResponse.json({ message: 'Date deleted' });
  } catch {
    return NextResponse.json({ error: 'Failed to delete date' }, { status: 500 });
  }
}
