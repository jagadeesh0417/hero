import { createClient } from '@libsql/client';
import path from 'path';
import fs from 'fs';

const isTurso = !!process.env.TURSO_DATABASE_URL;

function getDbUrl(): string {
  if (isTurso) return process.env.TURSO_DATABASE_URL!;
  const dbPath = path.join(process.cwd(), 'data', 'suman.db');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return `file:${dbPath}`;
}

const client = createClient({
  url: getDbUrl(),
  authToken: isTurso ? process.env.TURSO_AUTH_TOKEN : undefined,
});

export function rowsToObjects(result: { columns: string[]; rows: Array<Record<string, unknown>> }): Record<string, unknown>[] {
  return result.rows.map((row) => {
    const obj: Record<string, unknown> = {};
    result.columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

async function ensureSchema() {
  await client.executeMultiple(`
    CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_id INTEGER NOT NULL,
      time TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 10,
      available INTEGER NOT NULL DEFAULT 10,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (date_id) REFERENCES dates(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT UNIQUE NOT NULL,
      date_id INTEGER NOT NULL,
      slot_id INTEGER NOT NULL,
      passenger_count INTEGER NOT NULL,
      amount REAL NOT NULL,
      payment_status TEXT NOT NULL DEFAULT 'pending',
      payment_id TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (date_id) REFERENCES dates(id),
      FOREIGN KEY (slot_id) REFERENCES slots(id)
    );

    CREATE TABLE IF NOT EXISTS passengers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      gender TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_slots_date_id ON slots(date_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_booking_id ON bookings(booking_id);
    CREATE INDEX IF NOT EXISTS idx_passengers_booking_id ON passengers(booking_id);
  `);

  try {
    await client.execute("ALTER TABLE bookings ADD COLUMN utr_number TEXT DEFAULT ''");
  } catch {
    // column already exists
  }

  const defaultSettings: Record<string, string> = {
    upi_id: '9848579053@paytm',
    upi_name: 'Suman Travels',
    price_per_ticket: '500',
    business_name: 'Suman Travels',
    business_phone: '+91 9848579053',
    business_address: 'Lalitha Nagar, NGO Colony, Nandyala, Andhra Pradesh – 518502',
  };

  for (const [key, value] of Object.entries(defaultSettings)) {
    await client.execute({
      sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
      args: [key, value],
    });
  }
}

const init = ensureSchema().catch((err) => {
  console.error('Database schema initialization failed:', err);
});

export async function getDb() {
  await init;
  return client;
}

export default client;
