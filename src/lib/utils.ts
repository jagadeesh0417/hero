import { v4 as uuidv4 } from 'uuid';
import { formatDateOnly, formatTimestamp } from './dates';

export function generateBookingId(): string {
  const prefix = 'ST';
  const suffix = uuidv4().replace(/-/g, '').substring(0, 8).toUpperCase();
  return `${prefix}${suffix}`;
}

export function formatDate(date: string): string {
  return formatDateOnly(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
}

export function formatDateTime(date: string): string {
  return formatTimestamp(date, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
