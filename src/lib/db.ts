import path from 'path';
import fs from 'fs';

const TURSO_URL = process.env.TURSO_DATABASE_URL || '';
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN || '';
const isTurso = !!TURSO_URL;

function normalizeUrl(url: string): string {
  if (url.startsWith('libsql://')) return 'https://' + url.slice(9);
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

// ---------------------------------------------------------------------------
// Direct Turso HTTP client (hrana v2 over HTTP via raw fetch)
// ---------------------------------------------------------------------------

function toHranaValue(v: string | number | null | undefined): Record<string, unknown> {
  if (v === null || v === undefined) return { type: 'null' };
  if (typeof v === 'number') {
    if (Number.isInteger(v)) return { type: 'integer', value: String(v) };
    return { type: 'float', value: v };
  }
  return { type: 'text', value: v };
}

function extractColumns(r: any): string[] {
  if (r.cols && Array.isArray(r.cols)) {
    return r.cols.map((c: any) => (typeof c === 'string' ? c : c.name || ''));
  }
  return r.columns || [];
}

function decodeCell(val: any): any {
  if (val === null || val === undefined) return null;
  if (typeof val !== 'object' || Array.isArray(val)) return val;
  if (val.type === 'null') return null;
  if (val.type === 'integer' || val.type === 'float') return Number(val.value);
  return val.value;
}

function encodeArgs(args?: (string | number)[]): Record<string, unknown>[] {
  return (args || []).map(toHranaValue);
}

interface TursoRequest {
  type: 'execute' | 'close';
  stmt?: {
    sql: string;
    args: Record<string, unknown>[];
    named_args: string[];
    want_rows: boolean;
  };
}

interface TursoResponse {
  baton?: string | null;
  base_url?: string | null;
  results: Array<{
    type: 'ok' | 'error';
    response?: { type: string; result?: TursoResult };
    error?: { message: string };
  }>;
}

interface TursoResult {
  columns: string[];
  rows: unknown[][];
  affected_row_count?: number;
  last_insert_rowid?: string | number | null;
}

export type ResultSet = {
  columns: string[];
  rows: any[];
  lastInsertRowid?: number | null;
};

class DirectTursoClient {
  private url: string;
  private token: string;

  constructor(url: string, token: string) {
    this.url = url.replace(/\/+$/, '');
    this.token = token;
  }

  async execute({ sql, args }: { sql: string; args?: (string | number)[] }): Promise<ResultSet> {
    const resp = await this._pipeline([
      { type: 'execute', stmt: { sql, args: encodeArgs(args), named_args: [], want_rows: true } },
      { type: 'close' },
    ]);

    const first = resp.results[0];
    if (!first || first.type === 'error') {
      throw new Error(first?.error?.message || 'Turso execute failed');
    }
    const r = first.response?.result;
    if (!r) throw new Error('Unexpected Turso response');

    const columns = extractColumns(r);
    const rawRows = r.rows || [];
    const rows = rawRows.map((row: unknown[]) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < columns.length; i++) obj[columns[i]] = decodeCell((row as any[])[i]);
      return obj;
    });

    return {
      columns,
      rows,
      lastInsertRowid: r.last_insert_rowid != null ? Number(r.last_insert_rowid) : undefined,
    };
  }

  async transaction(_mode: string): Promise<DirectTursoTransaction> {
    return new DirectTursoTransaction(this);
  }

  close() {}

  /** @private Send pipeline, optionally with a baton. Returns full response body. */
  async _pipeline(requests: TursoRequest[], baton?: string | null): Promise<TursoResponse> {
    const body: Record<string, unknown> = { requests };
    if (baton) body.baton = baton;

    const res = await fetch(`${this.url}/v2/pipeline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`Turso HTTP ${res.status}: ${text || res.statusText}`);
    }

    return res.json() as Promise<TursoResponse>;
  }
}

class DirectTursoTransaction {
  private client: DirectTursoClient;
  private baton: string | null | undefined;
  private _opened = false;
  private _closed = false;

  constructor(client: DirectTursoClient) {
    this.client = client;
  }

  async execute({ sql, args }: { sql: string; args?: (string | number)[] }): Promise<ResultSet> {
    if (!this._opened) {
      const resp = await this.client._pipeline([
        { type: 'execute', stmt: { sql: 'BEGIN', args: [], named_args: [], want_rows: false } },
      ]);
      this.baton = resp.baton;
      this._opened = true;
    }

    const resp = await this.client._pipeline([
      { type: 'execute', stmt: { sql, args: encodeArgs(args), named_args: [], want_rows: true } },
    ], this.baton);
    this.baton = resp.baton;

    const first = resp.results[0];
    if (!first || first.type === 'error') {
      throw new Error(first?.error?.message || 'Turso execute failed');
    }
    const r = first.response?.result;
    if (!r) return { columns: [], rows: [] };

    const txnCols = extractColumns(r);
    const txnRows = (r.rows || []).map((row: unknown[]) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < txnCols.length; i++) obj[txnCols[i]] = decodeCell((row as any[])[i]);
      return obj;
    });

    return {
      columns: txnCols,
      rows: txnRows,
      lastInsertRowid: r.last_insert_rowid != null ? Number(r.last_insert_rowid) : undefined,
    };
  }

  async commit(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    await this.client._pipeline([
      { type: 'execute', stmt: { sql: 'COMMIT', args: [], named_args: [], want_rows: false } },
      { type: 'close' },
    ], this.baton);
  }

  async rollback(): Promise<void> {
    if (this._closed) return;
    this._closed = true;
    await this.client._pipeline([
      { type: 'execute', stmt: { sql: 'ROLLBACK', args: [], named_args: [], want_rows: false } },
      { type: 'close' },
    ], this.baton);
  }
}

// ---------------------------------------------------------------------------
// Local SQLite fallback via @libsql/client
// ---------------------------------------------------------------------------
type LibsqlClient = Awaited<ReturnType<typeof import('@libsql/client')['createClient']>>;

async function createLocalClient(): Promise<LibsqlClient> {
  const url = getDbUrl();
  const mod = await import('@libsql/client');
  return mod.createClient({ url });
}

// ---------------------------------------------------------------------------
// Unified client
// ---------------------------------------------------------------------------
type Client = DirectTursoClient | LibsqlClient;

let client: Client | null = null;
let schemaReady = false;
let initPromise: Promise<void> | null = null;

export function rowsToObjects(result: any): Record<string, unknown>[] {
  const cols: string[] = result.columns || [];
  return (result.rows || []).map((row: any) => {
    const obj: Record<string, unknown> = {};
    for (let i = 0; i < cols.length; i++) {
      obj[cols[i]] = typeof row === 'object' && !Array.isArray(row) ? row[cols[i]] : decodeCell(row[i]);
    }
    return obj;
  });
}

export function rowToObject(result: any): Record<string, unknown> | null {
  if (!result || !result.rows || result.rows.length === 0) return null;
  const cols: string[] = result.columns || [];
  const row = result.rows[0];
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < cols.length; i++) {
    obj[cols[i]] = typeof row === 'object' && !Array.isArray(row) ? row[cols[i]] : decodeCell(row[i]);
  }
  return obj;
}

async function ensureSchema(): Promise<void> {
  if (schemaReady) return;
  console.log('[DB] Initializing schema...');

  if (!client) throw new Error('Database client not initialized');

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
    `CREATE TABLE IF NOT EXISTS payment_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      razorpay_order_id TEXT NOT NULL DEFAULT '',
      razorpay_payment_id TEXT NOT NULL DEFAULT '',
      event TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT '',
      amount INTEGER NOT NULL DEFAULT 0,
      signature_valid INTEGER NOT NULL DEFAULT 0,
      booking_id TEXT NOT NULL DEFAULT '',
      raw_payload TEXT NOT NULL DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`,
    'CREATE INDEX IF NOT EXISTS idx_payment_events_order ON payment_events(razorpay_order_id)',
    'CREATE INDEX IF NOT EXISTS idx_payment_events_booking ON payment_events(booking_id)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_slots_date_id_time ON slots(date_id, time)',
    'CREATE INDEX IF NOT EXISTS idx_slots_date_id ON slots(date_id)',
    'CREATE INDEX IF NOT EXISTS idx_bookings_booking_id ON bookings(booking_id)',
    'CREATE INDEX IF NOT EXISTS idx_passengers_booking_id ON passengers(booking_id)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_serial ON bookings(date_id, slot_id, serial_number)',
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
  }
  try {
    await client.execute({ sql: "ALTER TABLE slots ADD COLUMN vehicle_time TEXT DEFAULT ''" });
  } catch {
  }
  try {
    await client.execute({ sql: "ALTER TABLE bookings ADD COLUMN exam_center TEXT NOT NULL DEFAULT ''" });
  } catch {
  }
  try {
    await client.execute({ sql: "ALTER TABLE bookings ADD COLUMN payment_timestamp DATETIME DEFAULT NULL" });
  } catch {
  }
  try {
    await client.execute({ sql: "ALTER TABLE bookings ADD COLUMN razorpay_order_id TEXT DEFAULT ''" });
  } catch {
  }
  try {
    await client.execute({ sql: "ALTER TABLE bookings ADD COLUMN razorpay_payment_id TEXT DEFAULT ''" });
  } catch {
  }
  try {
    await client.execute({ sql: "ALTER TABLE bookings ADD COLUMN customer_name TEXT DEFAULT ''" });
  } catch {
  }
  try {
    await client.execute({ sql: "ALTER TABLE bookings ADD COLUMN customer_mobile TEXT DEFAULT ''" });
  } catch {
  }
  try {
    await client.execute({ sql: "ALTER TABLE bookings ADD COLUMN customer_email TEXT DEFAULT ''" });
  } catch {
  }
  try {
    await client.execute({ sql: "ALTER TABLE bookings ADD COLUMN serial_number INTEGER DEFAULT NULL" });
  } catch {
  }
  try {
    await client.execute({ sql: "ALTER TABLE bookings ADD COLUMN razorpay_status TEXT DEFAULT ''" });
  } catch {
  }
  try {
    await client.execute({ sql: "ALTER TABLE bookings ADD COLUMN razorpay_method TEXT DEFAULT ''" });
  } catch {
  }
  try {
    await client.execute({ sql: "ALTER TABLE bookings ADD COLUMN razorpay_bank_ref TEXT DEFAULT ''" });
  } catch {
  }

  const defaultSettings: Record<string, string> = {
    upi_id: '9848579053@paytm',
    upi_name: 'Suman Travels',
    price_per_ticket: '500',
    business_name: 'Suman Travels',
    business_phone: '+91 9010532226',
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
    if (isTurso) {
      console.log('[DB] Creating direct Turso HTTP client');
      client = new DirectTursoClient(getDbUrl(), TURSO_TOKEN);
    } else {
      client = await createLocalClient();
    }
  }
  if (!initPromise) {
    initPromise = ensureSchema().catch((err) => {
      console.error('[DB] Schema init failed:', err?.message || err);
      initPromise = null;
      schemaReady = false;
      throw err;
    });
  }
  await initPromise;
  return client;
}

export async function dbExecute(sql: string, args?: (string | number)[]): Promise<any> {
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
