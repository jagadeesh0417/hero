import { validateVehiclesInput, type VehicleInput } from '@/lib/vehicles';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ExamSlotPayload {
  exam_name: string;
  exam_date?: string;
  exam_time?: string;
  reporting_time?: string;
  pickup_location?: string;
  drop_location?: string;
  price?: number;
  status?: string;
  description?: string;
  vehicles?: VehicleInput[];
}

/**
 * Validate an admin exam-slot payload (create or update).
 * Returns an error message or null when valid.
 */
export function validateExamSlotPayload(body: ExamSlotPayload, requireDate: boolean): string | null {
  if (!body.exam_name || !String(body.exam_name).trim()) return 'Exam name is required';
  if (requireDate && (!body.exam_date || !DATE_RE.test(body.exam_date))) {
    return 'A valid exam date (YYYY-MM-DD) is required';
  }
  if (body.exam_date && DATE_RE.test(body.exam_date)) {
    const d = new Date(body.exam_date + 'T00:00:00+05:30');
    if (isNaN(d.getTime())) return 'Exam date is not a valid calendar date';
  }
  if (!body.exam_time || !TIME_RE.test(body.exam_time)) return 'A valid exam time (HH:MM) is required';
  if (body.reporting_time && !TIME_RE.test(body.reporting_time)) {
    return 'Reporting time must be a valid time (HH:MM)';
  }
  if (body.reporting_time && body.exam_time && body.reporting_time > body.exam_time) {
    return 'Reporting time cannot be after the exam time';
  }
  const price = Number(body.price ?? 0);
  if (isNaN(price) || price < 0) return 'Ticket price cannot be negative';
  if (body.status && body.status !== 'open' && body.status !== 'closed') {
    return 'Status must be Open or Closed';
  }
  return validateVehiclesInput(body.vehicles || []);
}
