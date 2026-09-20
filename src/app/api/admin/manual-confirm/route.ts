import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { dbExecute, rowToObject, getDb, isDatabaseLockedError } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface ManualConfirmResult {
  success: boolean;
  serial_number?: number;
  error?: string;
  status?: number;
}

export async function POST(request: NextRequest) {
  try {
    const adminEmail = await getAdminSession();
    if (!adminEmail) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { booking_id } = await request.json();
    if (!booking_id) {
      return NextResponse.json({ error: 'booking_id is required' }, { status: 400 });
    }

    console.log(`[ManualConfirm] Admin ${adminEmail} confirming booking ${booking_id}`);

    const result = await manualConfirmBooking(booking_id, adminEmail);

    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: result.error || 'Manual confirmation failed',
      }, { status: result.status || 400 });
    }

    console.log(`[ManualConfirm] ✓ Booking ${booking_id} confirmed manually, serial=${result.serial_number}`);
    return NextResponse.json({
      success: true,
      booking_id,
      serial_number: result.serial_number,
    });
  } catch (err: any) {
    console.error('[ManualConfirm] Error:', err?.name, err?.message, err?.stack);
    return NextResponse.json({ error: 'Manual confirmation failed. Please try again.' }, { status: 500 });
  }
}

async function manualConfirmBooking(
  booking_id: string,
  adminEmail: string,
): Promise<ManualConfirmResult> {
  // -------------------------------------------------------------------------
  // Phase 1: Read + validate OUTSIDE any write transaction.
  // This keeps write locks short — a booking that is already confirmed,
  // cancelled, failed, or expired never acquires a write lock at all.
  // -------------------------------------------------------------------------
  const bookingResult = await dbExecute(
    `SELECT b.*, s.time as slot_time, s.enabled as slot_enabled
     FROM bookings b
     LEFT JOIN slots s ON b.slot_id = s.id
     WHERE b.booking_id = ?`,
    [booking_id]
  );
  const booking = rowToObject(bookingResult);

  if (!booking) {
    return { success: false, error: 'Booking not found', status: 404 };
  }

  const slotId = Number(booking.slot_id);
  if (booking.slot_time == null || booking.slot_enabled == null) {
    return { success: false, error: 'Assigned slot no longer exists' };
  }

  const previousStatus = booking.payment_status as string;

  if (previousStatus === 'cancelled') {
    return { success: false, error: 'Cannot confirm a cancelled booking' };
  }

  if (previousStatus === 'confirmed') {
    const existingSerial = booking.serial_number ? Number(booking.serial_number) : undefined;
    return { success: true, serial_number: existingSerial };
  }

  if (previousStatus === 'failed') {
    return { success: false, error: 'Cannot confirm a failed booking' };
  }

  if (previousStatus === 'expired') {
    return { success: false, error: 'Cannot confirm an expired booking' };
  }

  if (previousStatus !== 'pending') {
    return { success: false, error: `Cannot confirm a booking with status "${previousStatus}"` };
  }

  if (Number(booking.slot_enabled) !== 1) {
    return { success: false, error: 'Assigned slot is disabled' };
  }

  const dateId = Number(booking.date_id);
  const slotTime = booking.slot_time as string;
  const base = getSlotBase(slotTime);

  // -------------------------------------------------------------------------
  // Phase 2: Short write transaction, retried on SQLite lock contention.
  // Retry loop mirrors confirmBooking() in lib/razorpay.ts.
  // -------------------------------------------------------------------------
  const MAX_ATTEMPTS = 3;
  let lastError: any = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      console.warn(`[ManualConfirm] Retry attempt ${attempt + 1}/${MAX_ATTEMPTS} for booking ${booking_id} (${lastError?.message || 'lock'})`);
      await new Promise(resolve => setTimeout(resolve, 500 * attempt));
    }

    const db = await getDb();
    const tx = await db.transaction('write');

    try {
      // Re-check status inside the transaction (optimistic guard):
      // if another request (webhook/status endpoint) confirmed meanwhile,
      // we must not confirm twice or assign a duplicate serial.
      const recheck = await tx.execute({
        sql: 'SELECT payment_status, serial_number FROM bookings WHERE booking_id = ?',
        args: [booking_id],
      });
      const current = rowToObject(recheck);

      if (!current) {
        await tx.rollback();
        return { success: false, error: 'Booking not found', status: 404 };
      }

      const currentStatus = current.payment_status as string;
      if (currentStatus === 'confirmed') {
        await tx.rollback();
        const existingSerial = current.serial_number ? Number(current.serial_number) : undefined;
        return { success: true, serial_number: existingSerial };
      }
      if (currentStatus !== 'pending') {
        await tx.rollback();
        return { success: false, error: `Cannot confirm a booking with status "${currentStatus}"` };
      }

      // Atomically compute and assign serial number
      let serialNumber: number | null = null;
      for (let attemptSerial = 0; attemptSerial < 5; attemptSerial++) {
        const maxResult = await tx.execute({
          sql: "SELECT MAX(serial_number) as max_serial FROM bookings WHERE date_id = ? AND slot_id = ? AND payment_status = 'confirmed'",
          args: [dateId, slotId],
        });
        const maxRow = rowToObject(maxResult);
        const maxSerial = maxRow?.max_serial ? Number(maxRow.max_serial) : 0;
        const nextSerial = maxSerial > 0 ? maxSerial + 1 : base;

        try {
          const updateResult = await tx.execute({
            sql: `UPDATE bookings SET
              payment_status = 'confirmed',
              serial_number = ?,
              confirmed_by = ?,
              confirmation_type = 'manual',
              confirmed_at = datetime('now'),
              payment_timestamp = datetime('now')
            WHERE booking_id = ? AND payment_status = 'pending'`,
            args: [nextSerial, adminEmail, booking_id],
          });
          // Guard against duplicate confirmation: if the row was already
          // confirmed by a concurrent request, nothing was updated.
          if (Number(updateResult.rowsAffected) !== 1) {
            const recheck2 = await tx.execute({
              sql: 'SELECT payment_status, serial_number FROM bookings WHERE booking_id = ?',
              args: [booking_id],
            });
            const current2 = rowToObject(recheck2);
            await tx.rollback();
            if (current2 && (current2.payment_status as string) === 'confirmed') {
              const existingSerial = current2.serial_number ? Number(current2.serial_number) : undefined;
              return { success: true, serial_number: existingSerial };
            }
            return { success: false, error: 'Booking could not be confirmed. Please refresh and try again.' };
          }
          serialNumber = nextSerial;
          break;
        } catch (err: any) {
          if (err?.message?.includes('UNIQUE constraint') || err?.message?.includes('idx_bookings_serial')) {
            continue;
          }
          throw err;
        }
      }

      if (serialNumber === null) {
        await tx.rollback();
        return { success: false, error: 'Could not assign serial number. Please try again.' };
      }

      // ---- Vehicle seat accounting (mirrors confirmBooking in lib/razorpay.ts) ----
      const vehicleId = booking.vehicle_id != null ? Number(booking.vehicle_id) : 0;
      if (vehicleId > 0) {
        const { incrementVehicleBookedSeats, getVehicleInTx } = await import('@/lib/vehicles');
        const seatCount = Number(booking.passenger_count) || 0;
        const ok = await incrementVehicleBookedSeats(tx as any, vehicleId, seatCount);
        if (!ok) {
          await tx.rollback();
          return {
            success: false,
            error: 'The assigned vehicle no longer has enough seats. Reduce its bookings or increase capacity first.',
          };
        }
        const vehicle = await getVehicleInTx(tx as any, vehicleId);
        if (vehicle) {
          await tx.execute({
            sql: `UPDATE bookings SET vehicle_type = ?, vehicle_number = ?, vehicle_departure_time = ?, vehicle_arrival_time = ? WHERE booking_id = ?`,
            args: [vehicle.vehicle_type, vehicle.vehicle_number, vehicle.departure_time, vehicle.arrival_time, booking_id],
          });
        }
      }

      // Insert audit log
      await tx.execute({
        sql: `INSERT INTO audit_log
          (booking_id, action, admin_email, previous_payment_status, new_payment_status, details, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        args: [
          booking_id,
          'manual_confirmation',
          adminEmail,
          previousStatus,
          'confirmed',
          `Manually confirmed by ${adminEmail}. Serial: ${serialNumber}`,
        ],
      });

      await tx.commit();

      // Fire-and-forget: notify revalidation (outside transaction)
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      fetch(`${baseUrl}/api/revalidate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id, serial_number: serialNumber }),
      }).catch(() => {});

      return { success: true, serial_number: serialNumber };
    } catch (e: any) {
      try { await tx.rollback(); } catch (_) {}
      lastError = e;
      console.error(`[ManualConfirm] Transaction error (attempt ${attempt + 1}/${MAX_ATTEMPTS}):`, e?.name, e?.message);

      if (isDatabaseLockedError(e) && attempt < MAX_ATTEMPTS - 1) {
        continue;
      }

      if (isDatabaseLockedError(e)) {
        return {
          success: false,
          error: 'The database is busy right now. Please try again in a moment.',
          status: 503,
        };
      }
      return { success: false, error: e?.message || 'Transaction failed', status: 500 };
    }
  }

  return { success: false, error: 'Could not confirm booking. Please try again.', status: 503 };
}

const SLOT_BASE: Record<string, number> = {
  '06:30': 1000,
  '08:00': 2000,
  '09:30': 3000,
  '11:00': 4000,
  '12:30': 5000,
  '14:00': 6000,
  '15:30': 7000,
  '17:00': 8000,
  '18:30': 9000,
  '20:00': 10000,
};

function getSlotBase(time: string): number {
  return SLOT_BASE[time] || 1000;
}