'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { format } from 'date-fns';
import { slotLabel, to12h, EXAM_CENTERS } from '@/lib/slots';
import LoadingButton from '@/components/ui/LoadingButton';
import { formatLongDate } from '@/lib/dates';

function normalizeContact(phone?: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  return phone;
}

function ensureRazorpayLoaded(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as any).Razorpay) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay checkout. Please check your connection and retry.'));
    const timeout = setTimeout(() => {
      if (!(window as any).Razorpay) {
        reject(new Error('Razorpay checkout took too long to load. Please check your connection and retry.'));
      }
      script.remove();
    }, 15000);
    script.onload = () => {
      clearTimeout(timeout);
      resolve();
    };
    document.body.appendChild(script);
  });
}

interface DateOption {
  id: number;
  date: string;
}

interface SlotOption {
  id: number;
  date_id: number;
  time: string;
  enabled: number;
  vehicle_time: string;
  exam_name?: string;
  reporting_time?: string;
  pickup_location?: string;
  drop_location?: string;
  description?: string;
  price?: number;
}

interface PassengerForm {
  name: string;
  mobile: string;
  gender: string;
}

function StepIndicator({ current, steps }: { current: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-10">
      {steps.map((step, i) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all ${
              i <= current
                ? 'bg-[#1e3a5f] text-white'
                : 'bg-gray-100 text-gray-400'
            }`}
          >
            {i + 1}
          </div>
          <span
            className={`hidden sm:inline text-sm font-medium ${
              i <= current ? 'text-[#1e3a5f]' : 'text-gray-400'
            }`}
          >
            {step}
          </span>
          {i < steps.length - 1 && (
            <div
              className={`w-8 h-0.5 ${
                i < current ? 'bg-[#1e3a5f]' : 'bg-gray-200'
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function CalendarWidget({
  availableDates,
  selectedDateId,
  onSelect,
}: {
  availableDates: DateOption[];
  selectedDateId: number | null;
  onSelect: (dateId: number) => void;
}) {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const todayIST = new Date(todayStr + 'T00:00:00+05:30');

  const availableDatesSet = new Set(availableDates.map((d) => d.date));

  const selectedDate = availableDates.find((d) => d.id === selectedDateId);
  const selectedDateObj = selectedDate ? new Date(selectedDate.date + 'T00:00:00+05:30') : null;

  const disabledDays = [
    { before: todayIST },
    (day: Date) => {
      const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
      return !availableDatesSet.has(key);
    },
  ];

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-3">
        Select Date
      </label>
      {selectedDateObj && (
        <div className="mb-4 px-4 py-3 bg-[#1e3a5f]/5 rounded-xl border border-[#1e3a5f]/10">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-500">Selected</span>
            <span className="font-bold text-[#1e3a5f]">
              {format(selectedDateObj, 'dd MMMM yyyy', { in: 'Asia/Kolkata' } as any)}
            </span>
          </div>
        </div>
      )}
      <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm">
        <DayPicker
          mode="single"
          selected={selectedDateObj || undefined}
          onSelect={(day: Date | undefined) => {
            if (!day) return;
            const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
            const dateOption = availableDates.find((d) => d.date === key);
            if (dateOption) onSelect(dateOption.id);
          }}
          disabled={disabledDays}
          showOutsideDays={false}
          required
        />
      </div>
    </div>
  );
}

function StepSelectSlot({
  initialPrice,
  onNext,
}: {
  initialPrice: number;
  onNext: (dateId: number, slot: SlotOption, date: string) => void;
}) {
  const [dates, setDates] = useState<DateOption[]>([]);
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [selectedDateId, setSelectedDateId] = useState<number | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [slotsLoading, setSlotsLoading] = useState(false);

  useEffect(() => {
    fetch('/api/dates')
      .then((r) => r.json())
      .then((data) => {
        const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        const todayIST = new Date(todayStr + 'T00:00:00+05:30');
        const futureDates = (data as DateOption[]).filter(
          (d) => new Date(d.date + 'T00:00:00+05:30') >= todayIST
        );
        setDates(futureDates);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadSlots = useCallback(async (dateId: number) => {
    setSlotsLoading(true);
    setSelectedSlotId(null);
    try {
      const res = await fetch(`/api/slots?date_id=${dateId}`);
      const data = await res.json();
      setSlots((data as SlotOption[]).filter((s) => s.enabled === 1));
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, []);

  const handleDateSelect = (dateId: number) => {
    console.log(`[Booking] Date selected: ${dateId}`);
    setSelectedDateId(dateId);
    loadSlots(dateId);
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-gray-500 mt-4">Loading available slots...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <CalendarWidget
          availableDates={dates}
          selectedDateId={selectedDateId}
          onSelect={handleDateSelect}
        />
      </div>

      {selectedDateId && (
        <div className="mb-8 animate-fade-in">
          <label className="block text-sm font-semibold text-gray-700 mb-3">
            Select Time Slot
          </label>
          {slotsLoading ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <div className="w-6 h-6 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-gray-500">Checking slot availability...</p>
              <p className="text-xs text-gray-400 mt-1">Please wait...</p>
            </div>
          ) : slots.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <p className="text-gray-500">No slots available for this date</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {slots.map((s) => {
                const isSelected = selectedSlotId === s.id;
                const price = Number(s.price) > 0 ? Number(s.price) : initialPrice;
                return (
                  <button
                    key={s.id}
                    onClick={() => {
                      console.log(`[Booking] Slot selected: ${s.time} (id=${s.id})`);
                      setSelectedSlotId(s.id);
                    }}
                    disabled={slotsLoading}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${
                      isSelected
                        ? 'border-[#1e3a5f] bg-[#1e3a5f]/5 shadow-md'
                        : 'border-gray-100 hover:border-gray-200 bg-white'
                    } ${slotsLoading ? 'opacity-50 cursor-wait' : ''}`}
                  >
                    <div className="mb-1">
                      <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                        {s.exam_name ? 'Exam' : 'Slot'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-gray-900">
                        {s.exam_name || slotLabel(s.time)}
                      </span>
                      <span className="text-sm font-semibold text-[#1e3a5f]">
                        ₹{price.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-500">
                      {s.exam_name ? `${slotLabel(s.time)} exam time` : ''}
                    </div>
                    {s.reporting_time && (
                      <div className="mt-1 text-xs text-gray-500">
                        Report by {to12h(s.reporting_time)}
                      </div>
                    )}
                    {(s.pickup_location || s.drop_location) && (
                      <div className="mt-1 text-xs text-gray-500">
                        {s.pickup_location || '—'} → {s.drop_location || '—'}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => {
          if (!selectedDateId || !selectedSlotId) return;
          const dateObj = dates.find((d) => d.id === selectedDateId);
          const slotObj = slots.find((s) => s.id === selectedSlotId);
          if (slotObj && dateObj) {
            onNext(selectedDateId, slotObj, dateObj.date);
          }
        }}
        disabled={!selectedDateId || !selectedSlotId || slotsLoading}
        className="btn-primary w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Continue
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
        </svg>
      </button>
    </div>
  );
}

function StepSelectExamCenter({
  selectedCenter,
  onBack,
  onNext,
}: {
  selectedCenter: string;
  onBack: () => void;
  onNext: (center: string) => void;
}) {
  const [center, setCenter] = useState(selectedCenter);
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (!center) { setError('Please select an exam center'); return; }
    onNext(center);
  };

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-[#1e3a5f] mb-2">Select Exam Center</h2>
      <p className="text-gray-500 mb-6">Choose the exam center for your travel booking.</p>

      <div className="grid gap-3 mb-8">
        {EXAM_CENTERS.map((c) => {
          const selected = center === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => { setCenter(c); setError(''); }}
              className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                selected
                  ? 'border-[#1e3a5f] bg-[#1e3a5f]/5 shadow-md'
                  : 'border-gray-100 hover:border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${
                  selected ? 'border-[#1e3a5f]' : 'border-gray-300'
                }`}>
                  {selected && <div className="w-2.5 h-2.5 rounded-full bg-[#1e3a5f]" />}
                </div>
                <span className={`font-medium ${selected ? 'text-[#1e3a5f]' : 'text-gray-700'}`}>{c}</span>
              </div>
            </button>
          );
        })}
      </div>

      {error && <p className="text-sm text-red-500 mb-4 text-center">{error}</p>}

      <div className="flex gap-3">
        <button onClick={onBack} className="btn-outline flex-1 justify-center">Back</button>
        <button onClick={handleSubmit} className="btn-primary flex-1 justify-center">Continue</button>
      </div>
    </div>
  );
}

function StepPassengerDetails({
  ticketCount,
  pricePerTicket,
  onBack,
  onNext,
}: {
  ticketCount: number;
  pricePerTicket: number;
  onBack: () => void;
  onNext: (passengers: PassengerForm[]) => void;
}) {
  const [passengers, setPassengers] = useState<PassengerForm[]>(
    Array.from({ length: ticketCount }, () => ({
      name: '',
      mobile: '',
      gender: '',
    }))
  );
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const updatePassenger = (
    index: number,
    field: keyof PassengerForm,
    value: string
  ) => {
    const updated = [...passengers];
    updated[index] = { ...updated[index], [field]: value };
    setPassengers(updated);
    setErrors({});
  };

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    passengers.forEach((p, i) => {
      if (!p.name.trim()) newErrors[`name_${i}`] = 'Name is required';
      if (!p.mobile.trim()) {
        newErrors[`mobile_${i}`] = 'Mobile number is required';
      } else if (!/^[6-9]\d{9}$/.test(p.mobile)) {
        newErrors[`mobile_${i}`] = 'Enter valid 10-digit mobile number';
      }
      if (!p.gender) newErrors[`gender_${i}`] = 'Select gender';
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) onNext(passengers);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-[#1e3a5f]">
          Passenger Details
        </h2>
        <span className="text-sm text-gray-500">
          {ticketCount} passenger{ticketCount > 1 ? 's' : ''} &middot; ₹
          {(ticketCount * pricePerTicket).toLocaleString('en-IN')}
        </span>
      </div>

      <div className="space-y-6">
        {passengers.map((passenger, index) => (
          <div
            key={index}
            className="glass-card p-6 animate-fade-in"
            style={{ animationDelay: `${index * 0.1}s` }}
          >
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-full bg-[#1e3a5f] text-white flex items-center justify-center text-xs font-bold">
                {index + 1}
              </div>
              <h3 className="font-semibold text-gray-900">
                Passenger {index + 1}
              </h3>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={passenger.name}
                  onChange={(e) => updatePassenger(index, 'name', e.target.value)}
                  className={`input-field ${errors[`name_${index}`] ? 'border-red-400' : ''}`}
                  placeholder="Full name"
                />
                {errors[`name_${index}`] && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors[`name_${index}`]}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mobile Number
                </label>
                <input
                  type="tel"
                  value={passenger.mobile}
                  onChange={(e) =>
                    updatePassenger(index, 'mobile', e.target.value.replace(/\D/g, '').slice(0, 10))
                  }
                  className={`input-field ${errors[`mobile_${index}`] ? 'border-red-400' : ''}`}
                  placeholder="10 digit number"
                />
                {errors[`mobile_${index}`] && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors[`mobile_${index}`]}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gender
                </label>
                <select
                  value={passenger.gender}
                  onChange={(e) => updatePassenger(index, 'gender', e.target.value)}
                  className={`select-field ${errors[`gender_${index}`] ? 'border-red-400' : ''}`}
                >
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
                {errors[`gender_${index}`] && (
                  <p className="text-xs text-red-500 mt-1">
                    {errors[`gender_${index}`]}
                  </p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-8">
        <button onClick={onBack} className="btn-outline flex-1 justify-center">
          Back
        </button>
        <button
          onClick={handleSubmit}
          className="btn-primary flex-1 justify-center"
        >
          Continue
        </button>
      </div>
    </div>
  );
}

function StepSummary({
  selectedDate,
  selectedTime,
  examCenter,
  passengers,
  pricePerTicket,
  onBack,
  onProceedToPayment,
  processing,
  error,
}: {
  selectedDate: string;
  selectedTime: string;
  examCenter: string;
  passengers: PassengerForm[];
  pricePerTicket: number;
  onBack: () => void;
  onProceedToPayment: () => void;
  processing: boolean;
  error: string;
}) {
  const total = passengers.length * pricePerTicket;

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-[#1e3a5f] mb-6">
        Booking Summary
      </h2>

      {error && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        </div>
      )}

      <div className="glass-card p-6 mb-6">
        <h3 className="font-bold text-gray-900 mb-4">Travel Details</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-gray-500">Business</span>
            <span className="font-semibold">Suman Travels</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Date</span>
            <span className="font-semibold">{selectedDate}</span>
          </div>
           <div className="flex justify-between">
             <span className="text-gray-500">Exam Time</span>
             <span className="font-semibold">{slotLabel(selectedTime)}</span>
           </div>
           {examCenter && (
            <div className="flex justify-between">
              <span className="text-gray-500">Exam Center</span>
              <span className="font-semibold">{examCenter}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-gray-500">Passengers</span>
            <span className="font-semibold">{passengers.length}</span>
          </div>
          <div className="border-t pt-3 flex justify-between">
            <span className="text-gray-700 font-bold">Total Amount</span>
            <span className="text-xl font-bold text-[#1e3a5f]">
              ₹{total.toLocaleString('en-IN')}
            </span>
          </div>
        </div>
      </div>

      <div className="glass-card p-6 mb-6">
        <h3 className="font-bold text-gray-900 mb-4">Passenger List</h3>
        <div className="space-y-3">
          {passengers.map((p, i) => (
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

      <div className="flex gap-3">
        <button
          onClick={onBack}
          className="btn-outline flex-1 justify-center"
        >
          Back
        </button>
        <LoadingButton
          onClick={onProceedToPayment}
          loading={processing}
          loadingText="Creating booking..."
          variant="primary"
          className="flex-1 justify-center"
        >
          Proceed to Payment
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </LoadingButton>
      </div>
    </div>
  );
}

function StepRazorpayPayment({
  amount,
  bookingRef,
  summary,
  resumedFromUrl,
  onBack,
  onStartOver,
  onPay,
  paymentError,
  processing,
}: {
  amount: number;
  bookingRef: string;
  summary: {
    date: string;
    time: string;
    examCenter: string;
    passengers: PassengerForm[];
    amount: number;
  } | null;
  resumedFromUrl: boolean;
  onBack: () => void;
  onStartOver: () => void;
  onPay: () => void;
  paymentError: string;
  processing: boolean;
}) {
  const total = summary ? summary.amount : amount;

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-[#1e3a5f] mb-2">Complete Payment</h2>
      <p className="text-gray-500 mb-8">
        Complete your payment using Razorpay.
      </p>

      {paymentError && (
        <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-100">
          <div className="flex items-center gap-3">
            <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-red-700">{paymentError}</p>
          </div>
        </div>
      )}

      {summary && (
        <div className="glass-card p-5 mb-6">
          <h3 className="font-bold text-gray-900 mb-3">Booking Summary</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Travel Date</span>
              <span className="font-semibold">{summary.date}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Exam Time</span>
              <span className="font-semibold">{slotLabel(summary.time)}</span>
            </div>
            {summary.examCenter && (
              <div className="flex justify-between">
                <span className="text-gray-500">Exam Center</span>
                <span className="font-semibold text-right">{summary.examCenter}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Tickets</span>
              <span className="font-semibold">{summary.passengers.length}</span>
            </div>
            {summary.passengers.length > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-500">Passenger{summary.passengers.length > 1 ? 's' : ''}</span>
                <span className="font-semibold text-right">
                  {summary.passengers.map((p) => p.name).filter(Boolean).join(', ') || `${summary.passengers.length} ticket(s)`}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="glass-card p-8 text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-[#1e3a5f]/5 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#1e3a5f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <div className="text-3xl font-bold text-[#1e3a5f] mb-2">
          ₹{total.toLocaleString('en-IN')}
        </div>
        <p className="text-gray-500">Total Amount</p>
        <p className="text-sm text-gray-400 mt-4">
          Booking Ref: <span className="font-mono font-medium text-gray-600">{bookingRef}</span>
        </p>
      </div>

      <div className="space-y-3">
        <LoadingButton
          onClick={onPay}
          loading={processing}
          loadingText="Opening Razorpay..."
          variant="primary"
          className="w-full justify-center text-lg"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
          Pay with Razorpay
        </LoadingButton>

        <button
          onClick={resumedFromUrl ? onStartOver : onBack}
          disabled={processing}
          className="btn-outline w-full justify-center disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {resumedFromUrl ? 'Start New Booking' : 'Back'}
        </button>

        <p className="text-xs text-gray-400 text-center">
          Secure payment powered by <span className="font-semibold">Razorpay</span>.
          We support UPI, Credit/Debit Cards, Net Banking, Wallets, and EMI.
        </p>
      </div>
    </div>
  );
}

export default function BookPageClient({ initialPrice = 500 }: { initialPrice: number }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [selectedDateId, setSelectedDateId] = useState<number | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState('');
   const [selectedTimeStr, setSelectedTimeStr] = useState('');
   const [ticketCount, setTicketCount] = useState(1);
  const [passengers, setPassengers] = useState<PassengerForm[]>([]);
  const [examCenter, setExamCenter] = useState('');
  const [processing, setProcessing] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingAmount, setBookingAmount] = useState(0);
  const [bookingError, setBookingError] = useState('');
  const [paymentError, setPaymentError] = useState('');
  const [resumedFromUrl, setResumedFromUrl] = useState(false);
  const bookingBusyRef = useRef(false);
  const paymentBusyRef = useRef(false);

  const [paymentSummary, setPaymentSummary] = useState<{
    date: string;
    time: string;
    examCenter: string;
    passengers: PassengerForm[];
    amount: number;
  } | null>(null);

  useEffect(() => {
    const error = searchParams.get('error');
    const bid = searchParams.get('id');
    if (bid) {
      setBookingId(bid);
      setResumedFromUrl(true);
      setStep(5);
      if (error) {
        if (error === 'payment_failed') {
          setPaymentError('Payment was not completed. Please try again.');
        } else if (error === 'payment_detected') {
          setPaymentError('Your payment was received. We are confirming your booking — please wait. You will NOT be charged again.');
        } else if (error === 'server_error') {
          setPaymentError('A server error occurred. Please try again.');
        } else {
          setPaymentError('Payment could not be processed. Please try again.');
        }
      }
      // Populate the payment screen summary from the saved booking.
      fetch(`/api/bookings/${bid}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data) {
            setBookingAmount(Number(data.amount) || 0);
            setPaymentSummary({
              date: data.date || '',
              time: data.time || '',
              examCenter: data.exam_center || '',
              passengers: (data.passengers || []).map((p: any) => ({ name: p.name || '', mobile: p.mobile || '', gender: p.gender || '' })),
              amount: Number(data.amount) || 0,
            });
          }
        })
        .catch(() => {});
    }
  }, [searchParams]);

  // Sync booking ID to URL so page refreshes don't lose the booking context
  useEffect(() => {
    if (bookingId && step >= 5) {
      const params = new URLSearchParams(window.location.search);
      if (params.get('id') !== bookingId) {
        params.set('id', bookingId);
        router.replace(`/book?${params.toString()}`, { scroll: false });
      }
    }
  }, [bookingId, step, router]);

  // If the payment for this booking already succeeded but confirmation hasn't
  // completed yet (e.g. callback interrupted by a network/DB hiccup), poll the
  // status endpoint until it resolves. Confirmed -> /success. The customer must
  // never have to pay twice.
  useEffect(() => {
    if (!bookingId || step !== 5) return;
    let cancelled = false;
    let attempts = 0;
    let timer: ReturnType<typeof setInterval> | undefined;
    const check = () => {
      fetch(`/api/razorpay/status?booking_id=${bookingId}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (cancelled) return;
          if (data.status === 'confirmed') {
            router.push(`/success?id=${bookingId}`);
          } else if (data.status === 'paid_detected' || data.status === 'pending') {
            attempts += 1;
            if (attempts >= 30) {
              if (timer) clearInterval(timer);
              cancelled = true;
              setPaymentError('Your payment was successful. We are still confirming your booking — please wait a moment or contact support with your ref, you will not be charged again.');
            }
          } else if (data.status === 'failed') {
            if (timer) clearInterval(timer);
            cancelled = true;
            setPaymentError('This payment was not completed. Please try again.');
          }
        })
        .catch(() => {});
    };
    check();
    timer = setInterval(check, 4000);
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [bookingId, step, router]);

   const [pricePerTicket, setPricePerTicket] = useState(initialPrice);

   const maxTickets = 100;

   const steps = ['Slot', 'Tickets', 'Center', 'Details', 'Summary', 'Payment'];

   const handleSlotNext = (dateId: number, slot: SlotOption, date: string) => {
     setSelectedDateId(dateId);
     setSelectedSlotId(slot.id);
     setSelectedDateStr(formatLongDate(date));
     setSelectedTimeStr(slot.time);
     setTicketCount(1);
     setPricePerTicket(Number(slot.price) > 0 ? Number(slot.price) : initialPrice);
     setStep(1);
   };

  const handleTicketsNext = (count: number) => {
    setTicketCount(count);
    setStep(2);
  };

  const handleExamCenterNext = (center: string) => {
    setExamCenter(center);
    setStep(3);
  };

  const handlePassengersNext = (data: PassengerForm[]) => {
    setPassengers(data);
    setStep(4);
  };

  const handleStartOver = () => {
    setBookingId(null);
    setBookingAmount(0);
    setBookingError('');
    setPaymentError('');
    setPaymentSummary(null);
    setResumedFromUrl(false);
    setSelectedDateId(null);
    setSelectedSlotId(null);
    setSelectedDateStr('');
    setSelectedTimeStr('');
    setTicketCount(1);
    setPassengers([]);
    setExamCenter('');
    setProcessing(false);
    setStep(0);
  };

  const handleCreateBooking = async () => {
    // If a booking was already created (e.g. the user went back from Payment to
    // Summary and clicked Proceed again), reuse it instead of creating a
    // duplicate booking record.
    if (bookingId) {
      setPaymentError('');
      setStep(5);
      return;
    }
    if (!selectedDateId || !selectedSlotId || bookingBusyRef.current) return;
    bookingBusyRef.current = true;
    setProcessing(true);
    setBookingError('');

    try {
      console.log(`[Booking] Creating booking: date=${selectedDateId}, slot=${selectedSlotId}, center=${examCenter}, passengers=${passengers.length}`);

      const bookingRes = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date_id: selectedDateId,
          slot_id: selectedSlotId,
          passengers,
          exam_center: examCenter,
        }),
      });

      if (!bookingRes.ok) {
        const err = await bookingRes.json();
        console.error(`[Booking] Create booking failed: ${err.error || 'Unknown error'}`);
        setBookingError(err.error || 'Could not create your booking. Please try again.');
        return;
      }

      const booking = await bookingRes.json();

      if (!booking.success || !booking.booking_id) {
        console.error(`[Booking] Unexpected response:`, booking);
        setBookingError('Could not create your booking. Please try again.');
        return;
      }

      console.log(`[Booking] Booking created: ${booking.booking_id}`);
      setBookingId(booking.booking_id);
      setBookingAmount(Number(booking.amount) || 0);
      setPaymentSummary({
        date: selectedDateStr,
        time: selectedTimeStr,
        examCenter,
        passengers,
        amount: Number(booking.amount) || passengers.length * pricePerTicket,
      });
      setStep(5);
    } catch (err) {
      console.error('[Booking] handleCreateBooking error:', err);
      setBookingError('Something went wrong while creating your booking. Please try again.');
    } finally {
      setProcessing(false);
      bookingBusyRef.current = false;
    }
  };

  const handleRazorpayPayment = async () => {
    if (!bookingId || paymentBusyRef.current) return;
    paymentBusyRef.current = true;
    setProcessing(true);
    setPaymentError('');

    try {
      console.log(`[Payment] Initiating payment for booking ${bookingId}`);
      // Safe diagnostic — no secrets. If Razorpay reports "Website mismatch",
      // the origin below must match the approved website in the Razorpay dashboard
      // (https://www.sumantravels.online). If it says "sumantravels.online" (no
      // www) the apex→www redirect hasn't taken effect — clear cache / incognito.
      console.log(
        `[Payment] Browser origin: ${window.location.origin}  ` +
        `hostname=${window.location.hostname}  protocol=${window.location.protocol}`
      );

      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });

      const data = await res.json();

      console.log(
        `[Payment] Razorpay key mode: ${data.key_id?.startsWith('rzp_live_') ? 'LIVE' : data.key_id?.startsWith('rzp_test_') ? 'TEST' : 'UNKNOWN'}`
      );

      if (!res.ok || !data.order_id) {
        console.error(`[Payment] Create order failed: ${data.error || 'Unknown error'}`);
        // The customer already paid on this booking — never offer a second
        // charge. Route to confirmation recovery instead.
        if (data.status === 'payment_already_completed') {
          setPaymentError('Your payment was received. We are confirming your booking — please wait. You will NOT be charged again.');
          return;
        }
        setPaymentError(data.error || 'Could not initiate payment. Please try again.');
        return;
      }

      console.log(`[Payment] Order created: ${data.order_id}, amount: ${data.amount}`);

      // Fire checkout events
      const fireEvent = (event: string, detail?: string) => {
        fetch('/api/debug/checkout-event', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId, event, detail }),
        }).catch(() => {});
      };

      fireEvent('checkout_opened', `amount=${data.amount}`);

      let paymentCompleted = false;

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency || 'INR',
        name: 'Suman Travels',
        description: `Booking ${bookingId}`,
        order_id: data.order_id,
        // Inline checkout (redirect:false): the payment runs inside this
        // website in the same tab, so the customer NEVER leaves sumantravels
        // and the browser is never redirected to an internal callback URL.
        // This removes the Android Chrome "Allow redirect to this site?" prompt
        // and the HTTP 405 page at /api/razorpay/callback that customers hit
        // with the previous hosted-direct flow. The success response is
        // delivered to the `handler` below, which POSTs the payment details to
        // /api/razorpay/verify for server-side signature + amount verification.
        redirect: false,
        prefill: {
          name: data.customer_name || '',
          contact: normalizeContact(data.customer_mobile),
        },
        theme: { color: '#1e3a5f' },
        handler: async function (response: any) {
          if (paymentCompleted) return;
          paymentCompleted = true;
          console.log(`[Payment] Razorpay handler fired: payment_id=${response.razorpay_payment_id}`);
          fireEvent('handler_fired', `payment_id=${response.razorpay_payment_id}`);
          setProcessing(true);
          try {
            const verifyRes = await fetch('/api/razorpay/verify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                booking_id: bookingId,
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });

            if (verifyRes.ok) {
              console.log(`[Payment] Payment verified for ${bookingId}, opening confirmation page`);
              router.replace(`/success?id=${encodeURIComponent(bookingId)}`);
            } else {
              const errData = await verifyRes.json().catch(() => ({}));
              console.error(`[Payment] Verification failed: ${errData.error || ''}`);
              setPaymentError(errData.error || 'Payment verification failed. Please contact support.');
              setProcessing(false);
              paymentBusyRef.current = false;
            }
          } catch (verifyErr) {
            console.error('[Payment] Verify request error:', verifyErr);
            // The payment may have succeeded even though this fetch failed —
            // the /book?id= poll + /api/razorpay/status auto-confirm recover
            // it, so the customer must NOT be asked to pay again.
            setPaymentError('Your payment may have been received. We are confirming your booking — please wait. You will NOT be charged again.');
            setProcessing(false);
            paymentBusyRef.current = false;
          }
        },
      };

      // Only open the checkout once the Razorpay script is present, so the
      // hosted checkout reliably opens the first time the customer clicks Pay.
      await ensureRazorpayLoaded();

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        console.log(`[Payment] Payment failed for booking ${bookingId}: ${response.error?.description || 'Unknown error'}`);
        paymentCompleted = true;
        fireEvent('payment_failed', response.error?.description || '');
        setPaymentError('Payment failed: ' + (response.error?.description || 'Please try again.'));
        setProcessing(false);
        paymentBusyRef.current = false;
      });
      rzp.open();
      setProcessing(false);
    } catch (err) {
      console.error('[Booking] handleRazorpayPayment error:', err);
      const errMsg = err instanceof Error ? err.message : '';
      setPaymentError(
        errMsg.includes('Razorpay')
          ? errMsg
          : 'Could not connect to payment gateway. Please check your connection and try again.'
      );
    } finally {
      setProcessing(false);
      paymentBusyRef.current = false;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10">
      <div className="max-w-3xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-[#1e3a5f]">Book Exam Travel</h1>
          <p className="text-gray-500 mt-2">
            Complete your booking in a few simple steps
          </p>
        </div>

        <StepIndicator current={step} steps={steps} />

        <div className="glass-card p-6 sm:p-8">
          {step === 0 && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-[#1e3a5f] mb-6">
                Select Date & Time
              </h2>
              <StepSelectSlot initialPrice={pricePerTicket} onNext={handleSlotNext} />
            </div>
          )}

           {step === 1 && selectedSlotId && (
            <div className="animate-fade-in">
              <h2 className="text-2xl font-bold text-[#1e3a5f] mb-2">
                Number of Tickets
              </h2>
              <p className="text-gray-500 mb-1">
                Selected: {selectedDateStr} at {slotLabel(selectedTimeStr)}
              </p>
              <div className="max-w-xs mx-auto">
                <div className="flex items-center gap-4 mb-6">
                  <button
                    onClick={() => setTicketCount(Math.max(1, ticketCount - 1))}
                    className="w-12 h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center text-xl font-bold text-gray-600 hover:border-[#1e3a5f] transition-colors"
                  >
                    -
                  </button>
                  <div className="flex-1 text-center">
                    <span className="text-4xl font-bold text-[#1e3a5f]">
                      {ticketCount}
                    </span>
                    <p className="text-sm text-gray-500 mt-1">
                      ₹{(ticketCount * pricePerTicket).toLocaleString('en-IN')}
                    </p>
                  </div>
                  <button
                    onClick={() => setTicketCount(Math.min(maxTickets, ticketCount + 1))}
                    disabled={ticketCount >= maxTickets}
                    className="w-12 h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center text-xl font-bold text-gray-600 hover:border-[#1e3a5f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setStep(0)}
                  className="btn-outline flex-1 justify-center"
                >
                  Back
                </button>
                <button
                  onClick={() => handleTicketsNext(ticketCount)}
                  className="btn-primary flex-1 justify-center"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <StepSelectExamCenter
              selectedCenter={examCenter}
              onBack={() => setStep(1)}
              onNext={handleExamCenterNext}
            />
          )}

          {step === 3 && (
            <StepPassengerDetails
              ticketCount={ticketCount}
              pricePerTicket={pricePerTicket}
              onBack={() => setStep(2)}
              onNext={handlePassengersNext}
            />
          )}

          {step === 4 && (
            <StepSummary
              selectedDate={selectedDateStr}
              selectedTime={selectedTimeStr}
              examCenter={examCenter}
              passengers={passengers}
              pricePerTicket={pricePerTicket}
              onBack={() => setStep(3)}
              onProceedToPayment={handleCreateBooking}
              processing={processing}
              error={bookingError}
            />
          )}

          {step === 5 && bookingId && (
            <StepRazorpayPayment
              amount={bookingAmount || passengers.length * pricePerTicket}
              bookingRef={bookingId}
              summary={paymentSummary}
              resumedFromUrl={resumedFromUrl}
              onBack={() => {
                setPaymentError('');
                setProcessing(false);
                setStep(4);
              }}
              onStartOver={handleStartOver}
              onPay={handleRazorpayPayment}
              paymentError={paymentError}
              processing={processing}
            />
          )}
        </div>
      </div>
    </div>
  );
}
