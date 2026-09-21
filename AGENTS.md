<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Summary

### Completed
1. **Vehicle timings Save button** — Made dark navy (`bg-[#1e3a5f] text-white`) on admin slots page for visibility
2. **Exam Center dropdown** — Required field in booking flow, stored in `bookings.exam_center`, shown in admin/success/doc
3. **Exam Center as own step** — 6-step flow: Slot → Tickets → Center → Details → Summary → Payment
4. **Word docs → Excel reports** — Replaced per-booking Word docs with per-date Excel files using `exceljs`
   - `src/lib/excel.ts` — `generateDateExcel()` and `generateAllDatesExcel()`
   - `GET /api/documents?download=YYYY-MM-DD` streams .xlsx; no params returns dates with counts
   - Admin Documents page shows one file per travel date
5. **BharatPe removed** — BharatPe integration was scrapped; Razorpay is the only payment gateway
6. **Razorpay payment flow audit and fix** (complete end-to-end):
   - **Root cause found**: `/api/bookings/[bookingId]/status` returned `paid_detected` without calling `confirmBooking()`. If the webhook (`RAZORPAY_WEBHOOK_SECRET` unset) and handler callback both didn't fire, the booking stayed `pending` forever despite successful payment.
   - **Fix**: Status endpoint now fetches captured payment from Razorpay and actively calls `confirmBooking()` when `order.status === 'paid'`, then returns `confirmed` with serial number. The `paid_detected` fallback still exists but is rarely hit.
   - **`confirmBooking()` retry**: Wrapped the outer transaction in 3 retry attempts with 500ms backoff for transient DB/network failures. Added structured logging with prefix markers (`✓`, `✗`, `+`).
   - **New reconciliation API** (`/api/admin/fix-stuck-bookings`): Scans all `pending` bookings with `razorpay_order_id`, checks Razorpay order status, and confirms them if captured. Runs via admin dashboard buttons.
   - **Admin dashboard reconciliation UI**: "Fix Stuck Bookings" and "Sync Razorpay Orders" buttons with loading/result/error states.
   - **Full audit**: Traced every file in the Razorpay flow (`create-order`, `verify`, `webhook`, `status`, `recover`, `confirmBooking`). All status reference patterns consistent.
   - **Previous fixes deployed** (commit `41104c2`): 10 files — webhook `payment.failed` handler, slot selection loading state, standardized API responses, admin status badges (green/red/gray/yellow/amber), cancel/dismiss redirect fix, proper `try/catch/finally`, comprehensive console.log across entire flow.
7. **Manual booking confirmation for admin** (backup when payment is stuck pending):
   - New `POST /api/admin/manual-confirm` — admin-only, validates slot exists, assigns serial number, inserts audit log, all in a transaction
   - New `audit_log` table and `confirmed_by`/`confirmation_type`/`confirmed_at` columns in `bookings`
   - Admin booking list: "Confirm" button for pending bookings, shows "Confirmed Manually" badge (blue)
   - Admin booking detail: "Confirm Booking" card with modal dialog ("Are you sure...")
   - Existing auto-confirmation via Razorpay/webhook remains completely untouched
8. **"Paid but booking fails" hardening** (mock-gateway verified, all 35 tests pass):
   - **Amount/currency verification in `confirmBooking`** (`src/lib/razorpay.ts:~235`): rejects confirmation when the captured payment amount (paise) or currency (`INR`) doesn't match the booking amount; logs `amount_mismatch` to `payment_events` and leaves the booking pending for reconciliation (never confirm wrong amount).
   - **`fetchPayment` now returns `amount` + `currency`** (`src/lib/razorpay.ts:~71`).
   - **Callback never 500s after a successful payment** (`src/app/api/razorpay/callback/route.ts`): `confirmBooking` wrapped in try/catch; on a throw (DB contention exhausted) redirects to `/book?error=payment_detected&id=…` instead of rendering a server error page.
   - **`payment.failed` webhook can no longer revert a confirmed booking** (`src/app/api/razorpay/webhook/route.ts`): skips marking `failed` when the booking is already `confirmed` (returns `ignored_confirmed`) or already `failed`; the UPDATE is guarded with `AND payment_status != 'confirmed'`.
   - **Double-charge protection** (`src/app/api/razorpay/create-order/route.ts`): if the booking's existing Razorpay order is already `paid` (payment captured but booking not yet confirmed), returns `409 {status:'payment_already_completed'}` instead of creating a NEW order.
   - **Frontend auto-recovery** (`src/app/book/client.tsx`): the payment step now POLLS (`/api/razorpay/status` every 4s, up to 30×) instead of one-shot; on `confirmed` → `/success`. Handles `?error=payment_detected` and the 409 with a "you will NOT be charged again" message.
   - **Validation harness** `tests/payment-flow.mjs` (18 scenarios / 35 assertions, incl. T10 amount-mismatch must-not-confirm, T16 delayed-failed-must-not-revert, T18 paid-but-unconfirmed-409). Verified against a mock Razorpay SDK; mock removed before build — harness is not runnable without reinstalling `node_modules/razorpay` mock.
   - Typecheck (`tsc --noEmit`) clean; `next build` succeeded.
9. **HTTP 405 on Razorpay API routes fixed** (verified with curl; all 35 harness assertions still pass):
   - Every POST-only payment route (`/api/razorpay/create-order`, `/verify`, `/webhook`, `/recover`, and legacy `/api/payment`) now exports an `OPTIONS` handler (204 + `Allow: POST`) and an explicit `GET` handler returning JSON `{"error":"Method not allowed"}` 405. GET still cannot create/confirm anything.
   - Next.js default 405 for these routes previously rendered an HTML error page when a browser/mobile device opened them directly. All frontend calls already use the correct methods (audited: `fetch` POST/GET only; no `location.href`/`router.push` to any API route).
   - `GET /api/razorpay/callback` (307 redirect) and `GET /api/razorpay/status` remain the only browser-navigable Razorpay endpoints.
   - Re-verified identically after edits: mock harness 35/35 pass, `tsc --noEmit` clean, `next build` succeeds with the real SDK restored.
10. **ROOT CAUSE FIX — customer browser was being redirected to the API callback** (the "Allow redirect to this site?" + HTTP 405 on Android):
    - Cause: `src/app/book/client.tsx` Razorpay checkout options used `redirect: true` + `callback_url: origin + '/api/razorpay/callback'`. Hosted checkout runs on Razorpay's domain and then does a top-level navigation back to that API URL; Android Chrome shows the cross-site "Allow redirect to this site?" prompt and the customer lands on an API endpoint (405 on older POST-only builds). The `handler` is never invoked in redirect mode.
    - Fix: checkout now uses inline mode (`redirect: false`) with **no** `callback_url`. The `handler` receives `razorpay_payment_id`/`razorpay_order_id`/`razorpay_signature` and `POST`s them to `/api/razorpay/verify` (fetch, never browser navigation). On success the SPA `router.replace('/success?id=<bookingId>')`. Customer never leaves the site and never touches an API URL.
    - `/api/razorpay/callback` retained ONLY as a secure fallback: GET returns 307, POST (form-encoded or JSON) returns 303 See Other. Both verify the signature, confirm idempotently, and redirect to `/success` (or `/book?error=…`) — never render an API body, never 405.
    - `/success` is the DB-backed confirmation page: it polls `/api/bookings/[id]/status?t=<receipt_token>` while pending and only shows "Booking Confirmed" when the server says confirmed; shows Payment Verification Pending / Payment Failed with Try Again otherwise. Added `Download Ticket` (existing token-gated .docx receipt) and `Print Booking` (`window.print()` with print-only CSS).
    - Verified: mock harness 35/35 pass; live mock check POST callback → 303 → `/success`; GET callback → 307; `tsc --noEmit` clean; `next build` succeeds.
    - Deploy env: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (+ `RAZORPAY_WEBHOOK_SECRET` for webhook), existing DB vars. No `NEXT_PUBLIC_` secret.
11. **Desktop-only Razorpay "Business - Website mismatch" fix** (commit `5ee5291`):
    - Symptom: payment worked on mobile but failed on desktop with "Business - Website mismatch". Razorpay dashboard approved website = `https://www.sumantravels.online`.
    - Root cause: desktop users typing `sumantravels.online` (no `www`) in the address bar land on the apex domain. No `www`→`apex` redirect existed in the app (`next.config.ts` had no redirects, `vercel.json` did not exist, no `middleware.ts`). Razorpay checkout.js checks `window.location.origin` against the dashboard-registered website; apex origin ≠ www origin → mismatch.
    - Mobile worked because mobile users arrived via social media/WhatsApp links that include `www.sumantravels.online`.
    - Audit confirmed: zero device-detection code, no desktop/mobile branching, same code path for both. The difference was purely the browser's hostname.
    - Fix (3 parts):
      1. **`vercel.json` (new)** — CDN-edge permanent redirects: `sumantravels.online/*` → `https://www.sumantravels.online/*` and HTTP → HTTPS. Processed at Vercel's edge before the serverless function runs.
      2. **`next.config.ts`** — Added `async redirects()` with the same apex→www rule as a server-side fallback (also works in dev).
      3. **`src/app/book/client.tsx`** — Added safe diagnostic logging at payment init: `window.location.origin`, `hostname`, `protocol`, and Razorpay key mode (LIVE/TEST/UNKNOWN). No secrets logged. Helps verify the correct origin in DevTools console.
    - `tsc --noEmit` clean; `next build` succeeded.
    - **User action required**: Also add `sumantravels.online` (apex, no www) to the Razorpay Dashboard → Settings → API Keys → Approved Websites as a belt-and-suspenders measure, in case any referrer bypasses the redirect.
