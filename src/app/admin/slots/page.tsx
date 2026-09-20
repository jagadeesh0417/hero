'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { EXAM_TIMINGS } from '@/lib/slots';
import LoadingButton from '@/components/ui/LoadingButton';
import { formatDateOnly } from '@/lib/dates';

interface SlotRecord {
  id: number;
  date_id: number;
  time: string;
  enabled: number;
  vehicle_time: string;
  date?: string;
}

export default function AdminSlots() {
  const [slots, setSlots] = useState<SlotRecord[]>([]);
  const [vehicleTimes, setVehicleTimes] = useState<Record<number, string>>({});
  const [generating, setGenerating] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState<Record<number, boolean>>({});
  const [message, setMessage] = useState('');
  const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showMessage = (msg: string) => {
    clearTimeout(messageTimer.current);
    setMessage(msg);
    messageTimer.current = setTimeout(() => setMessage(''), 3000);
  };

  const loadData = useCallback(() => {
    fetch('/api/slots')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch slots');
        return r.json();
      })
      .then((data: SlotRecord[]) => {
        setSlots(data);
        const map: Record<number, string> = {};
        data.forEach((s) => { map[s.id] = s.vehicle_time || ''; });
        setVehicleTimes(map);
      })
      .catch((err) => {
        console.error('[AdminSlots] loadData error:', err?.message || err);
        showMessage('Failed to load slots. Check connection.');
      });
  }, []);

  useEffect(() => { loadData(); return () => clearTimeout(messageTimer.current); }, [loadData]);

  const handleToggle = async (id: number, current: number) => {
    try {
      const res = await fetch('/api/slots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled: current ? 0 : 1 }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      loadData();
      showMessage(current ? 'Slot disabled' : 'Slot enabled');
    } catch (err: any) {
      showMessage('Error: ' + (err?.message || 'Toggle failed'));
    }
  };

  const handleVehicleTimeSave = async (id: number) => {
    if (savingVehicle[id]) return;
    setSavingVehicle((prev) => ({ ...prev, [id]: true }));
    try {
      const res = await fetch('/api/slots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, vehicle_time: vehicleTimes[id] || '' }),
      });
      if (!res.ok) throw new Error('Save failed');
      loadData();
      showMessage('Vehicle time saved');
    } catch (err: any) {
      showMessage('Error: ' + (err?.message || 'Save failed'));
    }
    setSavingVehicle((prev) => ({ ...prev, [id]: false }));
  };

  const grouped = slots.reduce((acc, s) => {
    const key = s.date || String(s.date_id);
    if (!acc[key]) acc[key] = { date: s.date, date_id: s.date_id, slots: [] };
    acc[key].slots.push(s);
    return acc;
  }, {} as Record<string, { date?: string; date_id: number; slots: SlotRecord[] }>);

  const sorted = Object.values(grouped).sort((a, b) =>
    (a.date || '').localeCompare(b.date || '')
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-[#1e3a5f] mb-2">Exam Slots</h1>
      <p className="text-gray-500 mb-6">
        Fixed exam timings — slots are automatically created when you add a date.
        Set the vehicle start time for each slot.
      </p>

      {message && (
        <div className="mb-4 p-3 rounded-lg text-sm font-medium bg-green-50 text-green-700">
          {message}
        </div>
      )}

      <LoadingButton
        onClick={async () => {
          setGenerating(true);
          try {
            const res = await fetch('/api/slots/generate-missing', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Generation failed');
            showMessage(data.message || `Slots generated successfully`);
            loadData();
          } catch (err: any) {
            showMessage('Error: ' + (err?.message || 'Failed to generate slots'));
          }
          setGenerating(false);
        }}
        loading={generating}
        loadingText="Generating..."
        variant="primary"
        className="mb-6"
      >
        Generate Missing Slots for All Dates
      </LoadingButton>

      {sorted.length === 0 && !generating && (
        <div className="glass-card p-12 text-center">
          <p className="text-gray-500">No dates created yet. Add a date from the Dates page to auto-create slots.</p>
        </div>
      )}

      {sorted.map((group) => (
        <div key={group.date_id} className="glass-card mb-4 overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 border-b border-gray-100">
            <h2 className="font-bold text-[#1e3a5f]">
              {group.date
                ? formatDateOnly(group.date, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })
                : `Date #${group.date_id}`}
            </h2>
          </div>
          <div className="p-4 space-y-2">
            {EXAM_TIMINGS.map((timing) => {
              const slot = group.slots.find((s) => s.time === timing.value);
              return (
                <div
                  key={timing.value}
                  className="flex items-center gap-4 py-3 px-4 rounded-lg hover:bg-gray-50 transition-colors flex-wrap"
                >
                  <div className="flex items-center gap-3 min-w-[180px]">
                    <span className="text-sm font-medium text-gray-500 w-16">
                      {timing.label.split(' – ')[0]}
                    </span>
                    <span className="font-semibold text-gray-900">{timing.label.split(' – ')[1]}</span>
                  </div>

                  {slot && (
                    <>
                      <form
                        onSubmit={(e) => { e.preventDefault(); handleVehicleTimeSave(slot.id); }}
                        className="flex items-center gap-2"
                      >
                        <label className="text-xs text-gray-500 whitespace-nowrap">Vehicle</label>
                        <input
                          type="time"
                          value={vehicleTimes[slot.id] ?? ''}
                          onChange={(e) =>
                            setVehicleTimes((prev) => ({ ...prev, [slot.id]: e.target.value }))
                          }
                          className="input-field !py-1.5 !text-sm !w-32"
                        />
                        <LoadingButton
                          type="submit"
                          loading={savingVehicle[slot.id]}
                          loadingText="Saving..."
                          variant="primary"
                          className="!px-3 !py-1.5 !text-xs !rounded-lg"
                        >
                          Save
                        </LoadingButton>
                      </form>

                      <button
                        onClick={() => handleToggle(slot.id, slot.enabled)}
                        className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ml-auto ${
                          slot.enabled
                            ? 'bg-green-50 text-green-600 hover:bg-green-100'
                            : 'bg-red-50 text-red-600 hover:bg-red-100'
                        }`}
                      >
                        {slot.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
