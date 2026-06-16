import { NextResponse } from 'next/server';
import { dbExecute } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const [totalBookings, totalPayments, activeSlots, revenue, pendingBookings, totalPassengers] =
      await Promise.all([
        dbExecute("SELECT COUNT(*) as cnt FROM bookings WHERE payment_status = 'confirmed'"),
        dbExecute('SELECT COALESCE(SUM(amount), 0) as total FROM bookings'),
        dbExecute('SELECT COUNT(*) as cnt FROM slots WHERE enabled = 1'),
        dbExecute("SELECT COALESCE(SUM(amount), 0) as total FROM bookings WHERE payment_status = 'confirmed'"),
        dbExecute("SELECT COUNT(*) as cnt FROM bookings WHERE payment_status = 'pending'"),
        dbExecute('SELECT COUNT(*) as cnt FROM passengers'),
      ]);

    return NextResponse.json({
      totalBookings: Number(totalBookings.rows[0].cnt),
      totalPayments: Number(totalPayments.rows[0].total),
      activeSlots: Number(activeSlots.rows[0].cnt),
      revenue: Number(revenue.rows[0].total),
      pendingBookings: Number(pendingBookings.rows[0].cnt),
      totalPassengers: Number(totalPassengers.rows[0].cnt),
    });
  } catch (err: any) {
    console.error('[API /admin/stats] GET error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
