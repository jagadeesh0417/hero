'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { slotLabel, to12h } from '@/lib/slots';
import LoadingButton from '@/components/ui/LoadingButton';

interface BookingData {
  booking_id: string;
  payment_status: string;
  payment_id: string;
  serial_number?: number;
  date: string;
  time: string;
  vehicle_time?: string;
  exam_center?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  vehicle_departure_time?: string;
  vehicle_arrival_time?: string;
  passenger_count: number;
  amount: number;
  receipt_token?: string;
  customer_name?: string;
  customer_mobile?: string;
  razorpay_payment_id?: string;
  passengers: {
    name: string;
    mobile: string;
    gender: string;
  }[];
}

const TERMINAL_FAILURE_STATES = ['failed', 'cancelled', 'expired'] as const;

export default function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ id: string }>;
}) {
  const { id } = use(searchParams);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  // Verification state from the token-gated status endpoint, so this page never
  // claims a booking is confirmed unless the server actually says so.
  const [verifyStatus, setVerifyStatus] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [notFound, setNotFound] = useState(false);

  // Load the booking from the database.
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`/api/bookings/${id}`)
      .then((r) => {
        if (!r.ok) throw new Error('Not found');
        return r.json();
      })
      .then((data) => {
        console.log(`[Success] Loaded booking ${id}: status=${data.payment_status}`);
        setBooking(data);
        setVerifyStatus(data.payment_status);
      })
      .catch((err) => {
        console.error(`[Success] Failed to load booking ${id}:`, err?.message || err);
        setNotFound(true);
      })
      .finally(() => setLoading(false));
  }, [id]);

  // Poll the server status while the payment is still being finalised. This
  // covers a refresh / slow verification / lost browser response after a
  // successful payment: the server actively confirms paid bookings, and this
  // page flips to CONFIRMED the moment the database says so.
  useEffect(() => {
    const bid = booking?.booking_id;
    const token = booking?.receipt_token;
    if (!bid || !token) return;
    if (booking.payment_status === 'confirmed') return;
    if (TERMINAL_FAILURE_STATES.includes(booking.payment_status as any)) return;

    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setInterval> | undefined;

    const check = async () => {
      try {
        const res = await fetch(`/api/bookings/${bid}/status?t=${token}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;

        if (data.status === 'confirmed') {
          setVerifyStatus('confirmed');
          // Refresh the booking details now that it is confirmed.
          const updated = await fetch(`/api/bookings/${bid}`).then((r) => (r.ok ? r.json() : null));
          if (updated && !cancelled) setBooking(updated);
        } else if (TERMINAL_FAILURE_STATES.includes(data.status)) {
          setVerifyStatus(data.status);
          setStatusMessage(data.message || '');
        } else {
          attempts += 1;
          if (attempts >= 30) {
            if (timer) clearInterval(timer);
            setStatusMessage('Your payment was successful. We are still confirming your booking — please wait a moment or contact support with your Booking ID. You will not be charged again.');
          }
        }
      } catch {
        // keep polling
      }
    };

    check();
    timer = setInterval(check, 4000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [booking?.booking_id, booking?.receipt_token, booking?.payment_status]);

  const handleDownload = async () => {
    if (!booking || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/bookings/${booking.booking_id}/receipt?t=${booking.receipt_token}`);
      if (res.status === 409) {
        setDownloading(false);
        return;
      }
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Ticket-${booking.booking_id}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Could not download ticket. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-10 h-10 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 mt-4">Loading booking details...</p>
        </div>
      </div>
    );
  }

  if (notFound || !booking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500">Booking not found</p>
          <Link href="/" className="btn-primary mt-4 inline-flex">
            Return Home
          </Link>
        </div>
      </div>
    );
  }

  const state = verifyStatus || booking.payment_status;
  const isConfirmed = state === 'confirmed';
  const isPending = !isConfirmed && !TERMINAL_FAILURE_STATES.includes(state as any);
  const printStyles = `@media print {
  body * { visibility: hidden; }
  .print-area, .print-area * { visibility: visible; }
  .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 16px; }
  .no-print { display: none !important; }
}`;

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-2xl mx-auto px-4">
        {isPending && (
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4">
              <div className="w-10 h-10 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto" />
            </div>
            <h1 className="text-2xl font-bold text-[#1e3a5f]">
              Payment Verification Pending
            </h1>
            <p className="text-gray-500 mt-3">
              {state === 'paid_detected'
                ? 'Payment received! Finalizing your booking...'
                : statusMessage || 'Your payment is being verified. Please wait a moment.'}
            </p>
            <p className="text-xs text-gray-400 mt-4">
              Booking ID: <span className="font-mono font-medium">{booking.booking_id}</span>
            </p>
          </div>
        )}

        {!isConfirmed && TERMINAL_FAILURE_STATES.includes(state as any) && (
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-red-50 flex items-center justify-center">
              <svg className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={state === 'cancelled' ? 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z' : state === 'expired' ? 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' : 'M6 18L18 6M6 6l12 12'} />
              </svg>
            </div>
            <h1 className="text-3xl font-bold text-red-600">
              {state === 'cancelled' ? 'Payment Cancelled' : state === 'expired' ? 'Payment Session Expired' : 'Payment Failed'}
            </h1>
            <p className="text-gray-500 mt-2">
              {statusMessage || 'Your payment was not completed. No charges were made.'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
              <Link href={`/book?id=${encodeURIComponent(booking.booking_id)}`} className="btn-primary justify-center">
                Try Again
              </Link>
              <Link href="/book" className="btn-outline justify-center">
                Return to Booking
              </Link>
            </div>
            <p className="text-sm text-gray-400 mt-6">
              If money was deducted, call{' '}
              <a href="tel:+919010532226" className="text-[#1e3a5f] font-medium">+91 9010532226</a>{' '}
              and we will reconcile it.
            </p>
          </div>
        )}

        {isConfirmed && (
          <>
            <style>{printStyles}</style>
            <div className="print-area">
              <div className="text-center mb-8 animate-fade-in">
                <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-green-50 flex items-center justify-center">
                  <svg
                    className="w-10 h-10 text-green-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h1 className="text-3xl font-bold text-[#1e3a5f]">
                  Booking Confirmed
                </h1>
                <p className="text-gray-500 mt-2">
                  Payment Successful — your ticket is ready.
                </p>
              </div>

              <div className="glass-card p-6 sm:p-8 mb-6 animate-fade-in">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Booking Details
                </h2>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500">Booking ID</span>
                    <span className="font-mono font-bold text-[#1e3a5f]">
                      {booking.booking_id}
                    </span>
                  </div>
                  {booking.serial_number && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-500">Ticket / Serial No.</span>
                      <span className="font-bold text-[#1e3a5f]">
                        {booking.serial_number}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500">Booking Status</span>
                    <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-sm font-semibold">
                      CONFIRMED
                    </span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500">Payment Status</span>
                    <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-sm font-semibold">
                      PAID
                    </span>
                  </div>
                  {booking.customer_name && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-500">Customer</span>
                      <span className="font-semibold">{booking.customer_name}</span>
                    </div>
                  )}
                  {booking.customer_mobile && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-500">Mobile</span>
                      <span className="font-semibold">{booking.customer_mobile}</span>
                    </div>
                  )}
                  {booking.razorpay_payment_id && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-500">Razorpay Payment ID</span>
                      <span className="font-mono text-xs text-gray-600 break-all text-right">
                        {booking.razorpay_payment_id}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500">Travel Date</span>
                    <span className="font-semibold">{booking.date}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500">Exam Time</span>
                    <span className="font-semibold">{slotLabel(booking.time)}</span>
                  </div>
                  {booking.vehicle_type && booking.vehicle_number ? (
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-500">Vehicle</span>
                      <span className="font-semibold text-right">
                        {booking.vehicle_type} ({booking.vehicle_number})
                        {(booking.vehicle_departure_time || booking.vehicle_arrival_time) && (
                          <span className="block text-xs font-medium text-orange-600">
                            {booking.vehicle_departure_time ? to12h(booking.vehicle_departure_time) : ''}
                            {booking.vehicle_departure_time && booking.vehicle_arrival_time ? ' → ' : ''}
                            {booking.vehicle_arrival_time ? to12h(booking.vehicle_arrival_time) : ''}
                          </span>
                        )}
                      </span>
                    </div>
                  ) : booking.vehicle_time && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-500">Vehicle</span>
                      <span className="font-semibold text-orange-600">{to12h(booking.vehicle_time)}</span>
                    </div>
                  )}
                  {booking.exam_center && (
                    <div className="flex justify-between items-center py-2 border-b border-gray-50">
                      <span className="text-gray-500">Exam Center</span>
                      <span className="font-semibold">{booking.exam_center}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center py-2 border-b border-gray-50">
                    <span className="text-gray-500">Tickets</span>
                    <span className="font-semibold">{booking.passenger_count}</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-gray-700 font-bold">Amount Paid</span>
                    <span className="text-xl font-bold text-[#1e3a5f]">
                      ₹{booking.amount.toLocaleString('en-IN')}
                    </span>
                  </div>
                </div>
              </div>

              <div className="glass-card p-6 sm:p-8 mb-8 animate-fade-in">
                <h2 className="text-lg font-bold text-gray-900 mb-4">
                  Passenger Details
                </h2>
                <div className="space-y-3">
                  {booking.passengers.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-7 h-7 rounded-full bg-[#1e3a5f]/10 flex items-center justify-center text-xs font-bold text-[#1e3a5f]">
                          {i + 1}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{p.name}</p>
                          <p className="text-sm text-gray-500">{p.mobile}</p>
                        </div>
                      </div>
                      <span className="text-sm text-gray-500">{p.gender}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center no-print">
              {booking?.receipt_token && (
                <LoadingButton
                  onClick={handleDownload}
                  loading={downloading}
                  loadingText="Downloading..."
                  variant="primary"
                  className="justify-center"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.293.707l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Download Ticket
                </LoadingButton>
              )}
              <button
                onClick={() => window.print()}
                className="btn-primary justify-center"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print Booking
              </button>
              <Link href="/download-ticket" className="btn-outline justify-center">
                Lost Ticket? Re-download
              </Link>
              <Link href="/" className="btn-outline justify-center">
                Return Home
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}