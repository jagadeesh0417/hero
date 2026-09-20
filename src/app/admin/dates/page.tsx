'use client';

import { useEffect, useState, useRef } from 'react';
import LoadingButton from '@/components/ui/LoadingButton';
import { formatDateOnly, formatWeekday } from '@/lib/dates';

interface DateRecord {
  id: number;
  date: string;
  created_at: string;
}

export default function AdminDates() {
  const [dates, setDates] = useState<DateRecord[]>([]);
  const [newDate, setNewDate] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editDate, setEditDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showMessage = (msg: string) => {
    clearTimeout(messageTimer.current);
    setMessage(msg);
    messageTimer.current = setTimeout(() => setMessage(''), 3000);
  };

  const loadDates = () => {
    fetch('/api/dates')
      .then((r) => r.json())
      .then(setDates);
  };

  useEffect(() => { loadDates(); return () => clearTimeout(messageTimer.current); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDate || submitting) return;
    setSubmitting(true);

    const res = await fetch('/api/dates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: newDate }),
    });

    setSubmitting(false);
    if (res.ok) {
      setNewDate('');
      loadDates();
      showMessage('Date created successfully');
    } else {
      const err = await res.json();
      showMessage(err.error || 'Failed to create date');
    }
  };

  const handleUpdate = async (id: number) => {
    if (submitting) return;
    setSubmitting(true);

    const res = await fetch('/api/dates', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, date: editDate }),
    });

    setSubmitting(false);
    if (res.ok) {
      setEditId(null);
      setEditDate('');
      loadDates();
      showMessage('Date updated successfully');
    } else {
      showMessage('Failed to update date');
    }
  };

  const handleDelete = async (id: number) => {
    if (!id || isNaN(Number(id))) {
      showMessage('Invalid date ID');
      return;
    }
    if (!confirm('Delete all slots and pending bookings for this date? Confirmed bookings will be preserved.')) return;

    const res = await fetch(`/api/dates?id=${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadDates();
      showMessage('Date deleted successfully');
    } else {
      const err = await res.json().catch(() => ({ error: 'Failed to delete date' }));
      showMessage(err.error || 'Failed to delete date');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1e3a5f] mb-6">Manage Dates</h1>

      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          message.includes('successfully') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
        }`}>
          {message}
        </div>
      )}

      <form onSubmit={handleCreate} className="glass-card p-6 mb-6">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Add New Date
        </label>
        <div className="flex gap-3">
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            className="input-field flex-1"
            required
          />
          <LoadingButton type="submit" loading={submitting} loadingText="Adding..." variant="primary">
            Add Date
          </LoadingButton>
        </div>
        <p className="text-xs text-gray-400 mt-2">
          4 exam slots (07:30 AM, 10:30 AM, 01:00 PM, 03:30 PM) will be auto-created for this date.
        </p>
      </form>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-4 text-sm font-semibold text-gray-700">Date</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-700">Day</th>
                <th className="text-right p-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {dates.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-gray-500">
                    No dates created yet
                  </td>
                </tr>
              )}
              {dates.map((d) => (
                <tr key={d.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="p-4">
                    {editId === d.id ? (
                      <form onSubmit={(e) => { e.preventDefault(); handleUpdate(d.id); }}>
                        <input
                          type="date"
                          value={editDate}
                          onChange={(e) => setEditDate(e.target.value)}
                          className="input-field"
                          autoFocus
                        />
                      </form>
                    ) : (
                      <span className="font-medium text-gray-900">
                        {formatDateOnly(d.date, { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>
                    )}
                  </td>
                  <td className="p-4 text-gray-500">
                    {formatWeekday(d.date)}
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      {editId === d.id ? (
                        <>
                          <LoadingButton
                            onClick={() => handleUpdate(d.id)}
                            loading={submitting}
                            loadingText="Saving..."
                            variant="ghost"
                            className="bg-green-50 text-green-600 hover:bg-green-100"
                          >
                            Save
                          </LoadingButton>
                          <button
                            onClick={() => { setEditId(null); setMessage(''); }}
                            className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition-colors"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditId(d.id); setEditDate(d.date); }}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                          >
                            Edit
                          </button>
                          <LoadingButton
                            onClick={() => handleDelete(d.id)}
                            variant="ghost"
                            className="bg-red-50 text-red-600 hover:bg-red-100"
                          >
                            Delete
                          </LoadingButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
