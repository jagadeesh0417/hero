export const EXAM_CENTERS = [
  'G. Pulla Reddy Engineering College',
  'Brindavan Institute of Technology & Science',
  'K. V. Subba Reddy Institute of Technology',
  'Poojya Educational Society',
  'Unidid Technology, Sanath Nagar, Kurnool',
];

export const EXAM_TIMINGS = [
  { label: 'Slot 1 – 07:30 AM', value: '07:30' },
  { label: 'Slot 2 – 10:30 AM', value: '10:30' },
  { label: 'Slot 3 – 01:00 PM', value: '13:00' },
  { label: 'Slot 4 – 03:30 PM', value: '15:30' },
];

export const SLOT_LABEL_MAP = Object.fromEntries(EXAM_TIMINGS.map((t) => [t.value, t.label]));

export function slotLabel(time: string): string {
  return SLOT_LABEL_MAP[time] || time;
}

export function to12h(time: string): string {
  if (!time) return '';
  const parts = time.split(':');
  if (parts.length < 2) return time;
  const h = parseInt(parts[0], 10);
  const m = parts[1];
  if (isNaN(h)) return time;
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 || 12;
  return `${h12}:${m} ${ampm}`;
}
