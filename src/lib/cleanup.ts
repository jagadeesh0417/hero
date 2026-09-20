import { dbExecute, getDb } from '@/lib/db';

export async function cleanupExpiredDates(): Promise<number> {
  try {
    const now = new Date();
    const istDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const istMidnight = new Date(istDateStr + 'T00:00:00+05:30');
    istMidnight.setDate(istMidnight.getDate() - 3);
    const threshold = istMidnight.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    const expiredResult = await dbExecute(
      'SELECT id, date FROM dates WHERE date < ?',
      [threshold]
    );

    if (expiredResult.rows.length === 0) return 0;

    const expiredIds = expiredResult.rows.map((r: any) => r.id);

    for (const id of expiredIds) {
      await dbExecute('DELETE FROM vehicles WHERE slot_id IN (SELECT id FROM slots WHERE date_id = ?)', [id]);
      await dbExecute('DELETE FROM slots WHERE date_id = ?', [id]);
      await dbExecute('DELETE FROM bookings WHERE date_id = ? AND payment_status != \'confirmed\'', [id]);
      const remaining = await dbExecute(
        "SELECT COUNT(*) as cnt FROM bookings WHERE date_id = ? AND payment_status = 'confirmed'",
        [id]
      );
      const row = remaining.rows[0] as any;
      if (!row || Number(row.cnt) === 0) {
        await dbExecute('DELETE FROM dates WHERE id = ?', [id]);
      }
    }

    console.log(`[Cleanup] Deleted ${expiredIds.length} expired dates (older than 3 days, IST)`);
    return expiredIds.length;
  } catch (err: any) {
    console.error('[Cleanup] Error:', err?.message || err);
    return 0;
  }
}
