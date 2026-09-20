import { NextResponse } from 'next/server';
import { dbExecute, rowsToObjects } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { calcExpiresAt } from '@/lib/expiry';

export async function POST() {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const expiryRow = await dbExecute("SELECT value FROM settings WHERE key = 'slot_expiry_days'");
    const expiryDays = Number((expiryRow.rows[0] as any)?.value || 3);

    const dates = rowsToObjects(await dbExecute('SELECT id, date FROM dates ORDER BY id'));
    const timings = ['07:30', '10:30', '13:00', '15:30'];
    let created = 0;

    for (const d of dates) {
      const dateId = Number(d.id);
      const dateStr = d.date as string;
      const expiresAt = expiryDays > 0 ? calcExpiresAt(dateStr, expiryDays) : '';

      for (const time of timings) {
        const existing = await dbExecute('SELECT id FROM slots WHERE date_id = ? AND time = ?', [dateId, time]);
        if (existing.rows.length === 0) {
          await dbExecute(
            "INSERT INTO slots (date_id, time, enabled, vehicle_time, expiry_days, expires_at, status) VALUES (?, ?, 1, ?, ?, ?, 'active')",
            [dateId, time, '', expiryDays, expiresAt]
          );
          created++;
        }
      }
    }

    return NextResponse.json({ message: `Created ${created} missing slots` });
  } catch (err: any) {
    console.error('[API /slots/generate-missing] error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to generate slots' }, { status: 500 });
  }
}
