import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowsToObjects } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { cleanupExpiredDates } from '@/lib/cleanup';
import { expireSlots } from '@/lib/expiry';
import { getVehiclesForSlots, isVehicleSelectable } from '@/lib/vehicles';

export async function GET(request: NextRequest) {
  try {
    await cleanupExpiredDates();
    await expireSlots();
    const { searchParams } = new URL(request.url);
    const dateId = searchParams.get('date_id');

    let result;
    if (dateId) {
      // Public / book-page query — only active slots
      result = await dbExecute(
        "SELECT * FROM slots WHERE date_id = ? AND status = 'active' AND enabled = 1 ORDER BY time ASC",
        [Number(dateId)]
      );
    } else {
      // Admin query — all slots with their date
      result = await dbExecute(
        `SELECT s.*, d.date FROM slots s
         JOIN dates d ON s.date_id = d.id
         ORDER BY d.date DESC, s.time ASC`
      );
    }

    const slots = rowsToObjects(result);

    // Attach vehicles (backward compatible: old slots simply get an empty list).
    // Public queries only receive selectable vehicles (available + free seats);
    // the admin query receives everything for management.
    const slotIds = slots.map((s) => Number(s.id)).filter((id) => !isNaN(id));
    const vehiclesMap = await getVehiclesForSlots(slotIds);
    const isAdminQuery = !dateId;
    for (const s of slots) {
      const all = vehiclesMap.get(Number(s.id)) || [];
      s.vehicles = isAdminQuery ? all : all.filter((v) => isVehicleSelectable(v));
    }

    return NextResponse.json(slots);
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
    const { id, time, enabled, vehicle_time } = await request.json();
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });

    const updates: string[] = [];
    const values: (string | number)[] = [];

    if (time !== undefined) { updates.push('time = ?'); values.push(time); }
    if (enabled !== undefined) { updates.push('enabled = ?'); values.push(enabled ? 1 : 0); }
    if (vehicle_time !== undefined) { updates.push('vehicle_time = ?'); values.push(vehicle_time); }

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

    await dbExecute('DELETE FROM vehicles WHERE slot_id = ?', [Number(id)]);
    await dbExecute('DELETE FROM slots WHERE id = ?', [Number(id)]);
    return NextResponse.json({ message: 'Slot deleted' });
  } catch (err: any) {
    console.error('[API /slots] DELETE error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to delete slot' }, { status: 500 });
  }
}
