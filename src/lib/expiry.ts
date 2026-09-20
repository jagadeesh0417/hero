import { dbExecute, getDb } from '@/lib/db';

export async function expireSlots(): Promise<{ expired: number; archived: number }> {
  try {
    const now = new Date();
    const istDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const istMidnight = new Date(istDateStr + 'T00:00:00+05:30');

    const activeResult = await dbExecute(
      "SELECT s.id, s.date_id, s.time, s.enabled, s.vehicle_time, s.expiry_days, s.expires_at, d.date FROM slots s JOIN dates d ON s.date_id = d.id WHERE s.status = 'active' AND s.expires_at != '' AND s.expires_at < ?",
      [istDateStr]
    );

    if (activeResult.rows.length === 0) return { expired: 0, archived: 0 };

    const db = await getDb();
    let expired = 0;
    let archived = 0;

    for (const row of activeResult.rows as any[]) {
      try {
        const tx = await db.transaction('write');
        try {
          await tx.execute({
            sql: `INSERT INTO slots_history (original_id, date_id, time, enabled, vehicle_time, expiry_days, expires_at, date, archived_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
            args: [row.id, row.date_id, row.time, row.enabled, row.vehicle_time || '', row.expiry_days || 3, row.expires_at || '', row.date],
          });

          await tx.execute({
            sql: "UPDATE slots SET status = 'expired' WHERE id = ?",
            args: [row.id],
          });

          await tx.commit();
          expired++;
          archived++;
        } catch {
          await tx.rollback();
        }
      } catch {
      }
    }

    console.log(`[Expiry] Expired ${expired} slots, archived ${archived} to history`);
    return { expired, archived };
  } catch (err: any) {
    console.error('[Expiry] Error:', err?.message || err);
    return { expired: 0, archived: 0 };
  }
}

export function calcExpiresAt(dateStr: string, expiryDays: number): string {
  const d = new Date(dateStr + 'T00:00:00+05:30');
  d.setDate(d.getDate() + expiryDays);
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}
