import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { dbExecute, rowsToObjects, rowToObject } from '@/lib/db';
import { generateBookingDocument } from '@/lib/document';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'utf-8'), Buffer.from(b, 'utf-8'));
  } catch {
    return false;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> }
) {
  const { bookingId } = await params;
  const { searchParams } = new URL(_request.url);
  const token = searchParams.get('t');

  if (!token) {
    return NextResponse.json({ error: 'Token required' }, { status: 401 });
  }

  try {
    // Fetch booking with passenger details
    const bookingResult = await dbExecute(
      `SELECT b.*, d.date, s.time, s.vehicle_time
       FROM bookings b
       JOIN dates d ON b.date_id = d.id
       JOIN slots s ON b.slot_id = s.id
       WHERE b.booking_id = ?`,
      [bookingId]
    );
    const booking = rowToObject(bookingResult);

    if (!booking) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Token gate
    const storedToken = (booking.receipt_token as string) || '';
    if (!storedToken || !timingSafeEqual(token, storedToken)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Must be confirmed to issue a receipt
    if (booking.payment_status !== 'confirmed') {
      return NextResponse.json({ status: 'pending', error: 'Payment not yet confirmed' }, { status: 409 });
    }

    // Fetch passengers
    const passengersResult = await dbExecute(
      'SELECT * FROM passengers WHERE booking_id = ? ORDER BY id',
      [bookingId]
    );
    const passengers = rowsToObjects(passengersResult) as any[];

    // Build document data
    const docData = {
      bookingId: booking.booking_id as string,
      paymentStatus: booking.payment_status as string,
      serialNumber: booking.serial_number ? Number(booking.serial_number) : undefined,
      date: booking.date as string,
      time: booking.time as string,
      vehicleTime: (booking.vehicle_time as string) || undefined,
      examCenter: (booking.exam_center as string) || undefined,
      vehicleType: (booking.vehicle_type as string) || undefined,
      vehicleNumber: (booking.vehicle_number as string) || undefined,
      vehicleDepartureTime: (booking.vehicle_departure_time as string) || undefined,
      vehicleArrivalTime: (booking.vehicle_arrival_time as string) || undefined,
      passengerCount: Number(booking.passenger_count),
      amount: Number(booking.amount),
      razorpayPaymentId: (booking.razorpay_payment_id as string) || undefined,
      razorpayStatus: (booking.razorpay_status as string) || undefined,
      razorpayMethod: (booking.razorpay_method as string) || undefined,
      razorpayBankRef: (booking.razorpay_bank_ref as string) || undefined,
      paymentTimestamp: (booking.payment_timestamp as string) || undefined,
      passengers: passengers.map((p: any) => ({
        name: p.name,
        mobile: p.mobile,
        gender: p.gender,
      })),
    };

    // Generate .docx on-demand, fresh from DB
    const buffer = await generateBookingDocument(docData);

    const dateObj = new Date(booking.date as string);
    const dd = String(dateObj.getDate()).padStart(2, '0');
    const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
    const yyyy = dateObj.getFullYear();

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'Content-Disposition': `attachment; filename="Receipt-${bookingId}-${dd}-${mm}-${yyyy}.docx"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err: any) {
    console.error('[Receipt] Error:', err?.name, err?.message, err?.stack);
    return NextResponse.json({ error: 'Failed to generate receipt' }, { status: 500 });
  }
}