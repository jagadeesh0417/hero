import path from 'path';
import fs from 'fs';

const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';
const isTurso = !!TURSO_URL;

// Log env status on module load
console.log('[DB] TURSO_DATABASE_URL:', TURSO_URL ? 'set' : 'NOT SET');
console.log('[DB] TURSO_AUTH_TOKEN:', TURSO_TOKEN ? 'set' : 'NOT SET');

// Convert libsql:// to https:// for HTTP transport (more reliable on serverless)
function normalizeUrl(url: string): string {
  if (url.startsWith('libsql://')) {
    const httpsUrl = 'https://' + url.slice(9);
    console.log('[DB] Converted URL:', httpsUrl);
    return httpsUrl;
  }
  return url;
}

function getDbUrl(): string {
  if (isTurso) return normalizeUrl(TURSO_URL);
  const dbPath = path.join(process.cwd(), 'data', 'suman.db');
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  return `file:${dbPath}`;
}

// Dynamic import so module-level errors don't crash the server
async function createClientAsync() {
  const mod = await import('@libsql/client');
  const url = getDbUrl();
  console.log('[DB] Creating client with URL:', url.replace(/\/\/.*@/, '//***@'));
  const client = mod.createClient({
    url,
    authToken: isTurso ? TURSO_TOKEN : undefined,
  });
  return client;
}

type Client = Awaited<ReturnType<typeof createClientAsync>>;
type ResultSet = any;

let client: Client | null = null;
let schemaReady = false;
let initPromise: Promise<void> | null = null;

export function rowsToObjects(result: ResultSet): Record<string, unknown>[] {
  const cols = result.columns;
  return result.rows.map((row: any) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < cols.length; i++) {
      obj[cols[i]] = row[i];
    }
    return obj;
  });
}

export function rowToObject(result: ResultSet): Record<string, unknown> | null {
  if (result.rows.length === 0) return null;
  const cols = result.columns;
  const row: any = result.rows[0];
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < cols.length; i++) {
    obj[cols[i]] = row[i];
  }
  return obj;
}

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  console.log('[DB] Initializing schema...');

  if (!client) {
    throw new Error('Database client not initialized');
  }

  const tables = [
    `CREATE TABLE IF NOT EXISTS admin (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS dates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS slots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date_id INTEGER NOT NULL,
      time TEXT NOT NULL,
      capacity INTEGER NOT NULL DEFAULT 10,
      available INTEGER NOT NULL DEFAULT 10,
      enabled INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (date_id) REFERENCES dates(id) ON DELETE CASCADE
    )`,
    `CREATE TABLE IF NOT EXISTS bookings (
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
    )`,
    `CREATE TABLE IF NOT EXISTS passengers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_id TEXT NOT NULL,
      name TEXT NOT NULL,
      mobile TEXT NOT NULL,
      gender TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (booking_id) REFERENCES bookings(booking_id)
    )`,
    `CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    'CREATE INDEX IF NOT EXISTS idx_slots_date_id ON slots(date_id)',
    'CREATE INDEX IF NOT EXISTS idx_bookings_booking_id ON bookings(booking_id)',
    'CREATE INDEX IF NOT EXISTS idx_passengers_booking_id ON passengers(booking_id)',
  ];

  for (const sql of tables) {
    try {
      await client.execute({ sql });
    } catch (err: any) {
      console.error(`[DB] Schema error on: ${sql.slice(0, 60)}...`, err?.message || err);
      throw err;
    }
  }

  try {
    await client.execute({ sql: "ALTER TABLE bookings ADD COLUMN utr_number TEXT DEFAULT ''" });
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
    try {
      await client.execute({
        sql: 'INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)',
        args: [key, value],
      });
    } catch (err: any) {
      console.error(`[DB] Failed to seed setting ${key}:`, err?.message || err);
    }
  }

  schemaReady = true;
  console.log('[DB] Schema ready.');
}

export async function getDb(): Promise<Client> {
  if (!client) {
    client = await createClientAsync();
  }
  if (!initPromise) {
    initPromise = ensureSchema().catch((err) => {
      console.error('[DB] Schema init failed:', err?.message || err);
      initPromise = null; // allow retry
      schemaReady = false;
      throw err;
    });
  }
  await initPromise;
  return client;
}

export async function dbExecute(sql: string, args?: (string | number)[]): Promise<ResultSet> {
  const db = await getDb();
  try {
    return await db.execute({ sql, args });
  } catch (err: any) {
    console.error(`[DB] Execute error: ${err?.message || err}`);
    throw err;
  }
}

export async function testConnection(): Promise<{ ok: boolean; message: string }> {
  try {
    const db = await getDb();
    const r = await db.execute({ sql: 'SELECT 1 as ok' });
    return { ok: true, message: `Connected. ${r.rows.length} rows returned.` };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error('[DB] Connection test failed:', msg);
    return {
      ok: false,
      message: `Connection failed: ${msg}. TURSO_DATABASE_URL: ${TURSO_URL ? 'set' : 'NOT SET'}, TURSO_AUTH_TOKEN: ${TURSO_TOKEN ? 'set' : 'NOT SET'}`,
    };
  }
}
