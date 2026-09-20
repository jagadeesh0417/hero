'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { slotLabel } from '@/lib/slots';
import { formatDateOnly, formatShortTimestamp } from '@/lib/dates';

interface BookingRecord {
  booking_id: string;
  serial_number?: number;
  customer_name_ext?: string;
  customer_mobile_ext?: string;
  customer_name?: string;
  customer_mobile?: string;
  gender?: string;
  customer_email?: string;
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
  confirmed_by?: string;
  confirmation_type?: string;
  confirmed_at?: string;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_bank_ref?: string;
  utr_number?: string;
  created_at: string;
}

export default function AdminBookings() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Debounce the search box so a request isn't fired on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const loadBookings = useCallback(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set('search', debouncedSearch);
    if (statusFilter) params.set('status', statusFilter);
    fetch(`/api/bookings?${params.toString()}`)
      .then((r) => r.json())
      .then(setBookings);
  }, [debouncedSearch, statusFilter]);

  useEffect(loadBookings, [loadBookings]);

  const handleManualConfirm = async (bookingId: string) => {
    setConfirmingId(bookingId);
    setConfirmError(null);
    try {
      const res = await fetch('/api/admin/manual-confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'Confirmation failed');
      loadBookings();
    } catch (err: any) {
      setConfirmError(err?.message || 'An error occurred');
      console.error(`[Admin] Manual confirm error:`, err);
    } finally {
      setConfirmingId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Bookings</h1>
        <div className="flex gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by Sl No, ID, Name, Mobile, Date..."
            className="input-field max-w-xs"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="select-field max-w-[160px]"
          >
            <option value="">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="cancelled">Cancelled</option>
            <option value="expired">Expired</option>
          </select>
        </div>
      </div>

      {confirmError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {confirmError}
        </div>
      )}

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Sl No</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Booking ID</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Candidate Name</th>
                <th className="text-center p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Gender</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Mobile</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Email</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Exam Date</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Slot</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Vehicle</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Exam Center</th>
                <th className="text-center p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Tickets</th>
                <th className="text-center p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Status</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Razorpay Payment ID</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Razorpay Order ID</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">UTR / Bank Ref</th>
                <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Booking Time</th>
                <th className="text-right p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Action</th>
              </tr>
            </thead>
            <tbody>
              {bookings.length === 0 && (
                <tr>
                  <td colSpan={17} className="p-8 text-center text-gray-500">
                    No bookings found
                  </td>
                </tr>
              )}
              {bookings.map((b) => {
                const name = b.customer_name_ext || b.customer_name || '';
                const mobile = b.customer_mobile_ext || b.customer_mobile || '';
                const isManuallyConfirmed = b.confirmation_type === 'manual' && b.payment_status === 'confirmed';
                return (
                  <tr key={b.booking_id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                    <td className="p-3 whitespace-nowrap">
                      <span className="font-mono text-sm font-medium text-[#1e3a5f]">
                        {b.serial_number || '-'}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      <span className="font-mono text-xs text-gray-700">{b.booking_id}</span>
                    </td>
                    <td className="p-3 whitespace-nowrap text-sm text-gray-900">{name || '-'}</td>
                    <td className="p-3 whitespace-nowrap text-sm text-center text-gray-600">{b.gender || '-'}</td>
                    <td className="p-3 whitespace-nowrap font-mono text-sm text-gray-600">{mobile || '-'}</td>
                    <td className="p-3 whitespace-nowrap text-sm text-gray-600">{b.customer_email || '-'}</td>
                    <td className="p-3 whitespace-nowrap text-sm text-gray-900">
                      {formatDateOnly(b.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="p-3 whitespace-nowrap text-sm text-gray-700">{slotLabel(b.time)}</td>
                    <td className="p-3 whitespace-nowrap text-sm text-gray-700">
                      {b.vehicle_number ? (
                        <span title={b.vehicle_departure_time ? `Departs ${b.vehicle_departure_time}` : b.vehicle_type}>
                          {b.vehicle_type ? `${b.vehicle_type} · ` : ''}
                          <span className="font-mono text-xs">{b.vehicle_number}</span>
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3 whitespace-nowrap text-sm text-gray-600 max-w-[180px] truncate" title={b.exam_center || ''}>
                      {b.exam_center || '-'}
                    </td>
                    <td className="p-3 whitespace-nowrap text-sm text-center font-medium">{b.passenger_count}</td>
                    <td className="p-3 whitespace-nowrap text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          b.payment_status === 'confirmed'
                            ? isManuallyConfirmed
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-green-50 text-green-700'
                            : b.payment_status === 'failed'
                            ? 'bg-red-50 text-red-700'
                            : b.payment_status === 'cancelled'
                            ? 'bg-gray-50 text-gray-500'
                            : b.payment_status === 'expired'
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-amber-50 text-amber-700'
                        }`}
                      >
                        {isManuallyConfirmed ? 'Confirmed Manually' : b.payment_status}
                      </span>
                    </td>
                    <td className="p-3 whitespace-nowrap font-mono text-xs text-gray-500 max-w-[120px] truncate" title={b.razorpay_payment_id || ''}>
                      {b.razorpay_payment_id || '-'}
                    </td>
                    <td className="p-3 whitespace-nowrap font-mono text-xs text-gray-500 max-w-[120px] truncate" title={b.razorpay_order_id || ''}>
                      {b.razorpay_order_id || '-'}
                    </td>
                    <td className="p-3 whitespace-nowrap font-mono text-xs text-gray-500 max-w-[120px] truncate" title={b.razorpay_bank_ref || ''}>
                      {b.razorpay_bank_ref || b.utr_number || '-'}
                    </td>
                    <td className="p-3 whitespace-nowrap text-xs text-gray-500">
                      {formatShortTimestamp(b.created_at)}
                    </td>
                    <td className="p-3 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <Link
                          href={`/admin/bookings/${b.booking_id}`}
                          className="px-3 py-1.5 bg-[#1e3a5f]/5 text-[#1e3a5f] rounded-lg text-sm font-medium hover:bg-[#1e3a5f]/10 transition-colors"
                        >
                          View
                        </Link>
                        {b.payment_status === 'pending' && (
                          <button
                            onClick={() => handleManualConfirm(b.booking_id)}
                            disabled={confirmingId === b.booking_id}
                            className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                          >
                            {confirmingId === b.booking_id ? '...' : 'Confirm'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}