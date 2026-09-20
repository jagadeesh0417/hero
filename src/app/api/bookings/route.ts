import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowsToObjects, getDb } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { generateBookingId } from '@/lib/utils';
import { getVehiclesForSlot, isVehicleSelectable, type VehicleRecord } from '@/lib/vehicles';

export const dynamic = 'force-dynamic';

const noStoreHeaders = { 'Cache-Control': 'no-store, max-age=0, must-revalidate' };

export async function GET(request: NextRequest) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: noStoreHeaders });

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';

    let query = `
      SELECT b.*, d.date, s.time, s.vehicle_time,
        (SELECT p.name FROM passengers p WHERE p.booking_id = b.booking_id ORDER BY p.id LIMIT 1) as customer_name_ext,
        (SELECT p.mobile FROM passengers p WHERE p.booking_id = b.booking_id ORDER BY p.id LIMIT 1) as customer_mobile_ext,
        (SELECT p.gender FROM passengers p WHERE p.booking_id = b.booking_id ORDER BY p.id LIMIT 1) as gender
      FROM bookings b
      JOIN dates d ON b.date_id = d.id
      LEFT JOIN slots s ON b.slot_id = s.id
      WHERE 1=1
    `;
    const params: (string | number)[] = [];

    if (search) {
      query += ` AND (
        b.booking_id LIKE ?
        OR d.date LIKE ?
        OR b.serial_number LIKE ?
        OR b.customer_name LIKE ?
        OR b.customer_mobile LIKE ?
        OR EXISTS (
          SELECT 1 FROM passengers p
          WHERE p.booking_id = b.booking_id
          AND (p.name LIKE ? OR p.mobile LIKE ?)
        )
      )`;
      // booking_id, date, serial_number, customer_name, customer_mobile, p.name, p.mobile
      const s = `%${search}%`;
      params.push(s, s, s, s, s, s, s);
    }

    if (status) {
      query += ' AND b.payment_status = ?';
      params.push(status);
    }

    query += ' ORDER BY b.created_at DESC';

    const result = await dbExecute(query, params);
    return NextResponse.json(rowsToObjects(result), { headers: noStoreHeaders });
  } catch (err: any) {
    console.error('[API /bookings] GET error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to fetch bookings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { date_id, slot_id, passengers, exam_center, vehicle_id } = await request.json();

    if (!date_id || !slot_id || !passengers || !Array.isArray(passengers) || passengers.length === 0) {
      return NextResponse.json({ error: 'Invalid booking data' }, { status: 400 });
    }

    if (!exam_center) {
      return NextResponse.json({ error: 'Exam center is required' }, { status: 400 });
    }

    for (const p of passengers) {
      if (!p.name || !p.mobile || !p.gender) {
        return NextResponse.json({ error: 'All passenger fields are required' }, { status: 400 });
      }
      if (!/^[6-9]\d{9}$/.test(p.mobile)) {
        return NextResponse.json({ error: `Invalid mobile number for ${p.name}` }, { status: 400 });
      }
    }

    const ticketCount = passengers.length;

    const slotResult = await dbExecute("SELECT * FROM slots WHERE id = ? AND enabled = 1 AND status = 'active'", [slot_id]);
    const slot = rowsToObjects(slotResult)[0];
    if (!slot) {
      return NextResponse.json({ error: 'This exam slot has expired. Please choose another available slot.' }, { status: 400 });
    }

    // ---- Vehicle validation (server-side, Part 6/7/9 of requirements) ----
    // Slots configured with vehicles require a valid, selectable vehicle.
    // Legacy slots without vehicles keep working exactly as before.
    const vehicles = await getVehiclesForSlot(Number(slot_id));
    const activeVehicles = vehicles.filter((v) => v.status !== 'cancelled');
    let selectedVehicle: VehicleRecord | null = null;

    if (activeVehicles.length > 0) {
      if (!vehicle_id) {
        return NextResponse.json({ error: 'Please select a vehicle for this exam slot.' }, { status: 400 });
      }
      selectedVehicle = vehicles.find((v) => v.id === Number(vehicle_id)) || null;
      if (!selectedVehicle) {
        return NextResponse.json({ error: 'Selected vehicle is not assigned to this exam slot. Please choose again.' }, { status: 400 });
      }
      if (!isVehicleSelectable(selectedVehicle)) {
        return NextResponse.json({ error: 'The selected vehicle is full or no longer available. Please choose another vehicle.' }, { status: 400 });
      }
      if ((selectedVehicle.available_seats ?? 0) < ticketCount) {
        return NextResponse.json(
          {
            error: `Only ${selectedVehicle.available_seats} seat(s) left on ${selectedVehicle.vehicle_type} ${selectedVehicle.vehicle_number}. Please reduce the number of tickets or choose another vehicle.`,
          },
          { status: 400 }
        );
      }
    }

    // ---- Price: server-side source of truth (Part 15) ----
    // Slot-specific price wins; global setting is the fallback for legacy slots.
    const slotPrice = Number(slot.price);
    let pricePerTicket: number;
    if (slotPrice > 0) {
      pricePerTicket = slotPrice;
    } else {
      const priceResult = await dbExecute("SELECT value FROM settings WHERE key = 'price_per_ticket'");
      const priceRow = priceResult.rows[0] as any;
      pricePerTicket = priceRow ? Number(priceRow.value) : 500;
    }
    const amount = ticketCount * pricePerTicket;
    const bookingId = generateBookingId();

    const db = await getDb();
    const tx = await db.transaction('write');
    try {
      await tx.execute({
        sql: `INSERT INTO bookings
          (booking_id, date_id, slot_id, passenger_count, amount, payment_status, exam_center,
           vehicle_id, vehicle_type, vehicle_number, vehicle_departure_time, vehicle_arrival_time)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          bookingId,
          date_id,
          slot_id,
          ticketCount,
          amount,
          'pending',
          exam_center,
          selectedVehicle ? Number(selectedVehicle.id) : null,
          selectedVehicle?.vehicle_type || '',
          selectedVehicle?.vehicle_number || '',
          selectedVehicle?.departure_time || '',
          selectedVehicle?.arrival_time || '',
        ],
      });

      for (const p of passengers) {
        await tx.execute({
          sql: 'INSERT INTO passengers (booking_id, name, mobile, gender) VALUES (?, ?, ?, ?)',
          args: [bookingId, p.name, p.mobile, p.gender],
        });
      }

      await tx.commit();
    } catch (e) {
      await tx.rollback();
      throw e;
    }

    console.log(`[Booking] Created booking ${bookingId} for ${ticketCount} passengers, ₹${amount}${selectedVehicle ? `, vehicle=${selectedVehicle.vehicle_number}` : ''}`);
    return NextResponse.json(
      {
        success: true,
        booking_id: bookingId,
        amount,
        passenger_count: ticketCount,
        payment_status: 'pending',
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error('[API /bookings] POST error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 });
  }
}
