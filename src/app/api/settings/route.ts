import { NextResponse } from 'next/server';
import db, { rowsToObjects } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  const result = await db.execute({ sql: 'SELECT key, value FROM settings' });
  const rows = rowsToObjects(result) as { key: string; value: string }[];
  const settings: Record<string, string> = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return NextResponse.json(settings);
}

export async function PUT(request: Request) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();

    const allowedKeys = ['upi_id', 'upi_name', 'price_per_ticket', 'business_name', 'business_phone', 'business_address'];

    const tx = await db.transaction('write');
    try {
      for (const [key, value] of Object.entries(body)) {
        if (allowedKeys.includes(key) && typeof value === 'string' && value.trim()) {
          await tx.execute({
            sql: `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
            args: [key, value.trim()],
          });
        }
      }
      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }

    return NextResponse.json({ message: 'Settings updated' });
  } catch {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}
