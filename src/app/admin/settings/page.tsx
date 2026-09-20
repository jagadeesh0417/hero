'use client';

import { useEffect, useState, useRef } from 'react';
import LoadingButton from '@/components/ui/LoadingButton';

interface Settings {
  upi_id: string;
  upi_name: string;
  price_per_ticket: string;
  business_name: string;
  business_phone: string;
  business_address: string;
  slot_expiry_days: string;
}

const EXPIRY_OPTIONS = [
  { label: '1 Day', value: '1' },
  { label: '2 Days', value: '2' },
  { label: '3 Days (Default)', value: '3' },
  { label: '5 Days', value: '5' },
  { label: '7 Days', value: '7' },
  { label: 'Never Delete', value: '0' },
];

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const busyRef = useRef(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setSettings);
  }, []);

  const handleSave = async () => {
    if (!settings || busyRef.current) return;
    busyRef.current = true;
    setSaving(true);
    setMessage('');

    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (res.ok) {
        setMessage('Settings saved successfully');
      } else {
        setMessage('Failed to save settings');
      }
    } catch {
      setMessage('Failed to save settings');
    }
    setSaving(false);
    busyRef.current = false;
    setTimeout(() => setMessage(''), 3000);
  };

  if (!settings) {
    return (
      <div className="text-center py-20">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1e3a5f] mb-6">Settings</h1>

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="glass-card p-6 mb-6">
        <h2 className="font-bold text-gray-900 mb-4">UPI Payment</h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID</label>
            <input
              type="text"
              value={settings.upi_id}
              onChange={(e) => setSettings({ ...settings, upi_id: e.target.value })}
              className="input-field"
              placeholder="e.g. 9848579053@paytm"
            />
            <p className="text-xs text-gray-400 mt-1">This is shown on the payment page for users to pay</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">UPI Name</label>
            <input
              type="text"
              value={settings.upi_name}
              onChange={(e) => setSettings({ ...settings, upi_name: e.target.value })}
              className="input-field"
              placeholder="e.g. Suman Travels"
            />
            <p className="text-xs text-gray-400 mt-1">Payee name shown in UPI apps</p>
          </div>
        </div>

        <h2 className="font-bold text-gray-900 mb-4">Pricing</h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Price Per Ticket (₹)</label>
            <input
              type="number"
              value={settings.price_per_ticket}
              onChange={(e) => setSettings({ ...settings, price_per_ticket: e.target.value })}
              className="input-field"
              min="1"
            />
          </div>
        </div>

        <h2 className="font-bold text-gray-900 mb-4">Auto Delete Expired Slots</h2>
        <p className="text-sm text-gray-500 mb-4">
          Slots will automatically expire and be hidden from users after the selected number of days from the exam date.
          Expired slots are archived to history for reporting.
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {EXPIRY_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setSettings({ ...settings, slot_expiry_days: opt.value })}
              className={`px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                settings.slot_expiry_days === opt.value
                  ? 'border-[#1e3a5f] bg-[#1e3a5f]/5 text-[#1e3a5f]'
                  : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <h2 className="font-bold text-gray-900 mb-4">Business Information</h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
            <input
              type="text"
              value={settings.business_name}
              onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <input
              type="text"
              value={settings.business_phone}
              onChange={(e) => setSettings({ ...settings, business_phone: e.target.value })}
              className="input-field"
              placeholder="+91 9010532226"
            />
          </div>
        </div>
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Business Address</label>
          <textarea
            value={settings.business_address}
            onChange={(e) => setSettings({ ...settings, business_address: e.target.value })}
            className="input-field"
            rows={3}
          />
        </div>

        {message && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${message.includes('success') ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
            {message}
          </div>
        )}

        <LoadingButton type="submit" loading={saving} loadingText="Saving..." variant="primary">
          Save Settings
        </LoadingButton>
      </form>
    </div>
  );
}
