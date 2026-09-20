import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowToObject, getDb } from '@/lib/db';
import { getAdminSession } from '@/lib/auth';
import { calcExpiresAt } from '@/lib/expiry';
import { getVehiclesForSlot, saveVehiclesForSlot } from '@/lib/vehicles';
import { validateExamSlotPayload } from '@/lib/exam-slots';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const slotId = Number(id);
    if (!slotId || isNaN(slotId)) {
      return NextResponse.json({ error: 'Invalid exam slot ID' }, { status: 400 });
    }

    const result = await dbExecute(
      `SELECT s.*, d.date FROM slots s
       JOIN dates d ON s.date_id = d.id
       WHERE s.id = ?`,
      [slotId]
    );
    const slot = rowToObject(result);
    if (!slot) {
      return NextResponse.json({ error: 'Exam slot not found' }, { status: 404 });
    }

    const vehicles = await getVehiclesForSlot(slotId);
    const bookingStats = await dbExecute(
      "SELECT COUNT(*) as booking_count, COALESCE(SUM(passenger_count), 0) as booked_passengers FROM bookings WHERE slot_id = ? AND payment_status = 'confirmed'",
      [slotId]
    );
    const stats = rowToObject(bookingStats);

    const priceResult = await dbExecute("SELECT value FROM settings WHERE key = 'price_per_ticket'");
    const globalPrice = Number(priceResult.rows[0]?.value) || 500;
    const slotPrice = Number(slot.price) || 0;

    return NextResponse.json({
      ...slot,
      vehicles,
      price: slotPrice > 0 ? slotPrice : globalPrice,
      has_custom_price: slotPrice > 0,
      confirmed_bookings: Number(stats?.booking_count) || 0,
      confirmed_passengers: Number(stats?.booked_passengers) || 0,
      is_open: Number(slot.enabled) === 1,
      status_label:
        slot.status === 'expired' ? 'expired' : Number(slot.enabled) === 1 ? 'open' : 'closed',
    });
  } catch (err: any) {
    console.error('[API /admin/exam-slots/:id] GET error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to fetch exam slot' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const slotId = Number(id);
    if (!slotId || isNaN(slotId)) {
      return NextResponse.json({ error: 'Invalid exam slot ID' }, { status: 400 });
    }

    const body = await request.json();
    const validationError = validateExamSlotPayload(body, false);
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 });
    }

    const db = await getDb();
    const tx = await db.transaction('write');

    try {
      const existingResult = await tx.execute({
        sql: 'SELECT s.*, d.date FROM slots s JOIN dates d ON s.date_id = d.id WHERE s.id = ?',
        args: [slotId],
      });
      const existing = rowToObject(existingResult);
      if (!existing) {
        await tx.rollback();
        return NextResponse.json({ error: 'Exam slot not found' }, { status: 404 });
      }

      const {
        exam_name, exam_date, exam_time, reporting_time,
        pickup_location, drop_location, price, status, description, vehicles,
      } = body;

      // Resolve the (possibly new) date for this slot
      let dateId = Number(existing.date_id);
      if (exam_date && DATE_RE.test(exam_date) && exam_date !== existing.date) {
        const existingDate = await tx.execute({
          sql: 'SELECT id FROM dates WHERE date = ?',
          args: [exam_date],
        });
        if (existingDate.rows && existingDate.rows.length > 0) {
          dateId = Number(existingDate.rows[0].id);
        } else {
          const inserted = await tx.execute({
            sql: 'INSERT INTO dates (date) VALUES (?)',
            args: [exam_date],
          });
          dateId = Number(inserted.lastInsertRowid);
        }
      }

      // Keep expiry consistent with the existing rules when the date moves
      const effectiveDate = exam_date && DATE_RE.test(exam_date) ? exam_date : (existing.date as string);
      const expiryRow = await tx.execute({
        sql: "SELECT value FROM settings WHERE key = 'slot_expiry_days'",
        args: [],
      });
      const expiryDays = Number(expiryRow.rows?.[0]?.value || 3);
      const expiresAt = expiryDays > 0 ? calcExpiresAt(effectiveDate, expiryDays) : '';

      // Unique (date_id, time) guard: another slot may already sit at the target
      if (dateId !== Number(existing.date_id) || (exam_time && exam_time !== existing.time)) {
        const newTime = exam_time || (existing.time as string);
        const clash = await tx.execute({
          sql: 'SELECT id FROM slots WHERE date_id = ? AND time = ? AND id != ?',
          args: [dateId, newTime, slotId],
        });
        if (clash.rows && clash.rows.length > 0) {
          await tx.rollback();
          return NextResponse.json(
            { error: 'Another slot already exists on this date at that exam time. Edit that slot instead.' },
            { status: 400 }
          );
        }
      }

      const enabled = status === 'closed' ? 0 : status === 'open' ? 1 : Number(existing.enabled);

      await tx.execute({
        sql: `UPDATE slots SET
          date_id = ?, time = ?, exam_name = ?, reporting_time = ?,
          pickup_location = ?, drop_location = ?, price = ?, description = ?,
          enabled = ?, expiry_days = ?, expires_at = ?
        WHERE id = ?`,
        args: [
          dateId,
          exam_time || existing.time,
          exam_name.trim(),
          reporting_time || '',
          (pickup_location || '').trim(),
          (drop_location || '').trim(),
          Number(price) || 0,
          (description || '').trim(),
          enabled,
          expiryDays,
          expiresAt,
          slotId,
        ],
      });

      if (vehicles && vehicles.length > 0) {
        const saveResult = await saveVehiclesForSlot(tx, slotId, vehicles);
        if (!saveResult.ok) {
          await tx.rollback();
          return NextResponse.json({ error: saveResult.error }, { status: 400 });
        }
      }

      await tx.commit();
      console.log(`[ExamSlots] Admin ${email} updated exam slot #${slotId} (${exam_name})`);
      return NextResponse.json({ success: true, id: slotId });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (err: any) {
    console.error('[API /admin/exam-slots/:id] PUT error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to update exam slot' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const email = await getAdminSession();
  if (!email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { id } = await params;
    const slotId = Number(id);
    if (!slotId || isNaN(slotId)) {
      return NextResponse.json({ error: 'Invalid exam slot ID' }, { status: 400 });
    }

    const existingResult = await dbExecute(
      'SELECT id, exam_name FROM slots WHERE id = ?',
      [slotId]
    );
    if (!existingResult.rows || existingResult.rows.length === 0) {
      return NextResponse.json({ error: 'Exam slot not found' }, { status: 404 });
    }

    // Delete safety (Part 13): never hard-delete a slot with confirmed bookings.
    const confirmedResult = await dbExecute(
      "SELECT COUNT(*) as cnt FROM bookings WHERE slot_id = ? AND payment_status = 'confirmed'",
      [slotId]
    );
    const confirmedCount = Number(confirmedResult.rows[0]?.cnt) || 0;
    if (confirmedCount > 0) {
      return NextResponse.json(
        {
          error: `This exam slot has ${confirmedCount} confirmed booking(s). Closing it will prevent new bookings while existing bookings remain available. Delete is disabled.`,
        },
        { status: 400 }
      );
    }

    const db = await getDb();
    const tx = await db.transaction('write');
    try {
      // Pending bookings on this slot cannot survive it — remove them and
      // their passenger rows (mirrors the existing date-cleanup pattern).
      await tx.execute({
        sql: "DELETE FROM passengers WHERE booking_id IN (SELECT booking_id FROM bookings WHERE slot_id = ? AND payment_status != 'confirmed')",
        args: [slotId],
      });
      await tx.execute({
        sql: "DELETE FROM bookings WHERE slot_id = ? AND payment_status != 'confirmed'",
        args: [slotId],
      });
      await tx.execute({ sql: 'DELETE FROM vehicles WHERE slot_id = ?', args: [slotId] });
      await tx.execute({ sql: 'DELETE FROM slots WHERE id = ?', args: [slotId] });
      await tx.commit();

      console.log(`[ExamSlots] Admin ${email} deleted exam slot #${slotId} (no confirmed bookings)`);
      return NextResponse.json({ success: true, message: 'Exam slot deleted' });
    } catch (e) {
      await tx.rollback();
      throw e;
    }
  } catch (err: any) {
    console.error('[API /admin/exam-slots/:id] DELETE error:', err?.message || err);
    return NextResponse.json({ error: 'Failed to delete exam slot' }, { status: 500 });
  }
}
