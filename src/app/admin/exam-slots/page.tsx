'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import LoadingButton from '@/components/ui/LoadingButton';
import { formatDateOnly } from '@/lib/dates';
import { to12h } from '@/lib/slots';

interface VehicleForm {
  id?: number;
  vehicle_type: string;
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string;
  departure_time: string;
  arrival_time: string;
  total_seats: string;
  status: string;
  booked_seats?: number;
}

interface VehicleRecord {
  id: number;
  vehicle_type: string;
  vehicle_number: string;
  driver_name: string;
  driver_mobile: string;
  departure_time: string;
  arrival_time: string;
  total_seats: number;
  booked_seats: number;
  status: string;
  available_seats?: number;
}

interface ExamSlot {
  id: number;
  date: string;
  time: string;
  exam_name: string;
  reporting_time: string;
  pickup_location: string;
  drop_location: string;
  description: string;
  price: number;
  has_custom_price: boolean;
  enabled: number;
  status: string;
  status_label: string;
  is_open: boolean;
  vehicle_count: number;
  total_capacity: number;
  booked_seats: number;
  available_seats: number;
  confirmed_bookings: number;
  vehicles: VehicleRecord[];
}

const emptyVehicle = (): VehicleForm => ({
  vehicle_type: '',
  vehicle_number: '',
  driver_name: '',
  driver_mobile: '',
  departure_time: '',
  arrival_time: '',
  total_seats: '',
  status: 'available',
});

const emptyForm = () => ({
  exam_name: '',
  exam_date: '',
  exam_time: '',
  reporting_time: '',
  pickup_location: '',
  drop_location: '',
  price: '',
  status: 'open',
  description: '',
});

export default function AdminExamSlots() {
  const [slots, setSlots] = useState<ExamSlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm());
  const [vehicles, setVehicles] = useState<VehicleForm[]>([emptyVehicle()]);
  const [formError, setFormError] = useState('');
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');
  const [viewSlot, setViewSlot] = useState<ExamSlot | null>(null);
  const [deleteSlot, setDeleteSlot] = useState<ExamSlot | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<number | null>(null);
  const messageTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const showMessage = (msg: string, type: 'success' | 'error' = 'success') => {
    clearTimeout(messageTimer.current);
    setMessage(msg);
    setMessageType(type);
    messageTimer.current = setTimeout(() => setMessage(''), 4000);
  };

  const loadSlots = useCallback(() => {
    fetch('/api/admin/exam-slots')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to fetch exam slots');
        return r.json();
      })
      .then((data: ExamSlot[]) => setSlots(data))
      .catch((err) => {
        console.error('[AdminExamSlots] loadSlots error:', err?.message || err);
        showMessage('Failed to load exam slots. Check connection.', 'error');
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSlots();
    return () => clearTimeout(messageTimer.current);
  }, [loadSlots]);

  const startCreate = () => {
    setEditingId(null);
    setForm(emptyForm());
    setVehicles([emptyVehicle()]);
    setFormError('');
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const startEdit = async (slot: ExamSlot) => {
    setFormError('');
    setShowForm(true);
    setEditingId(slot.id);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const res = await fetch(`/api/admin/exam-slots/${slot.id}`);
      if (!res.ok) throw new Error('Failed to load slot');
      const detail = await res.json();
      setForm({
        exam_name: detail.exam_name || '',
        exam_date: detail.date || '',
        exam_time: detail.time || '',
        reporting_time: detail.reporting_time || '',
        pickup_location: detail.pickup_location || '',
        drop_location: detail.drop_location || '',
        price: detail.has_custom_price ? String(detail.price) : '',
        status: detail.status_label === 'expired' ? 'closed' : detail.is_open ? 'open' : 'closed',
        description: detail.description || '',
      });
      const vs: VehicleForm[] = (detail.vehicles || []).map((v: VehicleRecord) => ({
        id: v.id,
        vehicle_type: v.vehicle_type,
        vehicle_number: v.vehicle_number,
        driver_name: v.driver_name || '',
        driver_mobile: v.driver_mobile || '',
        departure_time: v.departure_time,
        arrival_time: v.arrival_time,
        total_seats: String(v.total_seats),
        status: v.status,
        booked_seats: v.booked_seats,
      }));
      setVehicles(vs.length > 0 ? vs : [emptyVehicle()]);
    } catch (err: any) {
      showMessage(err?.message || 'Failed to load exam slot', 'error');
      setShowForm(false);
    }
  };

  const validateForm = (): string => {
    if (!form.exam_name.trim()) return 'Exam name is required';
    if (!form.exam_date) return 'Exam date is required';
    if (!form.exam_time) return 'Exam time is required';
    if (!form.reporting_time) return 'Reporting time is required';
    if (form.reporting_time > form.exam_time) return 'Reporting time cannot be after the exam time';
    const price = Number(form.price || 0);
    if (form.price !== '' && (isNaN(price) || price < 0)) return 'Ticket price cannot be negative';
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      const label = `Vehicle ${i + 1}`;
      if (!v.vehicle_type.trim()) return `${label}: vehicle type is required`;
      if (!v.vehicle_number.trim()) return `${label}: vehicle number is required`;
      if (!v.departure_time) return `${label}: departure time is required`;
      if (!v.arrival_time) return `${label}: expected arrival time is required`;
      if (v.departure_time > v.arrival_time) return `${label}: departure cannot be after the expected arrival time`;
      const seats = Number(v.total_seats);
      if (!Number.isInteger(seats) || seats <= 0) return `${label}: total seats must be a whole number greater than 0`;
      if ((v.booked_seats || 0) > seats) return `${label}: total seats cannot be less than the already booked seats (${v.booked_seats})`;
    }
    return '';
  };

  const handleSave = async () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    if (saving) return;
    setSaving(true);
    setFormError('');

    const payload = {
      exam_name: form.exam_name.trim(),
      exam_date: form.exam_date,
      exam_time: form.exam_time,
      reporting_time: form.reporting_time,
      pickup_location: form.pickup_location.trim(),
      drop_location: form.drop_location.trim(),
      price: form.price === '' ? 0 : Number(form.price),
      status: form.status,
      description: form.description.trim(),
      vehicles: vehicles.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        vehicle_type: v.vehicle_type.trim(),
        vehicle_number: v.vehicle_number.trim(),
        driver_name: v.driver_name.trim(),
        driver_mobile: v.driver_mobile.trim(),
        departure_time: v.departure_time,
        arrival_time: v.arrival_time,
        total_seats: Number(v.total_seats),
        status: v.status,
      })),
    };

    try {
      const res = await fetch(
        editingId ? `/api/admin/exam-slots/${editingId}` : '/api/admin/exam-slots',
        {
          method: editingId ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save exam slot');
      showMessage(editingId ? 'Exam slot updated successfully' : 'Exam slot created successfully');
      setShowForm(false);
      setEditingId(null);
      loadSlots();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save exam slot');
      console.error('[AdminExamSlots] save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleOpen = async (slot: ExamSlot) => {
    if (togglingId) return;
    setTogglingId(slot.id);
    try {
      const res = await fetch('/api/slots', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: slot.id, enabled: slot.is_open ? 0 : 1 }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      showMessage(slot.is_open ? 'Exam slot closed — new bookings blocked' : 'Exam slot opened for bookings');
      loadSlots();
    } catch (err: any) {
      showMessage(err?.message || 'Failed to update status', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteSlot || deleting) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/exam-slots/${deleteSlot.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete exam slot');
      showMessage('Exam slot deleted');
      setDeleteSlot(null);
      loadSlots();
    } catch (err: any) {
      showMessage(err?.message || 'Failed to delete exam slot', 'error');
      setDeleteSlot(null);
    } finally {
      setDeleting(false);
    }
  };

  const updateVehicle = (index: number, field: keyof VehicleForm, value: string) => {
    setVehicles((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const removeVehicle = (index: number) => {
    const v = vehicles[index];
    const confirmMsg = v.id
      ? `Remove ${v.vehicle_type || 'vehicle'} (${v.vehicle_number || 'no number'}) from this exam slot?${v.booked_seats ? ' It has booked seats and will be marked Cancelled instead of removed.' : ''}`
      : `Remove Vehicle ${index + 1}?`;
    if (!window.confirm(confirmMsg)) return;
    setVehicles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.length > 0 ? next : [emptyVehicle()];
    });
  };

  const statusBadge = (slot: ExamSlot) => {
    if (slot.status_label === 'expired') {
      return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Expired</span>;
    }
    if (!slot.is_open) {
      return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-red-50 text-red-600">Closed</span>;
    }
    return <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-600">Open</span>;
  };

  const vehicleStatusBadge = (status: string, booked: number, total: number) => {
    if (status === 'cancelled') {
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-500">Cancelled</span>;
    }
    if (status === 'full' || (total > 0 && booked >= total)) {
      return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-red-50 text-red-600">Full</span>;
    }
    return <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-600">Available</span>;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1e3a5f]">Exam Slots</h1>
          <p className="text-gray-500 text-sm mt-1">
            Create exam slots with pickup/drop details and assign one or more vehicles with timings.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={startCreate}
            className="px-5 py-2.5 bg-[#1e3a5f] text-white rounded-lg text-sm font-semibold hover:bg-[#16304f] transition-colors flex items-center gap-2 justify-center"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Create Exam Slot
          </button>
        )}
      </div>

      {message && (
        <div
          className={`mb-4 p-3 rounded-lg text-sm font-medium ${
            messageType === 'success'
              ? 'bg-green-50 text-green-700 border border-green-100'
              : 'bg-red-50 text-red-700 border border-red-100'
          }`}
        >
          {message}
        </div>
      )}

      {showForm && (
        <div className="glass-card p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-bold text-[#1e3a5f]">
              {editingId ? 'Edit Exam Slot' : 'Create Exam Slot'}
            </h2>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Close form"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {formError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 rounded-lg text-sm">
              {formError}
            </div>
          )}

          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Exam Information</h3>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam Name *</label>
              <input
                type="text"
                value={form.exam_name}
                onChange={(e) => setForm({ ...form, exam_name: e.target.value })}
                className="input-field"
                placeholder="e.g. SBI PO"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam Date *</label>
              <input
                type="date"
                value={form.exam_date}
                onChange={(e) => setForm({ ...form, exam_date: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Exam Time *</label>
              <input
                type="time"
                value={form.exam_time}
                onChange={(e) => setForm({ ...form, exam_time: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reporting Time *</label>
              <input
                type="time"
                value={form.reporting_time}
                onChange={(e) => setForm({ ...form, reporting_time: e.target.value })}
                className="input-field"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location</label>
              <input
                type="text"
                value={form.pickup_location}
                onChange={(e) => setForm({ ...form, pickup_location: e.target.value })}
                className="input-field"
                placeholder="e.g. Nandyala"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Drop Location</label>
              <input
                type="text"
                value={form.drop_location}
                onChange={(e) => setForm({ ...form, drop_location: e.target.value })}
                className="input-field"
                placeholder="e.g. Exam Centre"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ticket Price (₹)</label>
              <input
                type="number"
                min="0"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className="input-field"
                placeholder="Leave empty for default price"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm({ ...form, status: e.target.value })}
                className="select-field"
              >
                <option value="open">Open</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            <div className="sm:col-span-2 lg:col-span-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Description / Instructions (optional)</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="input-field min-h-[80px]"
                placeholder="Instructions for passengers, e.g. reach the pickup point 15 minutes early"
              />
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Vehicles</h3>
            <span className="text-xs text-gray-400">Available seats = Total − Booked (automatic)</span>
          </div>

          <div className="space-y-4 mb-4">
            {vehicles.map((v, index) => (
              <div key={index} className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold text-gray-700">Vehicle {index + 1}</span>
                  <button
                    onClick={() => removeVehicle(index)}
                    className="text-red-500 hover:text-red-600 text-xs font-medium flex items-center gap-1"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Remove
                  </button>
                </div>
                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle Type *</label>
                    <input
                      type="text"
                      value={v.vehicle_type}
                      onChange={(e) => updateVehicle(index, 'vehicle_type', e.target.value)}
                      className="input-field !py-2 !text-sm"
                      placeholder="Bus, Tata Force…"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Vehicle Number *</label>
                    <input
                      type="text"
                      value={v.vehicle_number}
                      onChange={(e) => updateVehicle(index, 'vehicle_number', e.target.value)}
                      className="input-field !py-2 !text-sm"
                      placeholder="AP21AB1234"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Departure *</label>
                    <input
                      type="time"
                      value={v.departure_time}
                      onChange={(e) => updateVehicle(index, 'departure_time', e.target.value)}
                      className="input-field !py-2 !text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Expected Arrival *</label>
                    <input
                      type="time"
                      value={v.arrival_time}
                      onChange={(e) => updateVehicle(index, 'arrival_time', e.target.value)}
                      className="input-field !py-2 !text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Driver Name</label>
                    <input
                      type="text"
                      value={v.driver_name}
                      onChange={(e) => updateVehicle(index, 'driver_name', e.target.value)}
                      className="input-field !py-2 !text-sm"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Driver Mobile</label>
                    <input
                      type="tel"
                      value={v.driver_mobile}
                      onChange={(e) => updateVehicle(index, 'driver_mobile', e.target.value.replace(/[^\d+\-\s]/g, '').slice(0, 15))}
                      className="input-field !py-2 !text-sm"
                      placeholder="Optional"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Total Seats *</label>
                    <input
                      type="number"
                      min="1"
                      value={v.total_seats}
                      onChange={(e) => updateVehicle(index, 'total_seats', e.target.value)}
                      className="input-field !py-2 !text-sm"
                      placeholder="40"
                    />
                    {typeof v.booked_seats === 'number' && v.booked_seats > 0 && (
                      <p className="text-xs text-amber-600 mt-1">{v.booked_seats} seat(s) already booked</p>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                    <select
                      value={v.status}
                      onChange={(e) => updateVehicle(index, 'status', e.target.value)}
                      className="select-field !py-2 !text-sm"
                    >
                      <option value="available">Available</option>
                      <option value="full">Full</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={() => setVehicles((prev) => [...prev, emptyVehicle()])}
            className="px-4 py-2 border-2 border-dashed border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:border-[#1e3a5f] hover:text-[#1e3a5f] transition-colors w-full"
          >
            + Add Vehicle
          </button>

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="btn-outline flex-1 justify-center"
              disabled={saving}
            >
              Cancel
            </button>
            <LoadingButton
              onClick={handleSave}
              loading={saving}
              loadingText="Saving..."
              variant="primary"
              className="flex-1 justify-center"
            >
              {editingId ? 'Save Changes' : 'Create Exam Slot'}
            </LoadingButton>
          </div>
        </div>
      )}

      {loading ? (
        <div className="glass-card p-12 text-center">
          <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-gray-500 mt-4">Loading exam slots...</p>
        </div>
      ) : slots.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <svg className="w-12 h-12 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-gray-500 mb-2">No exam slots yet.</p>
          <p className="text-sm text-gray-400 mb-4">Create your first exam slot with vehicles and timings.</p>
          <button onClick={startCreate} className="btn-primary justify-center">
            Create Exam Slot
          </button>
        </div>
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="glass-card overflow-hidden hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Exam</th>
                    <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Date</th>
                    <th className="text-left p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Exam / Reporting</th>
                    <th className="text-center p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Vehicles</th>
                    <th className="text-center p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Capacity</th>
                    <th className="text-center p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Booked</th>
                    <th className="text-center p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Available</th>
                    <th className="text-right p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Price</th>
                    <th className="text-center p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Status</th>
                    <th className="text-right p-3 text-xs font-semibold text-gray-700 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {slots.map((slot) => (
                    <tr key={slot.id} className="border-t border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="p-3">
                        <p className="font-semibold text-gray-900 text-sm">
                          {slot.exam_name || <span className="text-gray-400 font-normal">—</span>}
                        </p>
                        {(slot.pickup_location || slot.drop_location) && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {slot.pickup_location || '—'} → {slot.drop_location || '—'}
                          </p>
                        )}
                      </td>
                      <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
                        {formatDateOnly(slot.date, { day: 'numeric', month: 'short', year: 'numeric' })}
                      </td>
                      <td className="p-3 text-sm text-gray-700 whitespace-nowrap">
                        {to12h(slot.time)}
                        {slot.reporting_time && (
                          <span className="text-gray-400 text-xs"> / {to12h(slot.reporting_time)}</span>
                        )}
                      </td>
                      <td className="p-3 text-center text-sm text-gray-700">{slot.vehicle_count}</td>
                      <td className="p-3 text-center text-sm text-gray-700">{slot.total_capacity}</td>
                      <td className="p-3 text-center text-sm font-medium text-gray-900">{slot.booked_seats}</td>
                      <td className="p-3 text-center text-sm font-medium text-[#1e3a5f]">{slot.available_seats}</td>
                      <td className="p-3 text-right text-sm text-gray-700 whitespace-nowrap">
                        ₹{Number(slot.price).toLocaleString('en-IN')}
                        {!slot.has_custom_price && <span className="text-xs text-gray-400"> (default)</span>}
                      </td>
                      <td className="p-3 text-center">{statusBadge(slot)}</td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => setViewSlot(slot)}
                            className="px-3 py-1.5 bg-[#1e3a5f]/5 text-[#1e3a5f] rounded-lg text-sm font-medium hover:bg-[#1e3a5f]/10 transition-colors"
                          >
                            View
                          </button>
                          <button
                            onClick={() => startEdit(slot)}
                            className="px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleToggleOpen(slot)}
                            disabled={togglingId === slot.id || slot.status_label === 'expired'}
                            className="px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          >
                            {togglingId === slot.id ? '…' : slot.is_open ? 'Close' : 'Open'}
                          </button>
                          <button
                            onClick={() => setDeleteSlot(slot)}
                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-4">
            {slots.map((slot) => (
              <div key={slot.id} className="glass-card p-4">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <p className="font-bold text-gray-900">{slot.exam_name || 'Exam Slot'}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDateOnly(slot.date, { day: 'numeric', month: 'short', year: 'numeric' })} · {to12h(slot.time)}
                      {slot.reporting_time && <span className="text-gray-400"> (report {to12h(slot.reporting_time)})</span>}
                    </p>
                    {(slot.pickup_location || slot.drop_location) && (
                      <p className="text-xs text-gray-400 mt-0.5">
                        {slot.pickup_location || '—'} → {slot.drop_location || '—'}
                      </p>
                    )}
                  </div>
                  {statusBadge(slot)}
                </div>
                <div className="grid grid-cols-4 gap-2 text-center py-3 border-y border-gray-100 mb-3">
                  <div>
                    <p className="text-xs text-gray-400">Vehicles</p>
                    <p className="font-semibold text-gray-900">{slot.vehicle_count}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Capacity</p>
                    <p className="font-semibold text-gray-900">{slot.total_capacity}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Booked</p>
                    <p className="font-semibold text-gray-900">{slot.booked_seats}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Available</p>
                    <p className="font-semibold text-[#1e3a5f]">{slot.available_seats}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">
                    ₹{Number(slot.price).toLocaleString('en-IN')}
                    {!slot.has_custom_price && <span className="text-xs text-gray-400"> (default)</span>}
                  </span>
                  {slot.confirmed_bookings > 0 && (
                    <span className="text-xs text-gray-400">{slot.confirmed_bookings} confirmed booking(s)</span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setViewSlot(slot)}
                    className="px-3 py-2 bg-[#1e3a5f]/5 text-[#1e3a5f] rounded-lg text-sm font-medium"
                  >
                    View
                  </button>
                  <button
                    onClick={() => startEdit(slot)}
                    className="px-3 py-2 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleOpen(slot)}
                    disabled={togglingId === slot.id || slot.status_label === 'expired'}
                    className="px-3 py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium disabled:opacity-40"
                  >
                    {slot.is_open ? 'Close Slot' : 'Open Slot'}
                  </button>
                  <button
                    onClick={() => setDeleteSlot(slot)}
                    className="px-3 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* View modal */}
      {viewSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setViewSlot(null)}>
          <div
            className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-gray-100 flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-[#1e3a5f]">{viewSlot.exam_name || 'Exam Slot'}</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {formatDateOnly(viewSlot.date, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
              </div>
              <button onClick={() => setViewSlot(null)} className="text-gray-400 hover:text-gray-600" aria-label="Close">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <div className="grid sm:grid-cols-2 gap-3 mb-6">
                <div className="flex justify-between sm:block">
                  <span className="text-sm text-gray-500">Exam Time</span>
                  <span className="font-semibold text-gray-900">{to12h(viewSlot.time)}</span>
                </div>
                {viewSlot.reporting_time && (
                  <div className="flex justify-between sm:block">
                    <span className="text-sm text-gray-500">Reporting Time</span>
                    <span className="font-semibold text-gray-900">{to12h(viewSlot.reporting_time)}</span>
                  </div>
                )}
                {viewSlot.pickup_location && (
                  <div className="flex justify-between sm:block">
                    <span className="text-sm text-gray-500">Pickup</span>
                    <span className="font-semibold text-gray-900">{viewSlot.pickup_location}</span>
                  </div>
                )}
                {viewSlot.drop_location && (
                  <div className="flex justify-between sm:block">
                    <span className="text-sm text-gray-500">Drop</span>
                    <span className="font-semibold text-gray-900">{viewSlot.drop_location}</span>
                  </div>
                )}
                <div className="flex justify-between sm:block">
                  <span className="text-sm text-gray-500">Price</span>
                  <span className="font-semibold text-gray-900">₹{Number(viewSlot.price).toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between sm:block">
                  <span className="text-sm text-gray-500">Status</span>
                  <span className="font-semibold">{statusBadge(viewSlot)}</span>
                </div>
              </div>

              {viewSlot.description && (
                <div className="p-3 bg-gray-50 rounded-lg text-sm text-gray-600 mb-6">
                  {viewSlot.description}
                </div>
              )}

              <h4 className="font-bold text-gray-900 mb-3">Vehicles</h4>
              {viewSlot.vehicles.length === 0 ? (
                <p className="text-sm text-gray-400 py-4 text-center bg-gray-50 rounded-lg">
                  No vehicles assigned to this slot.
                </p>
              ) : (
                <div className="border border-gray-100 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                        <th className="text-left p-2.5 font-semibold">Vehicle</th>
                        <th className="text-left p-2.5 font-semibold">Number</th>
                        <th className="text-left p-2.5 font-semibold whitespace-nowrap">Departure</th>
                        <th className="text-left p-2.5 font-semibold whitespace-nowrap">Arrival</th>
                        <th className="text-center p-2.5 font-semibold">Capacity</th>
                        <th className="text-center p-2.5 font-semibold">Booked</th>
                        <th className="text-center p-2.5 font-semibold">Available</th>
                        <th className="text-center p-2.5 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {viewSlot.vehicles.map((v) => (
                        <tr key={v.id} className="border-t border-gray-50">
                          <td className="p-2.5 font-medium text-gray-900">{v.vehicle_type}</td>
                          <td className="p-2.5 font-mono text-xs text-gray-600">{v.vehicle_number}</td>
                          <td className="p-2.5 text-gray-700 whitespace-nowrap">{to12h(v.departure_time)}</td>
                          <td className="p-2.5 text-gray-700 whitespace-nowrap">{to12h(v.arrival_time)}</td>
                          <td className="p-2.5 text-center text-gray-700">{v.total_seats}</td>
                          <td className="p-2.5 text-center font-medium text-gray-900">{v.booked_seats}</td>
                          <td className="p-2.5 text-center font-medium text-[#1e3a5f]">
                            {Math.max(0, (Number(v.total_seats) || 0) - (Number(v.booked_seats) || 0))}
                          </td>
                          <td className="p-2.5 text-center">
                            {vehicleStatusBadge(v.status, Number(v.booked_seats) || 0, Number(v.total_seats) || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteSlot && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-md w-full">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 flex items-center justify-center flex-shrink-0">
                <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Delete Exam Slot?</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {deleteSlot.confirmed_bookings > 0
                    ? `This slot has ${deleteSlot.confirmed_bookings} confirmed booking(s). Deletion is blocked — close the slot instead. Closing prevents new bookings while existing bookings remain available.`
                    : `This will permanently remove "${deleteSlot.exam_name || 'this slot'}" on ${formatDateOnly(deleteSlot.date, { day: 'numeric', month: 'short', year: 'numeric' })}, its vehicles, and any pending bookings. This cannot be undone.`}
                </p>
              </div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteSlot(null)}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
              >
                Cancel
              </button>
              {deleteSlot.confirmed_bookings > 0 ? (
                <button
                  onClick={() => {
                    handleToggleOpen(deleteSlot);
                    setDeleteSlot(null);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Close Slot Instead
                </button>
              ) : (
                <LoadingButton
                  onClick={handleDelete}
                  loading={deleting}
                  loadingText="Deleting..."
                  variant="primary"
                  className="!bg-red-600 hover:!bg-red-700 px-4 py-2"
                >
                  Delete Permanently
                </LoadingButton>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
