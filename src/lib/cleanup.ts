import { dbExecute } from '@/lib/db';

// Cleanup is intentionally a no-op for bookings.
// Expired slots are handled by expireSlots() which marks them status='expired'
// without deleting anything. Booking records are preserved permanently.
// This function exists as a safe hook for future automated maintenance
// but currently performs no destructive operations.
export async function cleanupExpiredDates(): Promise<number> {
  try {
    const now = new Date();
    const istDateStr = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    const istMidnight = new Date(istDateStr + 'T00:00:00+05:30');
    istMidnight.setDate(istMidnight.getDate() - 3);
    const threshold = istMidnight.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

    // Remove vehicle assignments for slots belonging to dates older than 3 days
    // so stale vehicle capacity is not counted toward availability.
    // Booking records are NEVER touched — they are preserved permanently.
    await dbExecute(
      `DELETE FROM vehicles WHERE slot_id IN (
        SELECT s.id FROM slots s JOIN dates d ON s.date_id = d.id
        WHERE d.date < ? AND s.status = 'expired'
      )`,
      [threshold]
    );

    console.log(`[Cleanup] Cleaned up stale vehicles for expired dates older than 3 days (IST)`);
    return 0;
  } catch (err: any) {
    console.error('[Cleanup] Error:', err?.message || err);
    return 0;
  }
}
