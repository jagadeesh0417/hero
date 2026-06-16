import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const totalBookingsResult = await db.execute({
    sql: "SELECT COUNT(*) as cnt FROM bookings WHERE payment_status = 'confirmed'",
  });
  const totalPaymentsResult = await db.execute({
    sql: 'SELECT COALESCE(SUM(amount), 0) as total FROM bookings',
  });
  const activeSlotsResult = await db.execute({
    sql: 'SELECT COUNT(*) as cnt FROM slots WHERE enabled = 1',
  });
  const revenueResult = await db.execute({
    sql: "SELECT COALESCE(SUM(amount), 0) as total FROM bookings WHERE payment_status = 'confirmed'",
  });
  const pendingBookingsResult = await db.execute({
    sql: "SELECT COUNT(*) as cnt FROM bookings WHERE payment_status = 'pending'",
  });
  const totalPassengersResult = await db.execute({
    sql: 'SELECT COUNT(*) as cnt FROM passengers',
  });

  return NextResponse.json({
    totalBookings: Number(totalBookingsResult.rows[0].cnt),
    totalPayments: Number(totalPaymentsResult.rows[0].total),
    activeSlots: Number(activeSlotsResult.rows[0].cnt),
    revenue: Number(revenueResult.rows[0].total),
    pendingBookings: Number(pendingBookingsResult.rows[0].cnt),
    totalPassengers: Number(totalPassengersResult.rows[0].cnt),
  });
}
