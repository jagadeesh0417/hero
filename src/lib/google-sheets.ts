export interface GoogleSheetRow {
  serial_number: string;
  booking_id: string;
  customer_name: string;
  gender: string;
  mobile: string;
  email: string;
  exam_date: string;
  slot: string;
  exam_center: string;
  tickets: number;
  razorpay_payment_id: string;
  razorpay_order_id: string;
  bank_ref: string;
  payment_status: string;
  booking_time: string;
}

const GOOGLE_SHEETS_PRIVATE_KEY = process.env.GOOGLE_SHEETS_PRIVATE_KEY || '';
const GOOGLE_SHEETS_CLIENT_EMAIL = process.env.GOOGLE_SHEETS_CLIENT_EMAIL || '';
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID || '';
const RANGE = 'Sheet1!A:O';

function base64Decode(str: string): string {
  try {
    return Buffer.from(str, 'base64').toString('utf-8');
  } catch {
    return str;
  }
}

async function getAccessToken(): Promise<string> {
  const privateKey = GOOGLE_SHEETS_PRIVATE_KEY.startsWith('-----BEGIN')
    ? GOOGLE_SHEETS_PRIVATE_KEY
    : base64Decode(GOOGLE_SHEETS_PRIVATE_KEY);

  const header = { alg: 'RS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: GOOGLE_SHEETS_CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  };

  function b64(obj: unknown): string {
    return Buffer.from(JSON.stringify(obj))
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  const msg = `${b64(header)}.${b64(claimSet)}`;
  const crypto = await import('crypto');
  const sig = crypto.default
    ? crypto.default.createSign('RSA-SHA256').update(msg).sign(privateKey, 'base64')
    : crypto.createSign('RSA-SHA256').update(msg).sign(privateKey, 'base64');

  const jwt = `${msg}.${sig.replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_')}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Google OAuth failed: ${data.error_description || res.statusText}`);
  return data.access_token;
}

export async function appendBookingToSheet(row: GoogleSheetRow): Promise<void> {
  if (!GOOGLE_SHEETS_CLIENT_EMAIL || !GOOGLE_SHEETS_PRIVATE_KEY || !SPREADSHEET_ID) {
    console.log('[Google Sheets] Not configured — skipping append');
    return;
  }

  try {
    const token = await getAccessToken();

    const values = [[
      row.serial_number,
      row.booking_id,
      row.customer_name,
      row.gender,
      row.mobile,
      row.email,
      row.exam_date,
      row.slot,
      row.exam_center,
      row.tickets,
      row.razorpay_payment_id,
      row.razorpay_order_id,
      row.bank_ref,
      row.payment_status,
      row.booking_time,
    ]];

    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${RANGE}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('[Google Sheets] Append error:', err);
    } else {
      console.log('[Google Sheets] Row appended successfully');
    }
  } catch (err: any) {
    console.error('[Google Sheets] Error:', err?.message || err);
  }
}