'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { slotLabel } from '@/lib/slots';
import LoadingButton from '@/components/ui/LoadingButton';
import { formatTimestamp } from '@/lib/dates';

interface Passenger {
  name: string;
  mobile: string;
  gender: string;
}

interface BookingData {
  booking_id: string;
  serial_number?: number;
  date: string;
  time: string;
  vehicle_time?: string;
  exam_center?: string;
  passenger_count: number;
  amount: number;
  payment_status: string;
  razorpay_payment_id?: string;
  razorpay_order_id?: string;
  razorpay_status?: string;
  razorpay_method?: string;
  created_at: string;
  passengers: Passenger[];
}

export default function DownloadTicketPage() {
  const [bookingId, setBookingId] = useState('');
  const [mobile, setMobile] = useState('');
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const lookupBusyRef = useRef(false);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bookingId.trim() || !mobile.trim() || lookupBusyRef.current) return;
    lookupBusyRef.current = true;
    setLoading(true);
    setError('');
    setBooking(null);

    try {
      const res = await fetch(`/api/bookings/lookup?booking_id=${encodeURIComponent(bookingId.trim())}&mobile=${encodeURIComponent(mobile.trim())}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Booking not found' }));
        setError(err.error || 'Booking not found. Please check your Booking ID and Mobile number.');
        setLoading(false);
        lookupBusyRef.current = false;
        return;
      }
      const data = await res.json();
      setBooking(data);
    } catch {
      setError('Failed to look up booking. Please try again.');
    }
    setLoading(false);
    lookupBusyRef.current = false;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#1e3a5f]">Download Ticket</h1>
          <p className="text-gray-500 mt-2">
            Enter your Booking ID and Mobile Number to retrieve your ticket.
          </p>
        </div>

        <form onSubmit={handleLookup} className="glass-card p-6 mb-6">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Booking ID</label>
              <input
                type="text"
                value={bookingId}
                onChange={(e) => setBookingId(e.target.value)}
                className="input-field"
                placeholder="e.g. ST3A4F2B1C"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Mobile Number</label>
              <input
                type="tel"
                value={mobile}
                onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                className="input-field"
                placeholder="10-digit mobile number"
                required
              />
            </div>
            <LoadingButton
              type="submit"
              loading={loading}
              loadingText="Searching..."
              variant="primary"
              className="w-full justify-center"
            >
              Get Ticket
            </LoadingButton>
          </div>
        </form>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
            {error}
          </div>
        )}

        {booking && (
          <div className="animate-fade-in">
            <div className="glass-card p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">Booking Ticket</h2>
                <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-xs font-semibold">
                  {booking.payment_status.toUpperCase()}
                </span>
              </div>

              {booking.serial_number && (
                <div className="mb-4 p-3 bg-[#1e3a5f]/5 rounded-lg text-center">
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Ticket / Serial No</p>
                  <p className="text-2xl font-bold text-[#1e3a5f]">{booking.serial_number}</p>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Booking ID</span>
                  <span className="font-mono font-bold text-[#1e3a5f]">{booking.booking_id}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Travel Date</span>
                  <span className="font-semibold">{booking.date}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Slot</span>
                  <span className="font-semibold">{slotLabel(booking.time)}</span>
                </div>
                {booking.vehicle_time && (
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Vehicle Time</span>
                    <span className="font-semibold text-orange-600">{booking.vehicle_time}</span>
                  </div>
                )}
                {booking.exam_center && (
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Exam Center</span>
                    <span className="font-semibold text-right max-w-[250px]">{booking.exam_center}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Passengers</span>
                  <span className="font-semibold">{booking.passenger_count}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-gray-50">
                  <span className="text-gray-500">Amount Paid</span>
                  <span className="font-bold text-lg text-[#1e3a5f]">₹{booking.amount.toLocaleString('en-IN')}</span>
                </div>
                {booking.razorpay_payment_id && (
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Payment ID</span>
                    <span className="font-mono text-xs text-gray-600">{booking.razorpay_payment_id}</span>
                  </div>
                )}
                {booking.razorpay_method && (
                  <div className="flex justify-between py-2 border-b border-gray-50">
                    <span className="text-gray-500">Payment Method</span>
                    <span className="text-sm text-gray-600 capitalize">{booking.razorpay_method}</span>
                  </div>
                )}
                <div className="flex justify-between py-2">
                  <span className="text-gray-500">Booked On</span>
                  <span className="text-sm text-gray-600">
                    {formatTimestamp(booking.created_at)}
                  </span>
                </div>
              </div>
            </div>

            <div className="glass-card p-6 mb-6">
              <h3 className="font-bold text-gray-900 mb-4">Passenger Details</h3>
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

            <div className="text-center">
              <button
                onClick={() => window.print()}
                className="btn-primary justify-center mb-3"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                </svg>
                Print / Save as PDF
              </button>
              <p className="text-xs text-gray-400">
                You can re-download this ticket anytime using your Booking ID and Mobile Number.
              </p>
            </div>
          </div>
        )}

        <div className="text-center mt-6">
          <Link href="/" className="btn-outline inline-flex">
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}