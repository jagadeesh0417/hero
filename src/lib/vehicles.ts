import { dbExecute, rowsToObjects, rowToObject } from '@/lib/db';

export const VEHICLE_STATUSES = ['available', 'full', 'cancelled'] as const;
export type VehicleStatus = (typeof VEHICLE_STATUSES)[number];

export interface VehicleRecord {
  id: number;
  slot_id: number;
  vehicle_type: string;
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string;
  departure_time: string;
  arrival_time: string;
  total_seats: number;
  booked_seats: number;
  status: string;
  created_at?: string;
  available_seats?: number;
}

export interface VehicleInput {
  id?: number;
  vehicle_type: string;
  vehicle_number: string;
  driver_name?: string;
  driver_mobile?: string;
  departure_time: string;
  arrival_time: string;
  total_seats: number;
  status?: string;
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Validate admin-provided vehicle payloads (create or update).
 * Returns an error message or null when valid.
 */
export function validateVehiclesInput(vehicles: unknown): string | null {
  if (!Array.isArray(vehicles)) return 'Vehicles must be a list';
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i] as VehicleInput;
    const label = `Vehicle ${i + 1}`;
    if (!v || typeof v !== 'object') return `${label}: invalid data`;
    if (!v.vehicle_type || !String(v.vehicle_type).trim()) return `${label}: vehicle type is required`;
    if (!v.vehicle_number || !String(v.vehicle_number).trim()) return `${label}: vehicle number is required`;
    if (!v.departure_time || !TIME_RE.test(v.departure_time)) return `${label}: departure time is required (HH:MM)`;
    if (!v.arrival_time || !TIME_RE.test(v.arrival_time)) return `${label}: expected arrival time is required (HH:MM)`;
    if (v.departure_time > v.arrival_time) {
      return `${label}: departure time cannot be after the expected arrival time`;
    }
    const seats = Number(v.total_seats);
    if (!Number.isInteger(seats) || seats <= 0) return `${label}: total seats must be a whole number greater than 0`;
    if (seats > 200) return `${label}: total seats cannot exceed 200`;
    if (v.status && !VEHICLE_STATUSES.includes(v.status as VehicleStatus)) {
      return `${label}: status must be one of ${VEHICLE_STATUSES.join(', ')}`;
    }
    if (v.driver_mobile && !/^[0-9+\-\s]{6,15}$/.test(String(v.driver_mobile).trim())) {
      return `${label}: driver mobile number is not valid`;
    }
  }
  return null;
}

/** Fetch all vehicles for a slot, ordered by departure time. */
export async function getVehiclesForSlot(slotId: number): Promise<VehicleRecord[]> {
  const result = await dbExecute(
    'SELECT * FROM vehicles WHERE slot_id = ? ORDER BY departure_time ASC, id ASC',
    [slotId]
  );
  return rowsToObjects(result).map((v) => decorateVehicle(v as unknown as VehicleRecord));
}

/** Fetch vehicles for many slots at once → Map<slot_id, VehicleRecord[]>. */
export async function getVehiclesForSlots(slotIds: number[]): Promise<Map<number, VehicleRecord[]>> {
  const map = new Map<number, VehicleRecord[]>();
  if (slotIds.length === 0) return map;
  const placeholders = slotIds.map(() => '?').join(',');
  const result = await dbExecute(
    `SELECT * FROM vehicles WHERE slot_id IN (${placeholders}) ORDER BY departure_time ASC, id ASC`,
    slotIds
  );
  for (const raw of rowsToObjects(result)) {
    const v = decorateVehicle(raw as unknown as VehicleRecord);
    const list = map.get(v.slot_id) || [];
    list.push(v);
    map.set(v.slot_id, list);
  }
  return map;
}

export function decorateVehicle(v: VehicleRecord): VehicleRecord {
  const total = Number(v.total_seats) || 0;
  const booked = Number(v.booked_seats) || 0;
  return { ...v, available_seats: Math.max(0, total - booked) };
}

/** A vehicle is selectable only when it is available and has free seats. */
export function isVehicleSelectable(v: VehicleRecord): boolean {
  return v.status === 'available' && (v.available_seats ?? 0) > 0;
}

export interface TxLike {
  execute({ sql, args }: { sql: string; args?: (string | number)[] }): Promise<{ rowsAffected?: number; columns?: string[]; rows?: unknown[]; lastInsertRowid?: number | bigint | null }>;
}

/**
 * Atomically increment a vehicle's booked_seats inside a write transaction.
 * Fails (returns false) when the vehicle is not available or would overflow —
 * this is the server-side overbooking guard. Callers must roll back the
 * transaction when false is returned.
 */
export async function incrementVehicleBookedSeats(
  tx: TxLike,
  vehicleId: number,
  count: number
): Promise<boolean> {
  const result = await tx.execute({
    sql: `UPDATE vehicles
      SET booked_seats = booked_seats + ?,
          status = CASE WHEN booked_seats + ? >= total_seats THEN 'full' ELSE 'available' END
      WHERE id = ? AND status = 'available' AND booked_seats + ? <= total_seats`,
    args: [count, count, vehicleId, count],
  });
  return Number(result.rowsAffected) === 1;
}

/** Fetch a single vehicle row inside a transaction. */
export async function getVehicleInTx(tx: TxLike, vehicleId: number): Promise<VehicleRecord | null> {
  const result = await tx.execute({
    sql: 'SELECT * FROM vehicles WHERE id = ?',
    args: [vehicleId],
  });
  const rows = rowsToObjects(result);
  if (!rows || rows.length === 0) return null;
  return decorateVehicle(rows[0] as unknown as VehicleRecord);
}

export async function getVehicleById(vehicleId: number): Promise<VehicleRecord | null> {
  const result = await dbExecute('SELECT * FROM vehicles WHERE id = ?', [vehicleId]);
  const row = rowToObject(result);
  return row ? decorateVehicle(row as unknown as VehicleRecord) : null;
}

export interface SaveVehiclesResult {
  ok: boolean;
  error?: string;
}

/**
 * Sync a slot's vehicle list inside a write transaction.
 * - Vehicles with an existing `id` are updated in place (booked_seats preserved).
 * - Vehicles without an `id` are inserted with booked_seats = 0.
 * - Vehicles omitted from the payload are deleted only when they have no
 *   booked seats; otherwise they are marked 'cancelled' so booking history
 *   stays intact.
 * - total_seats can never be reduced below the already booked seats.
 */
export async function saveVehiclesForSlot(
  tx: TxLike,
  slotId: number,
  vehicles: VehicleInput[]
): Promise<SaveVehiclesResult> {
  const existingResult = await tx.execute({
    sql: 'SELECT * FROM vehicles WHERE slot_id = ?',
    args: [slotId],
  });
  const existing = rowsToObjects(existingResult).map(
    (v) => decorateVehicle(v as unknown as VehicleRecord)
  );
  const existingById = new Map(existing.map((v) => [v.id, v]));

  const keptIds = new Set<number>();
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    const label = `Vehicle ${i + 1} (${v.vehicle_type || v.vehicle_number || 'unnamed'})`;
    const seats = Number(v.total_seats) || 0;
    const status = v.status && VEHICLE_STATUSES.includes(v.status as VehicleStatus) ? v.status : 'available';

    if (v.id && existingById.has(Number(v.id))) {
      const prev = existingById.get(Number(v.id))!;
      const booked = Number(prev.booked_seats) || 0;
      if (seats < booked) {
        return {
          ok: false,
          error: `${label}: total seats (${seats}) cannot be less than the already booked seats (${booked}).`,
        };
      }
      // 'available' with no free seats is stored as 'full'
      const effectiveStatus = seats - booked <= 0 && status === 'available' ? 'full' : status;
      await tx.execute({
        sql: `UPDATE vehicles SET
          vehicle_type = ?, vehicle_number = ?, driver_name = ?, driver_mobile = ?,
          departure_time = ?, arrival_time = ?, total_seats = ?, status = ?
          WHERE id = ? AND slot_id = ?`,
        args: [
          v.vehicle_type.trim(),
          v.vehicle_number.trim(),
          (v.driver_name || '').trim(),
          (v.driver_mobile || '').trim(),
          v.departure_time,
          v.arrival_time,
          seats,
          effectiveStatus,
          Number(v.id),
          slotId,
        ],
      });
      keptIds.add(Number(v.id));
    } else {
      // New vehicle (an id that doesn't belong to this slot is treated as new)
      await tx.execute({
        sql: `INSERT INTO vehicles
          (slot_id, vehicle_type, vehicle_number, driver_name, driver_mobile, departure_time, arrival_time, total_seats, booked_seats, status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)`,
        args: [
          slotId,
          v.vehicle_type.trim(),
          v.vehicle_number.trim(),
          (v.driver_name || '').trim(),
          (v.driver_mobile || '').trim(),
          v.departure_time,
          v.arrival_time,
          seats,
          status,
        ],
      });
    }
  }

  // Omitted vehicles: delete when unbooked, otherwise cancel.
  for (const prev of existing) {
    if (keptIds.has(prev.id)) continue;
    if ((Number(prev.booked_seats) || 0) === 0) {
      await tx.execute({ sql: 'DELETE FROM vehicles WHERE id = ?', args: [prev.id] });
    } else {
      await tx.execute({
        sql: "UPDATE vehicles SET status = 'cancelled' WHERE id = ?",
        args: [prev.id],
      });
    }
  }

  return { ok: true };
}
