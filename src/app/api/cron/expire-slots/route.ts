import { NextRequest, NextResponse } from 'next/server';
import { expireSlots } from '@/lib/expiry';
import { cleanupExpiredDates } from '@/lib/cleanup';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const auth = process.env.CRON_SECRET;
    if (auth && request.headers.get('authorization') !== `Bearer ${auth}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [expiryResult, cleanupCount] = await Promise.all([
      expireSlots(),
      cleanupExpiredDates(),
    ]);

    return NextResponse.json({
      ok: true,
      expired: expiryResult.expired,
      archived: expiryResult.archived,
      datesDeleted: cleanupCount,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[Cron] expire-slots error:', err?.message || err);
    return NextResponse.json({ error: 'Cron failed' }, { status: 500 });
  }
}
