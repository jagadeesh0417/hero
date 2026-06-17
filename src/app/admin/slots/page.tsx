'use client';

import { useEffect, useState } from 'react';

interface DateRecord {
  id: number;
  date: string;
}

interface SlotRecord {
  id: number;
  date_id: number;
  time: string;
  enabled: number;
  date?: string;
}

export default function AdminSlots() {
  const [slots, setSlots] = useState<SlotRecord[]>([]);
  const [dates, setDates] = useState<DateRecord[]>([]);
  const [selectedDateId, setSelectedDateId] = useState('');
  const [newTime, setNewTime] = useState('');
  const [editId, setEditId] = useState<number | null>(null);
  const [editTime, setEditTime] = useState('');

  const loadData = () => {
    fetch('/api/slots')
      .then((r) => r.json())
      .then(setSlots);
    fetch('/api/dates')
      .then((r) => r.json())
      .then(setDates);
  };

  useEffect(loadData, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDateId || !newTime) return;

    const res = await fetch('/api/slots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date_id: Number(selectedDateId),
        time: newTime,
      }),
    });

    if (res.ok) {
      setNewTime('');
      loadData();
    } else {
      const err = await res.json();
      alert(err.error || 'Failed to create slot');
    }
  };

  const handleUpdate = async (id: number) => {
    const res = await fetch('/api/slots', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id,
        time: editTime,
      }),
    });

    if (res.ok) {
      setEditId(null);
      loadData();
    }
  };

  const handleToggle = async (id: number, current: number) => {
    const res = await fetch('/api/slots', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled: current ? 0 : 1 }),
    });

    if (res.ok) loadData();
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this slot?')) return;
    const res = await fetch(`/api/slots?id=${id}`, { method: 'DELETE' });
    if (res.ok) loadData();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1e3a5f] mb-6">Manage Slots</h1>

      <form onSubmit={handleCreate} className="glass-card p-6 mb-6">
        <h2 className="font-bold text-gray-900 mb-4">Create New Slot</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
            <select
              value={selectedDateId}
              onChange={(e) => setSelectedDateId(e.target.value)}
              className="select-field"
              required
            >
              <option value="">Select date</option>
              {dates.map((d) => (
                <option key={d.id} value={d.id}>
                  {new Date(d.date).toLocaleDateString('en-IN', {
                    weekday: 'short',
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                  })}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
            <input
              type="time"
              value={newTime}
              onChange={(e) => setNewTime(e.target.value)}
              className="input-field"
              required
            />
          </div>
        </div>
        <button type="submit" className="btn-primary mt-4">
          Create Slot
        </button>
      </form>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left p-4 text-sm font-semibold text-gray-700">Date</th>
                <th className="text-left p-4 text-sm font-semibold text-gray-700">Time</th>
                <th className="text-center p-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-right p-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {slots.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-8 text-center text-gray-500">
                    No slots created yet
                  </td>
                </tr>
              )}
              {slots.map((s) => (
                <tr key={s.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                  <td className="p-4">
                    <span className="text-gray-900">
                      {s.date
                        ? new Date(s.date).toLocaleDateString('en-IN', {
                            weekday: 'short',
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '-'}
                    </span>
                  </td>
                  <td className="p-4">
                    {editId === s.id ? (
                      <input
                        type="time"
                        value={editTime}
                        onChange={(e) => setEditTime(e.target.value)}
                        className="input-field"
                      />
                    ) : (
                      <span className="font-medium text-gray-900">{s.time}</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleToggle(s.id, s.enabled)}
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        s.enabled
                          ? 'bg-green-50 text-green-600'
                          : 'bg-red-50 text-red-600'
                      }`}
                    >
                      {s.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </td>
                  <td className="p-4">
                    <div className="flex justify-end gap-2">
                      {editId === s.id ? (
                        <>
                          <button
                            onClick={() => handleUpdate(s.id)}
                            className="px-3 py-1.5 bg-green-50 text-green-600 rounded-lg text-sm font-medium hover:bg-green-100"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditId(null)}
                            className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => { setEditId(s.id); setEditTime(s.time); }}
                            className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(s.id)}
                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100"
                          >
                            Delete
                          </button>
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
