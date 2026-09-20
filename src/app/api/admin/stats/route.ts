import { NextResponse } from 'next/server';
import { dbExecute, rowToObject } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { cleanupExpiredDates } from '@/lib/cleanup';
import { expireSlots } from '@/lib/expiry';

export async function GET() {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    await cleanupExpiredDates();
    await expireSlots();

    const [totalBookings, totalPayments, activeSlots, revenue, pendingBookings, totalPassengers, totalDates, availableSeats, upcomingSlots, expiredSlots, examSlotVehicleStats] =
      await Promise.all([
        dbExecute("SELECT COUNT(*) as cnt FROM bookings WHERE payment_status = 'confirmed'"),
        dbExecute("SELECT COALESCE(SUM(amount), 0) as total FROM bookings WHERE payment_status = 'confirmed'"),
        dbExecute("SELECT COUNT(*) as cnt FROM slots WHERE status = 'active' AND enabled = 1"),
        dbExecute("SELECT COALESCE(SUM(amount), 0) as total FROM bookings WHERE payment_status = 'confirmed'"),
        dbExecute("SELECT COUNT(*) as cnt FROM bookings WHERE payment_status = 'pending'"),
        dbExecute('SELECT COUNT(*) as cnt FROM passengers'),
        dbExecute('SELECT COUNT(*) as cnt FROM dates'),
        dbExecute("SELECT COALESCE(SUM(passenger_count), 0) as taken FROM bookings WHERE payment_status = 'confirmed'"),
        dbExecute("SELECT COUNT(*) as cnt FROM slots WHERE status = 'active' AND enabled = 1"),
        dbExecute("SELECT COUNT(*) as cnt FROM slots WHERE status = 'expired'"),
        dbExecute(
          `SELECT
             COUNT(*) as vehicle_count,
             COALESCE(SUM(total_seats), 0) as total_capacity,
             COALESCE(SUM(booked_seats), 0) as booked_seats,
             COALESCE(SUM(CASE WHEN status = 'available' THEN total_seats - booked_seats ELSE 0 END), 0) as available_seats
           FROM vehicles
           JOIN slots s ON vehicles.slot_id = s.id
           WHERE vehicles.status != 'cancelled' AND s.status = 'active'`
        ),
      ]);

    const vehicleStats = rowToObject(examSlotVehicleStats) || {};

    return NextResponse.json({
      totalBookings: Number(rowToObject(totalBookings)?.cnt || 0),
      totalPayments: Number(rowToObject(totalPayments)?.total || 0),
      activeSlots: Number(rowToObject(activeSlots)?.cnt || 0),
      revenue: Number(rowToObject(revenue)?.total || 0),
      pendingBookings: Number(rowToObject(pendingBookings)?.cnt || 0),
      totalPassengers: Number(rowToObject(totalPassengers)?.cnt || 0),
      totalDates: Number(rowToObject(totalDates)?.cnt || 0),
      availableSeats: Number(rowToObject(availableSeats)?.taken || 0),
      upcomingSlots: Number(rowToObject(upcomingSlots)?.cnt || 0),
      expiredSlots: Number(rowToObject(expiredSlots)?.cnt || 0),
      examSlots: Number(rowToObject(activeSlots)?.cnt || 0),
      totalVehicles: Number(vehicleStats.vehicle_count || 0),
      vehicleCapacity: Number(vehicleStats.total_capacity || 0),
      vehicleBookedSeats: Number(vehicleStats.booked_seats || 0),
      vehicleAvailableSeats: Number(vehicleStats.available_seats || 0),
    });
  } catch (err: any) {
    console.error('[API /admin/stats] GET error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
