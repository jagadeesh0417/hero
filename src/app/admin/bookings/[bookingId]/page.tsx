'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { slotLabel } from '@/lib/slots';

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
  passenger_count: number;
  amount: number;
  payment_status: string;
  payment_id: string;
  utr_number: string;
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

  useEffect(() => {
    fetch(`/api/bookings/${bookingId}`)
      .then((r) => r.json())
      .then(setBooking);
  }, [bookingId]);

  if (!booking) {
    return (
      <div className="text-center py-20">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

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
      </div>

      <div className="grid md:grid-cols-2 gap-6 mb-6">
        <div className="glass-card p-6">
          <h2 className="font-bold text-gray-900 mb-4">Booking Information</h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500">Booking ID</span>
              <span className="font-mono font-bold text-[#1e3a5f]">{booking.booking_id}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Status</span>
              <span
                className={`px-3 py-0.5 rounded-full text-xs font-semibold ${
                  booking.payment_status === 'confirmed'
                    ? 'bg-green-50 text-green-600'
                    : 'bg-amber-50 text-amber-600'
                }`}
              >
                {booking.payment_status}
              </span>
            </div>
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
            <div className="flex justify-between">
              <span className="text-gray-500">Booked On</span>
              <span className="text-sm text-gray-600">
                {new Date(booking.created_at).toLocaleString('en-IN')}
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

      <Link href="/admin/bookings" className="btn-outline inline-flex">
        Back to Bookings
      </Link>
    </div>
  );
}
