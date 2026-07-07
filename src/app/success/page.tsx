'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { slotLabel, to12h } from '@/lib/slots';

interface BookingData {
  booking_id: string;
  payment_status: string;
  payment_id: string;
  date: string;
  time: string;
  vehicle_time?: string;
  exam_center?: string;
  passenger_count: number;
  amount: number;
  passengers: {
    name: string;
    mobile: string;
    gender: string;
  }[];
}

export default function SuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ id: string }>;
}) {
  const { id } = use(searchParams);
  const [booking, setBooking] = useState<BookingData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetch(`/api/bookings/${id}`)
        .then((r) => r.json())
        .then((data) => {
          setBooking(data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [id]);

  const handleDownload = async () => {
    try {
      const res = await fetch(`/api/documents?download=${id}`);
      if (!res.ok) throw new Error('Document not found');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${id}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Document not available yet. Please try again shortly.');
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

  if (!booking) {
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

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-2xl mx-auto px-4">
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
            Booking Successful!
          </h1>
          <p className="text-gray-500 mt-2">
            Your booking has been confirmed and receipt is ready.
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
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-gray-500">Payment Status</span>
              <span className="px-3 py-1 bg-green-50 text-green-600 rounded-full text-sm font-semibold">
                {booking.payment_status.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-gray-500">Travel Date</span>
              <span className="font-semibold">{booking.date}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-50">
              <span className="text-gray-500">Exam Time</span>
              <span className="font-semibold">{slotLabel(booking.time)}</span>
            </div>
            {booking.vehicle_time && (
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

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={handleDownload} className="btn-primary justify-center">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Download Receipt
          </button>
          <Link href="/" className="btn-outline justify-center">
            Return Home
          </Link>
        </div>
      </div>
    </div>
  );
}
