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
5. **BharatPe payment gateway integration** (partial — API routes done, booking page updated):
   - `src/lib/bharatpe.ts` — `createPaymentOrder()`, `verifyPayment()`, `verifyWebhookSignature()`
   - `POST /api/bharatpe/create-order` — Creates order, returns payment URL for redirect
   - `GET /api/bharatpe/callback` — Handles redirect from BharatPe, updates booking, redirects to success/failure
   - `POST /api/bharatpe/webhook` — Server-side payment status update via webhook
   - Book page: Replaced `StepUPIPayment` (QR + UTR) with `StepBharatPePayment` (redirect + retry)
   - Admin booking detail: Shows BharatPe order ID, txn ID, payment timestamp
   - DB migration: `bharatpe_order_id`, `bharatpe_txn_id`, `payment_timestamp` columns in `bookings`
   - All commits pushed to GitHub; Vercel auto-deploys

### Remaining (BharatPe)
- Configure `BHARATPE_API_KEY`, `BHARATPE_API_SECRET`, `BHARATPE_MERCHANT_ID`, `BHARATPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_BASE_URL` in Vercel env vars
- Test end-to-end flow on production after env vars set
