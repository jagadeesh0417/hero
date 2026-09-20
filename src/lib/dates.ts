const IST = 'Asia/Kolkata';

export function parseDateOnly(dateStr: string): Date {
  return new Date(dateStr + 'T00:00:00+05:30');
}

export function formatDateOnly(dateStr: string, options?: Intl.DateTimeFormatOptions): string {
  return parseDateOnly(dateStr).toLocaleDateString('en-IN', { timeZone: IST, ...options });
}

export function formatTimestamp(timestampStr: string, options?: Intl.DateTimeFormatOptions): string {
  const d = new Date(timestampStr.replace(' ', 'T') + 'Z');
  return d.toLocaleString('en-IN', { timeZone: IST, ...options });
}

export function formatShortTimestamp(timestampStr: string): string {
  return formatTimestamp(timestampStr, {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function formatShortDate(dateStr: string): string {
  return formatDateOnly(dateStr, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatLongDate(dateStr: string): string {
  return formatDateOnly(dateStr, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
}

export function formatWeekday(dateStr: string): string {
  return formatDateOnly(dateStr, { weekday: 'long' });
}

export function getISTNow(): Date {
  const now = new Date();
  return new Date(now.toLocaleString('en-US', { timeZone: IST }));
}

export function toISTISOString(date?: Date): string {
  const d = date || new Date();
  return d.toLocaleString('en-CA', { timeZone: IST, hour12: false }).replace(', ', 'T');
}

export function getISTComponents(dateStr: string): { dd: string; mm: string; yyyy: string } {
  const d = parseDateOnly(dateStr);
  const parts = new Intl.DateTimeFormat('en-IN', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const g = (t: string) => parts.find(p => p.type === t)?.value || '';
  return { dd: g('day'), mm: g('month'), yyyy: g('year') };
}

export function getTimestampISTComponents(timestampStr: string): { dd: string; mm: string; yyyy: string } {
  const d = new Date(timestampStr.replace(' ', 'T') + 'Z');
  const parts = new Intl.DateTimeFormat('en-IN', { timeZone: IST, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(d);
  const g = (t: string) => parts.find(p => p.type === t)?.value || '';
  return { dd: g('day'), mm: g('month'), yyyy: g('year') };
}
