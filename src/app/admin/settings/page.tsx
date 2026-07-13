'use client';

import { useEffect, useState } from 'react';

interface Settings {
  upi_id: string;
  upi_name: string;
  price_per_ticket: string;
  business_name: string;
  business_phone: string;
  business_address: string;
}

export default function AdminSettings() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setSettings);
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage('');

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
    setSaving(false);
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
      <h1 className="text-2xl font-bold text-[#1e3a5f] mb-6">Payment Settings</h1>

      <form onSubmit={(e) => { e.preventDefault(); handleSave(); }} className="glass-card p-6 mb-6">
        <h2 className="font-bold text-gray-900 mb-4">UPI Payment</h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              UPI ID
            </label>
            <input
              type="text"
              value={settings.upi_id}
              onChange={(e) => setSettings({ ...settings, upi_id: e.target.value })}
              className="input-field"
              placeholder="e.g. 9848579053@paytm"
            />
            <p className="text-xs text-gray-400 mt-1">
              This is shown on the payment page for users to pay
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              UPI Name
            </label>
            <input
              type="text"
              value={settings.upi_name}
              onChange={(e) => setSettings({ ...settings, upi_name: e.target.value })}
              className="input-field"
              placeholder="e.g. Suman Travels"
            />
            <p className="text-xs text-gray-400 mt-1">
              Payee name shown in UPI apps
            </p>
          </div>
        </div>

        <h2 className="font-bold text-gray-900 mb-4">Pricing</h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Price Per Ticket (₹)
            </label>
            <input
              type="number"
              value={settings.price_per_ticket}
              onChange={(e) => setSettings({ ...settings, price_per_ticket: e.target.value })}
              className="input-field"
              min="1"
            />
          </div>
        </div>

        <h2 className="font-bold text-gray-900 mb-4">Business Information</h2>
        <div className="grid sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Name
            </label>
            <input
              type="text"
              value={settings.business_name}
              onChange={(e) => setSettings({ ...settings, business_name: e.target.value })}
              className="input-field"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Business Address
          </label>
          <textarea
            value={settings.business_address}
            onChange={(e) => setSettings({ ...settings, business_address: e.target.value })}
            className="input-field"
            rows={3}
          />
        </div>

        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm ${
              message.includes('success')
                ? 'bg-green-50 text-green-600'
                : 'bg-red-50 text-red-600'
            }`}
          >
            {message}
          </div>
        )}

        <button
          type="submit"
          disabled={saving}
          className="btn-primary"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </div>
  );
}
