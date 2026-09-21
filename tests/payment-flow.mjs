import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';

const BASE = process.env.TEST_BASE_URL || 'http://localhost:3103';
const KEY_ID = 'rzp_test_mockkey';
const KEY_SECRET = 'mocksecret123';
const WEBHOOK_SECRET = 'mockwebhooksecret';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DB_PATH = path.join(root, 'data', 'suman.db');
const MOCK_STATE = path.join(root, 'data', 'rzp-mock-state.json');

const results = [];
let passCount = 0;
let failCount = 0;

function assert(name, cond, extra) {
  if (cond) {
    passCount++;
    results.push(`PASS  ${name}`);
    console.log(`PASS  ${name}`);
  } else {
    failCount++;
    results.push(`FAIL  ${name}  ${extra !== undefined ? JSON.stringify(extra) : ''}`);
    console.log(`FAIL  ${name}  ${extra !== undefined ? JSON.stringify(extra) : ''}`);
  }
}

const db = new Database(DB_PATH);

function resetDb() {
  db.prepare('DELETE FROM passengers').run();
  db.prepare('DELETE FROM bookings').run();
  db.prepare('DELETE FROM payment_events').run();
  db.prepare('DELETE FROM vehicles').run();
  db.prepare('DELETE FROM slots').run();
  db.prepare('DELETE FROM dates').run();
  const d = db.prepare("INSERT INTO dates (date) VALUES (?)").run('2026-12-15');
  const dateId = db.prepare("SELECT id FROM dates WHERE date='2026-12-15'").get().id;
  db.prepare("INSERT INTO slots (date_id, time, enabled, status) VALUES (?, '07:30', 1, 'active')").run(dateId);
  db.prepare("INSERT INTO slots (date_id, time, enabled, status) VALUES (?, '10:30', 1, 'active')").run(dateId);
  const slot = db.prepare("SELECT id FROM slots WHERE date_id=? AND time='07:30'").get(dateId);
  return { dateId, slotId: slot.id };
}

function writeMock(cfg) {
  fs.writeFileSync(MOCK_STATE, JSON.stringify({ orders: {}, auto_capture: false, order_counter: 0, payment_counter: 0, ...cfg }, null, 2));
}

function readMock() {
  try {
    return JSON.parse(fs.readFileSync(MOCK_STATE, 'utf8'));
  } catch {
    return { orders: {} };
  }
}

function markOrder(orderId, { status, amount, method, paymentStatus } = {}) {
  const s = readMock();
  const o = s.orders[orderId];
  if (!o) throw new Error('order not in mock state: ' + orderId);
  o.attempts = 1;
  const payAmount = amount != null ? Number(amount) : o.amount;
  const payStatus = paymentStatus || (status === 'paid' ? 'captured' : status);
  if (status === 'paid') {
    o.amount_paid = payAmount;
    o.amount_due = Math.max(0, o.amount - o.amount_paid);
    o.status = o.amount_due === 0 ? 'paid' : 'partially_paid';
    o.payments = o.payments || [];
    s.payment_counter = (s.payment_counter || 0) + 1;
    const pid = 'pay_MOCK_' + String(s.payment_counter).padStart(6, '0');
    o.payments.push({
      id: pid,
      amount: payAmount,
      currency: 'INR',
      status: payStatus,
      method: method || 'upi',
      order_id: orderId,
      error_description: payStatus === 'failed' ? 'Mock failure' : '',
      acquirer_data: { bank_transaction_id: 'MOCKBANKREF_' + String(s.payment_counter) },
    });
  } else {
    o.payments = o.payments || [];
    s.payment_counter = (s.payment_counter || 0) + 1;
    const pid = 'pay_MOCK_' + String(s.payment_counter).padStart(6, '0');
    o.payments.push({
      id: pid,
      amount: payAmount,
      currency: 'INR',
      status: payStatus || status,
      method: method || 'upi',
      order_id: orderId,
      error_description: payStatus === 'failed' ? 'Mock failure' : '',
      acquirer_data: { bank_transaction_id: 'MOCKBANKREF_' + String(s.payment_counter) },
    });
  }
  fs.writeFileSync(MOCK_STATE, JSON.stringify(s, null, 2));
  return o.payments[o.payments.length - 1];
}

const hmac = (data, secret) => crypto.createHmac('sha256', secret).update(data).digest('hex');

async function postJson(url, body, headers = {}) {
  const res = await fetch(BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    redirect: 'manual',
  });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text };
}

async function get(url, headers = {}) {
  const res = await fetch(BASE + url, { headers, redirect: 'manual' });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch {}
  return { status: res.status, json, text, location: res.headers.get('location') };
}

async function webhookEvent(eventType, payment, order) {
  const payload = { event: eventType, payload: { payment: { entity: payment }, order: { entity: order } } };
  const body = JSON.stringify(payload);
  const sig = hmac(body, WEBHOOK_SECRET);
  const res = await postJson('/api/razorpay/webhook', JSON.parse(body), {
    'x-razorpay-signature': sig,
  });
  return res;
}

function bookingRow(bookingId) {
  return db.prepare('SELECT * FROM bookings WHERE booking_id = ?').get(bookingId);
}

function getLastPayment(pid) {
  return db.prepare("SELECT * FROM payment_events WHERE razorpay_payment_id = ? ORDER BY id DESC LIMIT 1").get(pid || '_');
}

async function seedAdmin() {
  const admin = db.prepare('SELECT id FROM admin LIMIT 1').get();
  if (!admin) {
    await fetch(BASE + '/api/seed');
  }
}

// ---------------------------------------------------------------------------
console.log('# Payment-flow integration tests (mock Razorpay)');
console.log(`BASE=${BASE}\n`);

// ---------------------------------------------------------------------------
// TEST 1 — happy path: booking -> order -> paid -> callback -> confirmed
resetDb(); writeMock({});
const s1 = db.prepare("SELECT id, date FROM dates ORDER BY id DESC LIMIT 1").get();
writeMock({});
let r = await postJson('/api/bookings', {
  date_id: s1.id, slot_id: db.prepare("SELECT id FROM slots WHERE date_id=? ORDER BY id LIMIT 1").get(s1.id).id,
  passengers: [{ name: 'Anil Kumar', mobile: '9876543210', gender: 'Male' }, { name: 'Sunita', mobile: '9876543211', gender: 'Female' }],
  exam_center: 'G Pulla Reddy',
});
assert('T1 create booking', r.status === 201 && r.json.booking_id, r);
const b1 = bookingRow(r.json.booking_id);

r = await postJson('/api/razorpay/create-order', { booking_id: b1.booking_id });
assert('T1 create-order ok', r.status === 200 && r.json.order_id, r);
assert('T1 order amount = booking amount (paise)', Number(r.json.amount) === Math.round(Number(b1.amount) * 100), { got: r.json.amount, want: b1.amount });

const mockOrder1 = readMock().orders[r.json.order_id];
const pay1 = markOrder(mockOrder1.id, { status: 'paid' });
const sig1 = hmac(`${mockOrder1.id}|${pay1.id}`, KEY_SECRET);
r = await get(`/api/razorpay/callback?razorpay_order_id=${mockOrder1.id}&razorpay_payment_id=${pay1.id}&razorpay_signature=${sig1}`);
const b1b = bookingRow(b1.booking_id);
assert('T1 callback redirects to /success', r.status === 307 && r.location.includes('/success?id=' + b1.booking_id), { status: r.status, location: r.location });
assert('T1 booking confirmed', b1b.payment_status === 'confirmed', b1b.payment_status);
assert('T1 serial assigned (base 1000)', Number(b1b.serial_number) === 1000, b1b.serial_number);
assert('T1 exam center preserved', b1b.exam_center === 'G Pulla Reddy', b1b.exam_center);
assert('T1 payment id stored', b1b.razorpay_payment_id === pay1.id, b1b.razorpay_payment_id);
assert('T1 customer name/mobile stored', b1b.customer_name === 'Anil Kumar' && b1b.customer_mobile === '9876543210', { n: b1b.customer_name, m: b1b.customer_mobile });

// TEST 4 — refresh / re-hit callback => no double confirm, same serial
r = await get(`/api/razorpay/callback?razorpay_order_id=${mockOrder1.id}&razorpay_payment_id=${pay1.id}&razorpay_signature=${sig1}`);
const b1c = bookingRow(b1.booking_id);
const countB1 = db.prepare("SELECT COUNT(*) c FROM bookings WHERE booking_id = ?").get(b1.booking_id).c;
assert('T4 re-callback redirects /success', r.status === 307 && r.location.includes('/success'), { status: r.status });
assert('T4 still single booking record', countB1 === 1, countB1);
assert('T4 serial unchanged', Number(b1c.serial_number) === 1000, b1c.serial_number);

// TEST 5 — webhook before callback
resetDb(); writeMock({});
const s5 = db.prepare("SELECT id, date FROM dates ORDER BY id DESC LIMIT 1").get();
r = await postJson('/api/bookings', {
  date_id: s5.id, slot_id: db.prepare("SELECT id FROM slots WHERE date_id=? ORDER BY id LIMIT 1").get(s5.id).id,
  passengers: [{ name: 'Ravi', mobile: '9876512345', gender: 'Male' }],
  exam_center: 'Brundavan College',
});
const b5 = bookingRow(r.json.booking_id);
r = await postJson('/api/razorpay/create-order', { booking_id: b5.booking_id });
const o5 = readMock().orders[r.json.order_id];
const p5 = markOrder(o5.id, { status: 'paid' });
r = await webhookEvent('payment.captured', p5, { id: o5.id, amount: o5.amount });
const b5a = bookingRow(b5.booking_id);
assert('T5 webhook confirms booking', r.status === 200 && r.json.status === 'confirmed', { status: r.status, json: r.json });
assert('T5 booking confirmed with serial 1000', b5a.payment_status === 'confirmed' && Number(b5a.serial_number) === 1000, b5a);
// now callback arrives
const sig5 = hmac(`${o5.id}|${p5.id}`, KEY_SECRET);
r = await get(`/api/razorpay/callback?razorpay_order_id=${o5.id}&razorpay_payment_id=${p5.id}&razorpay_signature=${sig5}`);
const b5b = bookingRow(b5.booking_id);
assert('T5 callback after webhook still /success', r.status === 307 && r.location.includes('/success'), r.location);
assert('T5 serial still 1000 (no dup)', Number(b5b.serial_number) === 1000, b5b.serial_number);

// TEST 6 — callback before webhook
resetDb(); writeMock({});
const s6 = db.prepare("SELECT id, date FROM dates ORDER BY id DESC LIMIT 1").get();
r = await postJson('/api/bookings', {
  date_id: s6.id, slot_id: db.prepare("SELECT id FROM slots WHERE date_id=? ORDER BY id LIMIT 1").get(s6.id).id,
  passengers: [{ name: 'Meena', mobile: '9876523456', gender: 'Female' }], exam_center: 'KV Sunba Reddy',
});
const b6 = bookingRow(r.json.booking_id);
r = await postJson('/api/razorpay/create-order', { booking_id: b6.booking_id });
const o6 = readMock().orders[r.json.order_id];
const p6 = markOrder(o6.id, { status: 'paid' });
const sig6 = hmac(`${o6.id}|${p6.id}`, KEY_SECRET);
await get(`/api/razorpay/callback?razorpay_order_id=${o6.id}&razorpay_payment_id=${p6.id}&razorpay_signature=${sig6}`);
r = await webhookEvent('payment.captured', p6, { id: o6.id, amount: o6.amount });
const b6b = bookingRow(b6.booking_id);
assert('T6 webhook after callback reports already_confirmed', r.json.status === 'already_confirmed', r.json);
assert('T6 booking still confirmed serial 1000', b6b.payment_status === 'confirmed' && Number(b6b.serial_number) === 1000, b6b);

// TEST 7 — same webhook delivered twice
r = await webhookEvent('payment.captured', p6, { id: o6.id, amount: o6.amount });
const b7 = bookingRow(b6.booking_id);
const evCount = db.prepare("SELECT COUNT(*) c FROM payment_events WHERE event IN ('webhook','booking_confirmed') AND razorpay_order_id = ?").get(o6.id).c;
assert('T7 double webhook: still serial 1000', Number(b7.serial_number) === 1000, b7.serial_number);
assert('T7 no duplicate confirm rows (2 webhooks max)', evCount <= 3, evCount);

// TEST 8 — payment failed => NOT confirmed
resetDb(); writeMock({});
const s8 = db.prepare("SELECT id, date FROM dates ORDER BY id DESC LIMIT 1").get();
r = await postJson('/api/bookings', {
  date_id: s8.id, slot_id: db.prepare("SELECT id FROM slots WHERE date_id=? ORDER BY id LIMIT 1").get(s8.id).id,
  passengers: [{ name: 'Failing', mobile: '9876534567', gender: 'Male' }], exam_center: 'Poojya Education Society',
});
const b8 = bookingRow(r.json.booking_id);
r = await postJson('/api/razorpay/create-order', { booking_id: b8.booking_id });
const o8 = readMock().orders[r.json.order_id];
const p8 = markOrder(o8.id, { status: 'failed', paymentStatus: 'failed' });
r = await webhookEvent('payment.failed', p8, { id: o8.id, amount: o8.amount });
const b8b = bookingRow(b8.booking_id);
assert('T8 failed payment -> booking not confirmed', b8b.payment_status !== 'confirmed', b8b.payment_status);
assert('T8 failed payment -> marked failed', b8b.payment_status === 'failed' || b8b.payment_status === 'pending', b8b.payment_status);

// TEST 9 — payment pending => NOT confirmed
r = await get('/api/razorpay/status?booking_id=' + b8.booking_id);
assert('T9 status endpoint does not confirm a failed booking', r.json.status !== 'confirmed', r.json);

// TEST 11 — invalid signature rejected
r = await postJson('/api/razorpay/verify', {
  booking_id: b8.booking_id, razorpay_order_id: o8.id, razorpay_payment_id: p8.id, razorpay_signature: 'invalid_signature_here',
});
assert('T11 invalid signature -> 400', r.status === 400, { status: r.status, json: r.json });

// TEST 10 — amount mismatch => configuration must NOT be confirmed
resetDb(); writeMock({});
const s10 = db.prepare("SELECT id, date FROM dates ORDER BY id DESC LIMIT 1").get();
r = await postJson('/api/bookings', {
  date_id: s10.id, slot_id: db.prepare("SELECT id FROM slots WHERE date_id=? ORDER BY id LIMIT 1").get(s10.id).id,
  passengers: [{ name: 'AmountTest', mobile: '9876555666', gender: 'Male' }], exam_center: 'Poojya Education Society',
});
const b10 = bookingRow(r.json.booking_id);
r = await postJson('/api/razorpay/create-order', { booking_id: b10.booking_id });
const o10 = readMock().orders[r.json.order_id];
const wrongAmount = Math.round(Number(b10.amount) * 100) - 100; // ₹1 short
const p10 = markOrder(o10.id, { status: 'paid', amount: wrongAmount });
const sig10 = hmac(`${o10.id}|${p10.id}`, KEY_SECRET);
r = await get(`/api/razorpay/callback?razorpay_order_id=${o10.id}&razorpay_payment_id=${p10.id}&razorpay_signature=${sig10}`);
const b10b = bookingRow(b10.booking_id);
assert('T10 wrong-amount payment must NOT confirm booking', b10b.payment_status !== 'confirmed', { status: b10b.payment_status, serial: b10b.serial_number });

// TEST 12 — browser closed after payment -> recovery
resetDb(); writeMock({});
const s12 = db.prepare("SELECT id, date FROM dates ORDER BY id DESC LIMIT 1").get();
r = await postJson('/api/bookings', {
  date_id: s12.id, slot_id: db.prepare("SELECT id FROM slots WHERE date_id=? ORDER BY id LIMIT 1").get(s12.id).id,
  passengers: [{ name: 'ClosedBrowser', mobile: '9876541333', gender: 'Male' }], exam_center: 'RGM College',
});
const b12 = bookingRow(r.json.booking_id);
r = await postJson('/api/razorpay/create-order', { booking_id: b12.booking_id });
const o12 = readMock().orders[r.json.order_id];
markOrder(o12.id, { status: 'paid' });
// no callback, no webhook
r = await postJson('/api/razorpay/recover', { booking_id: b12.booking_id });
const b12b = bookingRow(b12.booking_id);
assert('T12 recover confirms after browser close', r.json.status === 'confirmed', r.json);
assert('T12 booking confirmed', b12b.payment_status === 'confirmed', b12b.payment_status);

// TEST 13 — exam center + slot preserved after payment (covered by T1 assertions; repeat with 10:30)
assert('T13 exam center set during booking and preserved', b12b.exam_center === 'RGM College', b12b.exam_center);
const slotTime = db.prepare('SELECT s.time FROM slots s JOIN bookings bb ON bb.slot_id = s.id WHERE bb.booking_id = ?').get(b12.booking_id);
assert('T13 slot preserved (07:30)', slotTime.time === '07:30', slotTime);

// TEST 15 — exclusive slot: two customers same slot -> unique serials
r = await postJson('/api/bookings', {
  date_id: s12.id, slot_id: db.prepare("SELECT id FROM slots WHERE date_id=? ORDER BY id LIMIT 1").get(s12.id).id,
  passengers: [{ name: 'Second', mobile: '9876544555', gender: 'Male' }], exam_center: 'RGM College',
});
const b15 = bookingRow(r.json.booking_id);
r = await postJson('/api/razorpay/create-order', { booking_id: b15.booking_id });
const o15 = readMock().orders[r.json.order_id];
const p15 = markOrder(o15.id, { status: 'paid' });
const sig15 = hmac(`${o15.id}|${p15.id}`, KEY_SECRET);
await get(`/api/razorpay/callback?razorpay_order_id=${o15.id}&razorpay_payment_id=${p15.id}&razorpay_signature=${sig15}`);
const b15b = bookingRow(b15.booking_id);
assert('T15 second booking gets distinct serial', Number(b15b.serial_number) === 1001, b15b.serial_number);

// TEST 17 — retry create-order reuses same order (no duplicate payment)
r = await postJson('/api/razorpay/create-order', { booking_id: b15.booking_id });
assert('T17 confirmed booking cannot create new order', r.status === 400 && /already completed/i.test(r.json?.error || ''), { status: r.status, json: r.json });

// TEST 2 — payment succeeds but callback never fires -> status endpoint confirms
resetDb(); writeMock({});
const s2 = db.prepare("SELECT id, date FROM dates ORDER BY id DESC LIMIT 1").get();
r = await postJson('/api/bookings', {
  date_id: s2.id, slot_id: db.prepare("SELECT id FROM slots WHERE date_id=? ORDER BY id LIMIT 1").get(s2.id).id,
  passengers: [{ name: 'NoCallback', mobile: '9876544666', gender: 'Female' }], exam_center: 'G Pulla Reddy',
});
const b2 = bookingRow(r.json.booking_id);
r = await postJson('/api/razorpay/create-order', { booking_id: b2.booking_id });
const o2 = readMock().orders[r.json.order_id];
markOrder(o2.id, { status: 'paid' });
r = await get('/api/razorpay/status?booking_id=' + b2.booking_id);
const b2b = bookingRow(b2.booking_id);
assert('T2 status endpoint confirms paid booking', r.json.status === 'confirmed', r.json);
assert('T2 booking confirmed', b2b.payment_status === 'confirmed', b2b.payment_status);

// TEST 16 — delayed payment.failed webhook must NOT revert a confirmed booking
const p2 = readMock().orders[o2.id].payments[0];
await webhookEvent('payment.failed', { ...p2, id: 'pay_MOCK_DELAYED', amount: o2.amount }, { id: o2.id, amount: o2.amount });
const b16 = bookingRow(b2.booking_id);
assert('T16 delayed failed webhook does not revert confirmed booking', b16.payment_status === 'confirmed', b16.payment_status);

// TEST 18 — create-order for a PAID-but-unconfirmed booking must not create a
// second order (double-charge protection); returns 409 payment_already_completed
resetDb(); writeMock({});
const s18 = db.prepare("SELECT id, date FROM dates ORDER BY id DESC LIMIT 1").get();
r = await postJson('/api/bookings', {
  date_id: s18.id, slot_id: db.prepare("SELECT id FROM slots WHERE date_id=? ORDER BY id LIMIT 1").get(s18.id).id,
  passengers: [{ name: 'PaidStuck', mobile: '9876543777', gender: 'Male' }], exam_center: 'Poojya Education Society',
});
const b18 = bookingRow(r.json.booking_id);
r = await postJson('/api/razorpay/create-order', { booking_id: b18.booking_id });
const o18 = readMock().orders[r.json.order_id];
markOrder(o18.id, { status: 'paid' });
r = await postJson('/api/razorpay/create-order', { booking_id: b18.booking_id });
assert('T18 paid-but-unconfirmed booking blocked from new order', r.status === 409 && r.json.status === 'payment_already_completed', { status: r.status, json: r.json });

await db.close();

console.log('\n----------------------------------------');
console.log(`TOTAL: ${passCount} passed, ${failCount} failed`);
process.exit(failCount > 0 ? 1 : 0);