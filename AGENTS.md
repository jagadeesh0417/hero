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
