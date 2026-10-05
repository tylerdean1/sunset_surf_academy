export const MAX_BOOKING_BYTES = 16 * 1024;
export const BOOKING_TIME_LABELS = Array.from({ length: 18 }, (_, index) => {
  const hour = 7 + Math.floor(index / 2);
  return `${hour % 12 || 12}:${index % 2 ? '30' : '00'} ${hour < 12 ? 'AM' : 'PM'}`;
});

export function bookingDateBounds(now = new Date()) {
  const min = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Puerto_Rico', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(now);
  const end = new Date(`${min}T12:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 365);
  return { min, max: end.toISOString().slice(0, 10) };
}
export type BookingInput = {
  submission_id: string; customer_name: string; customer_email: string; customer_phone: string;
  party_size: number; party_names: string[]; requested_date: string; requested_time_labels: string[];
  requested_lesson_type: string; notes: string; locale: 'en' | 'es';
};
export class BookingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingValidationError';
    Object.setPrototypeOf(this, BookingValidationError.prototype);
  }
}
export function validateBookingInput(value: unknown, now = new Date()): BookingInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BookingValidationError('Invalid request');
  const body = value as Record<string, unknown>;
  const string = (key: string, max: number, required = true) => {
    const raw = body[key];
    if (raw == null && !required) return '';
    if (typeof raw !== 'string') throw new BookingValidationError(`Invalid ${key}`);
    const result = raw.trim();
    if ((required && !result) || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result)) throw new BookingValidationError(`Invalid ${key}`);
    return result;
  };
  const submission_id = string('submission_id', 36);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submission_id)) throw new BookingValidationError('Invalid submission ID');
  const customer_name = string('customer_name', 160);
  const customer_email = string('customer_email', 254).toLowerCase();
  const customer_phone = string('customer_phone', 40);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer_email) || /[\r\n]/.test(customer_name + customer_email + customer_phone)) throw new BookingValidationError('Please enter valid contact details');
  if (customer_phone.replace(/\D/g, '').length < 7) throw new BookingValidationError('Please enter a valid phone number');
  const requested_date = string('requested_date', 10);
  const date = new Date(`${requested_date}T12:00:00Z`);
  const bounds = bookingDateBounds(now);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requested_date) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== requested_date || requested_date < bounds.min || requested_date > bounds.max) throw new BookingValidationError('Choose a valid date within the next year');
  const party_size = body.party_size;
  if (typeof party_size !== 'number' || !Number.isInteger(party_size) || party_size < 1 || party_size > 30) throw new BookingValidationError('Party size must be between 1 and 30');
  if (!Array.isArray(body.requested_time_labels) || !body.requested_time_labels.length || body.requested_time_labels.length > 18 || body.requested_time_labels.some(label => typeof label !== 'string' || !BOOKING_TIME_LABELS.includes(label))) throw new BookingValidationError('Choose a time between 7:00 AM and 3:30 PM');
  const requested_time_labels = Array.from(new Set(body.requested_time_labels as string[])).sort((a, b) => BOOKING_TIME_LABELS.indexOf(a) - BOOKING_TIME_LABELS.indexOf(b));
  const names = body.party_names ?? [];
  if (!Array.isArray(names) || names.length > party_size - 1 || names.some(name => typeof name !== 'string' || name.length > 160 || /[\r\n\u0000]/.test(name))) throw new BookingValidationError('Please check the additional guest names');
  const requested_lesson_type = string('requested_lesson_type', 100);
  const notes = string('notes', 2000, false);
  return { submission_id, customer_name, customer_email, customer_phone, party_size, party_names: names.map(name => name.trim()).filter(Boolean), requested_date, requested_time_labels, requested_lesson_type, notes, locale: body.locale === 'es' ? 'es' : 'en' };
}
export async function readBookingJson(req: Request): Promise<unknown> {
  if (!req.body) throw new BookingValidationError('Missing request body');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const part = await reader.read();
    if (part.done) break;
    size += part.value.byteLength;
    if (size > MAX_BOOKING_BYTES) { await reader.cancel(); throw new BookingValidationError('Request is too large'); }
    chunks.push(part.value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new BookingValidationError('Invalid JSON body'); }
}
