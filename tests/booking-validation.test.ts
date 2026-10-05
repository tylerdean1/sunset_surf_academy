import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOOKING_TIME_LABELS, bookingDateBounds, readBookingJson, validateBookingInput } from '../lib/bookingValidation';

const now = new Date('2026-10-04T16:00:00Z');
const valid = {
  submission_id: '949d6a46-59dc-4e26-b4e8-77e98b0c55cf', customer_name: 'Test Guest',
  customer_email: 'guest@example.com', customer_phone: '9395550100', party_size: 2,
  party_names: ['Guest Two'], requested_date: '2026-10-05', requested_time_labels: ['7:00 AM'],
  requested_lesson_type: 'private', locale: 'en',
};

test('accepts valid request and canonicalizes duplicate unordered times', () => {
  const input = validateBookingInput({ ...valid, requested_time_labels: ['3:30 PM', '7:00 AM', '7:00 AM'] }, now);
  assert.deepEqual(input.requested_time_labels, ['7:00 AM', '3:30 PM']);
  assert.equal(input.notes, '');
  assert.equal(BOOKING_TIME_LABELS.length, 18);
});
for (const [name, patch] of Object.entries({
  'past date': { requested_date: '2020-01-01' }, 'invalid calendar date': { requested_date: '2026-11-31' },
  'too far ahead': { requested_date: '2028-01-01' }, 'impossible time': { requested_time_labels: ['99:99 PM'] },
  'outside hours': { requested_time_labels: ['4:00 PM'] }, 'oversized notes': { notes: 'x'.repeat(2001) },
  'fractional party': { party_size: 1.5 }, 'negative party': { party_size: -1 },
  'too many names': { party_names: ['one', 'two'] }, 'header injection': { customer_name: 'Guest\r\nInjected' },
  'missing retry key': { submission_id: undefined }, 'object contact': { customer_name: {} },
})) test(`rejects ${name}`, () => assert.throws(() => validateBookingInput({ ...valid, ...patch }, now)));

test('booking day follows Puerto Rico timezone around UTC midnight', () => {
  assert.equal(bookingDateBounds(new Date('2026-10-05T01:00:00Z')).min, '2026-10-04');
});
test('rejects oversized bodies even without content length', async () => {
  const request = new Request('https://example.com/api/booking-requests', { method: 'POST', body: JSON.stringify({ notes: 'x'.repeat(17000) }) });
  await assert.rejects(readBookingJson(request), /too large/);
});
test('rejects malformed JSON', async () => {
  await assert.rejects(readBookingJson(new Request('https://example.com', { method: 'POST', body: '{' })), /Invalid JSON/);
});
