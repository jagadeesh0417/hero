'use client';

import { useEffect, useState, use, useCallback } from 'react';
import Link from 'next/link';
import { slotLabel, to12h } from '@/lib/slots';
import LoadingButton from '@/components/ui/LoadingButton';
import { formatTimestamp } from '@/lib/dates';

interface Passenger {
  name: string;
  mobile: string;
  gender: string;
}

interface BookingDetail {
  booking_id: string;
  date: string;
  time: string;
  exam_center?: string;
  vehicle_type?: string;
  vehicle_number?: string;
  vehicle_departure_time?: string;
  vehicle_arrival_time?: string;
  passenger_count: number;
  amount: number;
  payment_status: string;
  payment_id: string;
  utr_number: string;
  serial_number?: number;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  razorpay_status?: string;
  razorpay_method?: string;
  razorpay_bank_ref?: string;
  payment_timestamp?: string;
  customer_name?: string;
  customer_mobile?: string;
  customer_email?: string;
  confirmed_by?: string;
  confirmation_type?: string;
  confirmed_at?: string;
  created_at: string;
  passengers: Passenger[];
}

export default function BookingDetailPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [confirmSuccess, setConfirmSuccess] = useState<string | null>(null);

  const loadBooking = useCallback(() => {
    setRefreshing(true);
    setConfirmSuccess(null);
    setConfirmError(null);
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then(setBooking)
      .finally(() => setRefreshing(false));
  }, [bookingId]);

  useEffect(loadBooking, [loadBooking]);

  const handleManualConfirm = async () => {
    setConfirming(true);
    setConfirmError(null);
    try {
      const res = await fetch('/api/admin/manual-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'Confirmation failed');
      setConfirmSuccess(`Booking confirmed! Serial No: ${data.serial_number}`);
      setShowConfirmModal(false);
      loadBooking();
    } catch (err: any) {
      setConfirmError(err?.message || 'An error occurred');
    } finally {
      setConfirming(false);
    }
  };

  if (!booking) {
    return (
      <div className="text-center py-20">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  const isPending = booking.payment_status === 'pending';
  const isManuallyConfirmed = booking.confirmation_type === 'manual' && booking.payment_status === 'confirmed';

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/admin/bookings"
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Booking Details</h1>
        <LoadingButton
          onClick={loadBooking}
          loading={refreshing}
          loadingText="↻ Refreshing..."
          variant="ghost"
          className="ml-auto px-4 py-2 text-sm font-medium text-[#1e3a5f] bg-[#1e3a5f]/5 hover:bg-[#1e3a5f]/10"
        >
          ↻ Refresh
        </LoadingButton>
      </div>

      {confirmError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {confirmError}
        </div>
      )}

      {confirmSuccess && (
        <div className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {confirmSuccess}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="glass-card p-6">
          <h2 className="font-bold text-gray-900 mb-4">Booking Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Booking ID</span>
              <span className="font-mono font-bold text-[#1e3a5f]">{booking.booking_id}</span>
            </div>
            {booking.serial_number && (
              <div className="flex justify-between">
                <span className="text-gray-500">Serial No.</span>
                <span className="font-bold text-[#1e3a5f]">{booking.serial_number}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-semibold ${
                  booking.payment_status === 'confirmed'
                    ? isManuallyConfirmed
                      ? 'bg-blue-50 text-blue-700'
                      : 'bg-green-50 text-green-700'
                    : booking.payment_status === 'failed'
                    ? 'bg-red-50 text-red-700'
                    : booking.payment_status === 'cancelled'
                    ? 'bg-gray-50 text-gray-500'
                    : booking.payment_status === 'expired'
                    ? 'bg-yellow-50 text-yellow-700'
                    : 'bg-amber-50 text-amber-700'
                }`}
              >
                {isManuallyConfirmed ? 'Confirmed Manually' : booking.payment_status}
              </span>
            </div>
            {booking.confirmed_by && (
              <div className="flex justify-between">
                <span className="text-gray-500">Confirmed By</span>
                <span className="font-mono text-sm text-gray-600">{booking.confirmed_by}</span>
              </div>
            )}
            {booking.confirmation_type && booking.payment_status === 'confirmed' && (
              <div className="flex justify-between">
                <span className="text-gray-500">Confirmation Type</span>
                <span className="text-sm text-gray-600 capitalize">{booking.confirmation_type}</span>
              </div>
            )}
            {booking.confirmed_at && (
              <div className="flex justify-between">
                <span className="text-gray-500">Confirmed At</span>
                <span className="text-sm text-gray-600">{formatTimestamp(booking.confirmed_at)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Travel Date</span>
              <span className="font-medium">{booking.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Time</span>
              <span className="font-medium">{slotLabel(booking.time)}</span>
            </div>
            {booking.exam_center && (
              <div className="flex justify-between">
                <span className="text-gray-500">Exam Center</span>
                <span className="font-medium text-right max-w-[200px]">{booking.exam_center}</span>
              </div>
            )}
            {booking.vehicle_number && (
              <div className="border-t pt-3 mt-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Vehicle</p>
                <div className="flex justify-between">
                  <span className="text-gray-500">Type & Number</span>
                  <span className="font-medium text-right">
                    {booking.vehicle_type || '-'}{' '}
                    <span className="font-mono text-sm">({booking.vehicle_number})</span>
                  </span>
                </div>
                <div className="flex justify-between mt-2">
                  <span className="text-gray-500">Departure → Arrival</span>
                  <span className="font-medium text-orange-600">
                    {booking.vehicle_departure_time ? to12h(booking.vehicle_departure_time) : '-'}
                    {' → '}
                    {booking.vehicle_arrival_time ? to12h(booking.vehicle_arrival_time) : '-'}
                  </span>
                </div>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Passengers</span>
              <span className="font-medium">{booking.passenger_count}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Amount</span>
              <span className="font-bold text-lg text-[#1e3a5f]">
                ₹{booking.amount.toLocaleString('en-IN')}
              </span>
            </div>
            {booking.payment_id && (
              <div className="flex justify-between">
                <span className="text-gray-500">Payment ID</span>
                <span className="font-mono text-sm text-gray-600">{booking.payment_id}</span>
              </div>
            )}
            {booking.utr_number && (
              <div className="flex justify-between">
                <span className="text-gray-500">UTR Number</span>
                <span className="font-mono text-sm text-gray-600">{booking.utr_number}</span>
              </div>
            )}
            {(booking.customer_name || booking.customer_mobile) && (
              <div className="border-t pt-3 mt-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Customer</p>
                {booking.customer_name && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Name</span>
                    <span className="font-medium">{booking.customer_name}</span>
                  </div>
                )}
                {booking.customer_mobile && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Mobile</span>
                    <span className="font-mono text-sm">{booking.customer_mobile}</span>
                  </div>
                )}
                {booking.customer_email && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Email</span>
                    <span className="text-sm">{booking.customer_email}</span>
                  </div>
                )}
              </div>
            )}
            {booking.razorpay_order_id && (
              <div className="flex justify-between">
                <span className="text-gray-500">Razorpay Order</span>
                <span className="font-mono text-sm text-gray-600">{booking.razorpay_order_id}</span>
              </div>
            )}
            {booking.razorpay_payment_id && (
              <div className="flex justify-between">
                <span className="text-gray-500">Razorpay Payment ID</span>
                <span className="font-mono text-sm text-gray-600">{booking.razorpay_payment_id}</span>
              </div>
            )}
            {booking.razorpay_status && (
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Status</span>
                <span className="text-sm text-gray-600">{booking.razorpay_status}</span>
              </div>
            )}
            {booking.razorpay_method && (
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Method</span>
                <span className="text-sm text-gray-600 capitalize">{booking.razorpay_method}</span>
              </div>
            )}
            {booking.razorpay_bank_ref && (
              <div className="flex justify-between">
                <span className="text-gray-500">Bank Ref / UTR</span>
                <span className="font-mono text-sm text-gray-600">{booking.razorpay_bank_ref}</span>
              </div>
            )}
            {booking.payment_timestamp && (
              <div className="flex justify-between">
                <span className="text-gray-500">Payment Time</span>
                <span className="text-sm text-gray-600">
                    {formatTimestamp(booking.payment_timestamp)}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Booked On</span>
              <span className="text-sm text-gray-600">
                    {formatTimestamp(booking.created_at)}
              </span>
            </div>
          </div>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-bold text-gray-900 mb-4">Passenger Details</h2>
          <div className="space-y-3">
            {booking.passengers.map((p, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
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

      {isPending && (
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-gray-900">Manual Confirmation</h3>
              <p className="text-sm text-gray-500 mt-1">
                Use this only if you have verified the payment offline and the booking is stuck as Pending.
              </p>
            </div>
            <button
              onClick={() => setShowConfirmModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              Confirm Booking
            </button>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Confirm Booking</h3>
            <p className="text-sm text-gray-600 mb-4">
              Are you sure you want to manually confirm this booking? Use this only if you have already verified the payment offline.
            </p>
            {confirmError && (
              <p className="text-sm text-red-600 mb-4 bg-red-50 p-2 rounded">{confirmError}</p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowConfirmModal(false); setConfirmError(null); }}
                disabled={confirming}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              <LoadingButton
                onClick={handleManualConfirm}
                loading={confirming}
                loadingText="Confirming..."
                variant="primary"
                className="px-4 py-2"
              >
                Confirm
              </LoadingButton>
            </div>
          </div>
        </div>
      )}

      <Link href="/admin/bookings" className="btn-outline inline-flex">
        Back to Bookings
      </Link>
    </div>
  );
}