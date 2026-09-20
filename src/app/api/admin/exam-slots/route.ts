import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowsToObjects, getDb } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { calcExpiresAt } from '@/lib/expiry';
import { getVehiclesForSlots, saveVehiclesForSlot } from '@/lib/vehicles';
import { validateExamSlotPayload } from '@/lib/exam-slots';

export async function GET() {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await dbExecute(
      `SELECT s.*, d.date FROM slots s
       JOIN dates d ON s.date_id = d.id
       ORDER BY d.date DESC, s.time ASC`
    );
    const slots = rowsToObjects(result);

    // Global price fallback for slots without their own price
    const priceResult = await dbExecute("SELECT value FROM settings WHERE key = 'price_per_ticket'");
    const globalPrice = Number((priceResult.rows[0] as any)?.value) || 500;

    const vehiclesMap = await getVehiclesForSlots(slots.map((s) => Number(s.id)));
    const bookingCounts = await dbExecute(
      `SELECT slot_id, COUNT(*) as booking_count, COALESCE(SUM(passenger_count), 0) as booked_passengers
       FROM bookings WHERE payment_status = 'confirmed' GROUP BY slot_id`
    );
    const countsBySlot = new Map<number, { booking_count: number; booked_passengers: number }>();
    for (const r of rowsToObjects(bookingCounts)) {
      countsBySlot.set(Number(r.slot_id), {
        booking_count: Number(r.booking_count),
        booked_passengers: Number(r.booked_passengers),
      });
    }

    const payload = slots.map((s) => {
      const vehicles = vehiclesMap.get(Number(s.id)) || [];
      const active = vehicles.filter((v) => v.status !== 'cancelled');
      const totalCapacity = active.reduce((sum, v) => sum + (Number(v.total_seats) || 0), 0);
      const bookedSeats = active.reduce((sum, v) => sum + (Number(v.booked_seats) || 0), 0);
      const counts = countsBySlot.get(Number(s.id)) || { booking_count: 0, booked_passengers: 0 };
      const slotPrice = Number(s.price) || 0;
      return {
        ...s,
        vehicles,
        vehicle_count: active.length,
        total_capacity: totalCapacity,
        booked_seats: bookedSeats,
        available_seats: Math.max(0, totalCapacity - bookedSeats),
        price: slotPrice > 0 ? slotPrice : globalPrice,
        has_custom_price: slotPrice > 0,
        confirmed_bookings: counts.booking_count,
        is_open: Number(s.enabled) === 1,
        status_label:
          s.status === 'expired' ? 'expired' : Number(s.enabled) === 1 ? 'open' : 'closed',
      };
    });

    return NextResponse.json(payload);
  } catch (err: any) {
    console.error('[API /admin/exam-slots] GET error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to fetch exam slots' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const validationError = validateExamSlotPayload(body, true);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const {
      exam_name, exam_date, exam_time, reporting_time,
      pickup_location, drop_location, price, status, description, vehicles,
    } = body;

    const db = await getDb();
    const tx = await db.transaction('write');

    try {
      // Find or create the travel date (calendar entry)
      let dateId: number;
      const existingDate = await tx.execute({
        sql: 'SELECT id FROM dates WHERE date = ?',
        args: [exam_date],
      });
      if (existingDate.rows && existingDate.rows.length > 0) {
        dateId = Number((existingDate.rows[0] as any).id);
      } else {
        const inserted = await tx.execute({
          sql: 'INSERT INTO dates (date) VALUES (?)',
          args: [exam_date],
        });
        dateId = Number(inserted.lastInsertRowid);
      }

      // Expiry follows the existing global slot-expiry rules
      const expiryRow = await tx.execute({
        sql: "SELECT value FROM settings WHERE key = 'slot_expiry_days'",
        args: [],
      });
      const expiryDays = Number((expiryRow.rows?.[0] as any)?.value || 3);
      const expiresAt = expiryDays > 0 ? calcExpiresAt(exam_date, expiryDays) : '';

      // Find an existing slot at this date+time, otherwise create one
      const existingSlot = await tx.execute({
        sql: 'SELECT id FROM slots WHERE date_id = ? AND time = ?',
        args: [dateId, exam_time],
      });

      let slotId: number;
      let updatingExisting = false;
      if (existingSlot.rows && existingSlot.rows.length > 0) {
        slotId = Number((existingSlot.rows[0] as any).id);
        updatingExisting = true;
        await tx.execute({
          sql: `UPDATE slots SET
            exam_name = ?, reporting_time = ?, pickup_location = ?, drop_location = ?,
            price = ?, description = ?, enabled = ?, expiry_days = ?, expires_at = ?
          WHERE id = ?`,
          args: [
            exam_name.trim(),
            reporting_time || '',
            (pickup_location || '').trim(),
            (drop_location || '').trim(),
            Number(price) || 0,
            (description || '').trim(),
            status === 'closed' ? 0 : 1,
            expiryDays,
            expiresAt,
            slotId,
          ],
        });
      } else {
        const inserted = await tx.execute({
          sql: `INSERT INTO slots
            (date_id, time, enabled, vehicle_time, expiry_days, expires_at, status,
             exam_name, reporting_time, pickup_location, drop_location, price, description)
            VALUES (?, ?, ?, '', ?, ?, 'active', ?, ?, ?, ?, ?, ?)`,
          args: [
            dateId,
            exam_time,
            status === 'closed' ? 0 : 1,
            expiryDays,
            expiresAt,
            exam_name.trim(),
            reporting_time || '',
            (pickup_location || '').trim(),
            (drop_location || '').trim(),
            Number(price) || 0,
            (description || '').trim(),
          ],
        });
        slotId = Number(inserted.lastInsertRowid);
      }

      if (vehicles && vehicles.length > 0) {
        const saveResult = await saveVehiclesForSlot(tx as any, slotId, vehicles);
        if (!saveResult.ok) {
          await tx.rollback();
          return NextResponse.json({ error: saveResult.error }, { status: 400 });
        }
      }

      await tx.commit();

      console.log(`[ExamSlots] Admin ${email} ${updatingExisting ? 'configured' : 'created'} exam slot #${slotId} (${exam_name}, ${exam_date} ${exam_time}) with ${(vehicles || []).length} vehicle(s)`);
      return NextResponse.json({ success: true, id: slotId, date_id: dateId }, { status: 201 });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (err: any) {
    console.error('[API /admin/exam-slots] POST error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to create exam slot' }, { status: 500 });
  }
}
