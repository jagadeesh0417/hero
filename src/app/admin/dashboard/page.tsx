'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import LoadingButton from '@/components/ui/LoadingButton';

interface Stats {
  totalBookings: number;
  totalPayments: number;
  activeSlots: number;
  revenue: number;
  pendingBookings: number;
  totalPassengers: number;
  totalDates: number;
  availableSeats: number;
  upcomingSlots: number;
  expiredSlots: number;
  examSlots: number;
  totalVehicles: number;
  vehicleCapacity: number;
  vehicleBookedSeats: number;
  vehicleAvailableSeats: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(undefined);

  const loadStats = () => {
    setRefreshing(true);
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then(setStats)
      .finally(() => setRefreshing(false));
  };

  useEffect(() => {
    loadStats();
    intervalRef.current = setInterval(loadStats, 30000);
    return () => clearInterval(intervalRef.current);
  }, []);

  const cards = [
    {
      label: 'Total Bookings',
      value: stats?.totalBookings ?? 0,
      icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2',
      color: 'bg-blue-50 text-blue-600',
    },
    {
      label: 'Revenue',
      value: `₹${(stats?.revenue ?? 0).toLocaleString('en-IN')}`,
      icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'Upcoming Slots',
      value: stats?.upcomingSlots ?? 0,
      icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-purple-50 text-purple-600',
    },
    {
      label: 'Pending Bookings',
      value: stats?.pendingBookings ?? 0,
      icon: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-amber-50 text-amber-600',
    },
    {
      label: 'Total Passengers',
      value: stats?.totalPassengers ?? 0,
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      color: 'bg-pink-50 text-pink-600',
    },
    {
      label: 'Travel Dates',
      value: stats?.totalDates ?? 0,
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      color: 'bg-teal-50 text-teal-600',
    },
    {
      label: 'Expired Slots',
      value: stats?.expiredSlots ?? 0,
      icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
      color: 'bg-red-50 text-red-600',
    },
  ];

  const examSlotCards = [
    {
      label: 'Exam Slots',
      value: stats?.examSlots ?? 0,
      icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
      color: 'bg-[#1e3a5f]/10 text-[#1e3a5f]',
    },
    {
      label: 'Active Slots',
      value: stats?.upcomingSlots ?? 0,
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-green-50 text-green-600',
    },
    {
      label: 'Vehicles',
      value: stats?.totalVehicles ?? 0,
      icon: 'M5 13l4 4L19 7',
      color: 'bg-indigo-50 text-indigo-600',
    },
    {
      label: 'Available Seats',
      value: stats?.vehicleAvailableSeats ?? 0,
      icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z',
      color: 'bg-teal-50 text-teal-600',
    },
    {
      label: 'Booked Seats',
      value: stats?.vehicleBookedSeats ?? 0,
      icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
      color: 'bg-amber-50 text-amber-600',
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-[#1e3a5f]">Dashboard</h1>
        <LoadingButton
          onClick={loadStats}
          loading={refreshing}
          loadingText="↻ Refreshing..."
          variant="ghost"
          className="px-4 py-2 text-sm font-medium text-[#1e3a5f] bg-[#1e3a5f]/5 hover:bg-[#1e3a5f]/10"
        >
          ↻ Refresh
        </LoadingButton>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className="glass-card p-5">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-xl ${card.color} flex items-center justify-center`}>
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
                </svg>
              </div>
              <div>
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className="text-2xl font-bold text-gray-900">{card.value}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="glass-card p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-gray-900">Exam Slots &amp; Vehicles</h2>
            <p className="text-sm text-gray-500 mt-0.5">Live seat availability across all configured exam slots</p>
          </div>
          <Link href="/admin/exam-slots" className="text-sm font-medium text-[#1e3a5f] hover:underline">
            Manage →
          </Link>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {examSlotCards.map((card) => (
            <div key={card.label} className="p-4 rounded-xl bg-gray-50/70">
              <div className={`w-10 h-10 rounded-lg ${card.color} flex items-center justify-center mb-3`}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={card.icon} />
                </svg>
              </div>
              <p className="text-xl font-bold text-gray-900">{card.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
        <Link
          href="/admin/dates"
          className="glass-card p-6 card-hover flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Manage Dates</h3>
            <p className="text-sm text-gray-500">Create and manage travel dates</p>
          </div>
        </Link>

        <Link
          href="/admin/slots"
          className="glass-card p-6 card-hover flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Manage Slots</h3>
            <p className="text-sm text-gray-500">Configure time slots</p>
          </div>
        </Link>

        <Link
          href="/admin/exam-slots"
          className="glass-card p-6 card-hover flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Exam Slots &amp; Vehicles</h3>
            <p className="text-sm text-gray-500">Create exam slots with vehicle timings</p>
          </div>
        </Link>

        <Link
          href="/admin/bookings"
          className="glass-card p-6 card-hover flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">View Bookings</h3>
            <p className="text-sm text-gray-500">All booking records and details</p>
          </div>
        </Link>

        <Link
          href="/admin/settings"
          className="glass-card p-6 card-hover flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Settings</h3>
            <p className="text-sm text-gray-500">Payment and expiry configuration</p>
          </div>
        </Link>
      </div>

      <div className="glass-card p-6 mb-4">
        <h2 className="font-bold text-gray-900 mb-4">Payment Reconciliation</h2>
        <p className="text-sm text-gray-500 mb-4">
          Fix bookings that were paid via Razorpay but stuck as Pending in the database.
          This checks each pending booking's Razorpay order and confirms it if payment was captured.
        </p>
        <div className="flex flex-wrap gap-3">
          <ReconcileButton
            label="Fix Stuck Bookings"
            url="/api/admin/fix-stuck-bookings"
            successMsg={({ repaired, scanned }) =>
              `${repaired} repaired out of ${scanned} scanned`
            }
          />
          <ReconcileButton
            label="Sync Razorpay Orders"
            url="/api/admin/reconcile"
            successMsg={({ repaired, scanned }) =>
              `${repaired} repaired, ${scanned} scanned`
            }
          />
        </div>
      </div>
    </div>
  );
}

function ReconcileButton({
  label,
  url,
  successMsg,
}: {
  label: string;
  url: string;
  successMsg: (data: any) => string;
}) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.detail || 'Request failed');
      setResult(successMsg(data));
      console.log(`[Reconcile] ${label}:`, data);
    } catch (err: any) {
      setError(err?.message || 'An error occurred');
      console.error(`[Reconcile] ${label} error:`, err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <LoadingButton onClick={handleClick} loading={loading} loadingText="Processing..." variant="primary">
        {label}
      </LoadingButton>
      {result && <p className="text-sm text-green-600 mt-2">{result}</p>}
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
    </div>
  );
}
