'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { format } from 'date-fns';
import { slotLabel, to12h, EXAM_CENTERS } from '@/lib/slots';

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
  today.setHours(0, 0, 0, 0);

  const availableDatesSet = new Set(availableDates.map((d) => d.date));

  const selectedDate = availableDates.find((d) => d.id === selectedDateId);
  const selectedDateObj = selectedDate ? new Date(selectedDate.date) : null;

  const disabledDays = [
    { before: today },
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
              {format(selectedDateObj, 'dd MMMM yyyy')}
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
  onNext,
}: {
  onNext: (dateId: number, slotId: number) => void;
}) {
  const [dates, setDates] = useState<DateOption[]>([]);
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [selectedDateId, setSelectedDateId] = useState<number | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dates')
      .then((r) => r.json())
      .then((data) => {
        const futureDates = (data as DateOption[]).filter(
          (d) => new Date(d.date) >= new Date(new Date().toDateString())
        );
        setDates(futureDates);
        setLoading(false);
      });
  }, []);

  const loadSlots = useCallback(async (dateId: number) => {
    setSelectedSlotId(null);
    const res = await fetch(`/api/slots?date_id=${dateId}`);
    const data = await res.json();
    setSlots(
      (data as SlotOption[]).filter(
        (s) => s.enabled === 1
      )
    );
  }, []);

  const handleDateSelect = (dateId: number) => {
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
      <h2 className="text-2xl font-bold text-[#1e3a5f] mb-6">
        Select Date & Time
      </h2>

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
          {slots.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded-xl">
              <p className="text-gray-500">No slots available for this date</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {slots.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelectedSlotId(s.id)}
                  className={`p-4 rounded-xl border-2 text-left transition-all ${
                    selectedSlotId === s.id
                      ? 'border-[#1e3a5f] bg-[#1e3a5f]/5 shadow-md'
                      : 'border-gray-100 hover:border-gray-200 bg-white'
                  }`}
                >
                  <div className="mb-1">
                    <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">Slot</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-gray-900">{slotLabel(s.time)}</span>
                  </div>
                  {s.vehicle_time && (
                    <div className="mt-2 text-xs text-orange-600 font-medium">
                      Vehicle @ {to12h(s.vehicle_time)}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => selectedDateId && selectedSlotId && onNext(selectedDateId, selectedSlotId)}
        disabled={!selectedDateId || !selectedSlotId}
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
  vehicleTime,
  onBack,
  onNext,
}: {
  ticketCount: number;
  pricePerTicket: number;
  vehicleTime: string;
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
      {vehicleTime && (
        <p className="text-orange-600 text-sm font-medium mb-4">
          Vehicle starts at {to12h(vehicleTime)}
        </p>
      )}

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
  selectedVehicleTime,
  examCenter,
  passengers,
  pricePerTicket,
  onBack,
  onProceedToPayment,
}: {
  selectedDate: string;
  selectedTime: string;
  selectedVehicleTime: string;
  examCenter: string;
  passengers: PassengerForm[];
  pricePerTicket: number;
  onBack: () => void;
  onProceedToPayment: () => void;
}) {
  const total = passengers.length * pricePerTicket;

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-[#1e3a5f] mb-6">
        Booking Summary
      </h2>

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
          {selectedVehicleTime && (
            <div className="flex justify-between">
              <span className="text-gray-500">Vehicle</span>
              <span className="font-semibold text-orange-600">{to12h(selectedVehicleTime)}</span>
            </div>
          )}
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
        <button
          onClick={onProceedToPayment}
          className="btn-primary flex-1 justify-center"
        >
          Proceed to Payment
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function StepRazorpayPayment({
  amount,
  bookingRef,
  onBack,
  onPay,
  onCheckStatus,
  paymentError,
  processing,
  checkingStatus,
}: {
  amount: number;
  bookingRef: string;
  onBack: () => void;
  onPay: () => void;
  onCheckStatus: () => void;
  paymentError: string;
  processing: boolean;
  checkingStatus: boolean;
}) {
  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold text-[#1e3a5f] mb-2">Complete Payment</h2>
      <p className="text-gray-500 mb-8">
        Complete your payment using Razorpay. If you already paid, click "Check Payment Status".
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

      <div className="glass-card p-8 text-center mb-8">
        <div className="w-16 h-16 rounded-2xl bg-[#1e3a5f]/5 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-[#1e3a5f]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
          </svg>
        </div>
        <div className="text-3xl font-bold text-[#1e3a5f] mb-2">
          ₹{amount.toLocaleString('en-IN')}
        </div>
        <p className="text-gray-500">Total Amount</p>
        <p className="text-sm text-gray-400 mt-4">
          Booking Ref: <span className="font-mono font-medium text-gray-600">{bookingRef}</span>
        </p>
      </div>

      <div className="space-y-3">
        <button
          onClick={onPay}
          disabled={processing}
          className="btn-primary w-full justify-center text-lg"
        >
          {processing ? (
            <>
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Opening Razorpay...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
              </svg>
              Pay with Razorpay
            </>
          )}
        </button>

        <button
          onClick={onCheckStatus}
          disabled={checkingStatus}
          className="btn-outline w-full justify-center disabled:opacity-50"
        >
          {checkingStatus ? (
            <>
              <svg className="w-5 h-5 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Checking...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Already Paid? Check Status
            </>
          )}
        </button>

        <button
          onClick={onBack}
          disabled={processing}
          className="btn-outline w-full justify-center disabled:opacity-50"
        >
          Back
        </button>

        <p className="text-xs text-gray-400 text-center">
          Secure payment powered by <span className="font-semibold">Razorpay</span>.
          We support UPI, Credit/Debit Cards, Net Banking, Wallets, and EMI.
        </p>
      </div>
    </div>
  );
}

export default function BookPageClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [step, setStep] = useState(0);
  const [selectedDateId, setSelectedDateId] = useState<number | null>(null);
  const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null);
  const [selectedDateStr, setSelectedDateStr] = useState('');
  const [selectedTimeStr, setSelectedTimeStr] = useState('');
  const [selectedVehicleTimeStr, setSelectedVehicleTimeStr] = useState('');
  const [ticketCount, setTicketCount] = useState(1);
  const maxTickets = 100;
  const [passengers, setPassengers] = useState<PassengerForm[]>([]);
  const [examCenter, setExamCenter] = useState('');
  const [processing, setProcessing] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState('');
  const [settings, setSettings] = useState<{ price_per_ticket: string } | null>(null);
  const [settingsError, setSettingsError] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load settings');
        return r.json();
      })
      .then((data) => setSettings(data as any))
      .catch(() => setSettingsError('Failed to load. Check database connection.'));
  }, []);

  useEffect(() => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    document.body.appendChild(script);
    return () => { document.body.removeChild(script); };
  }, []);

  useEffect(() => {
    const error = searchParams.get('error');
    const bid = searchParams.get('id');
    if (bid) {
      setBookingId(bid);
      setStep(5);
      if (error) {
        if (error === 'payment_failed') {
          setPaymentError('Payment was not completed. Please try again.');
        } else if (error === 'server_error') {
          setPaymentError('A server error occurred. Please try again.');
        } else {
          setPaymentError('Payment could not be processed. Please try again.');
        }
      }
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

  // If user lands on payment step and booking is already confirmed, redirect
  useEffect(() => {
    if (bookingId && step === 5) {
      fetch(`/api/razorpay/status?booking_id=${bookingId}`, { cache: 'no-store' })
        .then((r) => r.json())
        .then((data) => {
          if (data.status === 'confirmed') {
            router.push(`/success?id=${bookingId}`);
          }
        })
        .catch(() => {});
    }
  }, [bookingId, step, router]);

  const pricePerTicket = settings ? Number(settings.price_per_ticket) || 500 : 500;

  const steps = ['Slot', 'Tickets', 'Center', 'Details', 'Summary', 'Payment'];

  const handleSlotNext = async (dateId: number, slotId: number) => {
    setSelectedDateId(dateId);
    setSelectedSlotId(slotId);

    const datesRes = await fetch('/api/dates');
    const dates = await datesRes.json();
    const dateObj = dates.find((d: any) => d.id === dateId);
    if (dateObj) {
      setSelectedDateStr(
        new Date(dateObj.date).toLocaleDateString('en-IN', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })
      );
    }

    const slotsRes = await fetch(`/api/slots?date_id=${dateId}`);
    const slots = await slotsRes.json();
    const slotObj = slots.find((s: any) => s.id === slotId);
    if (slotObj) {
      setSelectedTimeStr(slotObj.time);
      setSelectedVehicleTimeStr(slotObj.vehicle_time || '');
      setTicketCount(1);
    }

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

  const handleCreateBooking = async () => {
    if (!selectedDateId || !selectedSlotId) return;
    setProcessing(true);

    try {
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
        alert(err.error || 'Booking failed');
        setProcessing(false);
        return;
      }

      const booking = await bookingRes.json();
      setBookingId(booking.booking_id);
      setStep(5);
      setProcessing(false);
    } catch (err) {
      console.error('[Booking] handleCreateBooking error:', err);
      alert('Something went wrong. Please try again.');
      setProcessing(false);
    }
  };

  const handleCheckPaymentStatus = async () => {
    if (!bookingId) return;
    setCheckingStatus(true);
    setPaymentError('');

    try {
      const res = await fetch('/api/razorpay/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });

      const data = await res.json();

      if (data.success && data.status === 'confirmed') {
        router.push(`/success?id=${bookingId}`);
      } else if (data.status === 'no_order') {
        setPaymentError('Payment has not been initiated yet. Please click "Pay with Razorpay" to start.');
      } else if (data.status === 'created' || data.status === 'attempted') {
        setPaymentError('Payment is still processing. Please wait or try again in a few seconds.');
      } else {
        setPaymentError(data.error || 'Payment not found. Please try paying again.');
      }
    } catch (err) {
      console.error('[Booking] handleCheckPaymentStatus error:', err);
      setPaymentError('Could not check payment status. Please try again.');
    } finally {
      setCheckingStatus(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (!bookingId) return;
    setProcessing(true);
    setPaymentError('');

    try {
      const res = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ booking_id: bookingId }),
      });

      const data = await res.json();

      if (!res.ok || !data.order_id) {
        setPaymentError(data.error || 'Could not initiate payment. Please try again.');
        setProcessing(false);
        return;
      }

      // Shared state between callbacks to prevent duplicate processing
      let paymentCompleted = false;
      let pollingInterval: ReturnType<typeof setInterval> | null = null;
      let pollingStopped = false;

      const stopPolling = () => {
        pollingStopped = true;
        if (pollingInterval) {
          clearInterval(pollingInterval);
          pollingInterval = null;
        }
      };

      // Start polling as fallback for desktop QR / UPI payments
      // where the Razorpay handler callback may not fire reliably
      const startPolling = () => {
        const startTime = Date.now();
        const maxWait = 5 * 60 * 1000; // 5 minutes

        pollingInterval = setInterval(async () => {
          if (pollingStopped || paymentCompleted) return;
          if (Date.now() - startTime > maxWait) {
            stopPolling();
            if (!paymentCompleted) {
              setPaymentError('Payment verification timed out. Check your booking or contact support.');
              setProcessing(false);
            }
            return;
          }

          try {
            const statusRes = await fetch(`/api/razorpay/status?booking_id=${bookingId}`);
            const statusData = await statusRes.json();

            if (statusData.status === 'confirmed') {
              paymentCompleted = true;
              stopPolling();
              router.push(`/success?id=${bookingId}`);
            } else if (statusData.status === 'failed' || statusData.status === 'error') {
              stopPolling();
              setPaymentError(statusData.error || 'Payment failed. Please try again.');
              setProcessing(false);
            }
          } catch (pollErr) {
            console.error('[Payment] Status polling error:', pollErr);
          }
        }, 3000);
      };

      const options = {
        key: data.key_id,
        amount: data.amount,
        currency: data.currency || 'INR',
        name: 'Suman Travels',
        description: `Booking ${bookingId}`,
        order_id: data.order_id,
        prefill: {
          name: data.customer_name || '',
          contact: data.customer_mobile || '',
        },
        theme: { color: '#1e3a5f' },
        handler: async function (response: any) {
          stopPolling();
          if (paymentCompleted) return; // Prevent duplicate
          paymentCompleted = true;
          setProcessing(true);
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
            router.push(`/success?id=${bookingId}`);
          } else {
            const errData = await verifyRes.json();
            setPaymentError(errData.error || 'Payment verification failed. Please contact support.');
            setProcessing(false);
          }
        },
        modal: {
          ondismiss: function () {
            stopPolling();
            if (!paymentCompleted) {
              setPaymentError('Payment window closed. If money was deducted from your account, click "Already Paid? Check Status" to confirm your booking, or contact support.');
              setProcessing(false);
            }
          },
        },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        stopPolling();
        paymentCompleted = true;
        setPaymentError(response.error?.description || 'Payment failed. Please try again.');
        setProcessing(false);
      });
      rzp.open();
      setProcessing(false);

      // Start polling fallback after modal opens
      startPolling();
    } catch (err) {
      console.error('[Booking] handleRazorpayPayment error:', err);
      setPaymentError('Could not connect to payment gateway. Please try again.');
      setProcessing(false);
    }
  };

  if (settingsError) {
    return (
      <div className="min-h-screen bg-gray-50 py-10 flex items-center justify-center">
        <div className="text-center max-w-md p-8">
          <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Connection Error</h2>
          <p className="text-gray-500 mb-6">{settingsError}</p>
          <button
            onClick={() => window.location.reload()}
            className="btn-primary"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="min-h-screen bg-gray-50 py-10">
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-4 border-[#1e3a5f] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

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
              <StepSelectSlot onNext={handleSlotNext} />
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
              {selectedVehicleTimeStr && (
                <p className="text-orange-600 text-sm font-medium mb-6">
                  Vehicle starts at {to12h(selectedVehicleTimeStr)}
                </p>
              )}
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
                    onClick={() => setTicketCount(ticketCount + 1)}
                    className="w-12 h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center text-xl font-bold text-gray-600 hover:border-[#1e3a5f] transition-colors"
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
              vehicleTime={selectedVehicleTimeStr}
              onBack={() => setStep(2)}
              onNext={handlePassengersNext}
            />
          )}

          {step === 4 && (
            <StepSummary
              selectedDate={selectedDateStr}
              selectedTime={selectedTimeStr}
              selectedVehicleTime={selectedVehicleTimeStr}
              examCenter={examCenter}
              passengers={passengers}
              pricePerTicket={pricePerTicket}
              onBack={() => setStep(3)}
              onProceedToPayment={handleCreateBooking}
            />
          )}

          {step === 5 && bookingId && (
            <StepRazorpayPayment
              amount={passengers.length * pricePerTicket}
              bookingRef={bookingId}
              onBack={() => setStep(4)}
              onPay={handleRazorpayPayment}
              onCheckStatus={handleCheckPaymentStatus}
              paymentError={paymentError}
              processing={processing}
              checkingStatus={checkingStatus}
            />
          )}
        </div>
      </div>
    </div>
  );
}
