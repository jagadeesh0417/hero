'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Stats {
  totalBookings: number;
  totalPayments: number;
  activeSlots: number;
  revenue: number;
  pendingBookings: number;
  totalPassengers: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch('/api/admin/stats')
      .then((r) => r.json())
      .then(setStats);
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
      label: 'Active Slots',
      value: stats?.activeSlots ?? 0,
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
      label: 'Total Payments',
      value: `₹${(stats?.totalPayments ?? 0).toLocaleString('en-IN')}`,
      icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
      color: 'bg-teal-50 text-teal-600',
    },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1e3a5f] mb-6">Dashboard</h1>

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

      <div className="grid sm:grid-cols-2 gap-4">
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
          href="/admin/documents"
          className="glass-card p-6 card-hover flex items-center gap-4"
        >
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="font-bold text-gray-900">Documents</h3>
            <p className="text-sm text-gray-500">Download booking receipts</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
