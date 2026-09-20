export interface Admin {
  id: number;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface DateRecord {
  id: number;
  date: string;
  created_at: string;
}

export interface Slot {
  id: number;
  date_id: number;
  time: string;
  capacity: number;
  available: number;
  enabled: number;
  created_at: string;
}

export interface Booking {
  id: number;
  booking_id: string;
  date_id: number;
  slot_id: number;
  passenger_count: number;
  amount: number;
  payment_status: string;
  payment_id: string;
  utr_number: string;
  created_at: string;
  date?: string;
  time?: string;
}

export interface Passenger {
  id: number;
  booking_id: string;
  name: string;
  mobile: string;
  gender: string;
  created_at: string;
}

export interface BookingWithDetails extends Booking {
  passengers: Passenger[];
  date: string;
  time: string;
}
