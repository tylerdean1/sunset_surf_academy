const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

function worker(options = {}) {
  const calls = [], sent = [], delays = [];
  const rows = options.rows || [];
  const supabase = {
    async rpc(name, args) {
      calls.push({ name, args });
      return name === 'claim_booking_notifications'
        ? { data: rows, error: options.claimError || null }
        : { data: null, error: options.completeError || null };
    },
    from() {
      return { select() { return { async eq() { return { data: options.statuses || [], error: null }; } }; } };
    },
  };
  const module = { exports: {} };
  const file = path.join(__dirname, '..', 'lib', 'server', 'bookingNotifications.ts');
  const output = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  vm.runInNewContext(output, {
    module, exports: module.exports, Promise,
    console: { info() {}, error() {} },
    setTimeout(callback, duration) { delays.push(duration); callback(); },
    require(name) {
      if (name === '@/lib/supabaseAdmin') return { getSupabaseAdmin: () => supabase };
      if (name === '@/lib/server/bookingEmail') return {
        async sendBookingEmail(kind, payload) {
          sent.push({ kind, bookingId: payload.id });
          return options.deliveries?.[kind] || { status: 'sent', id: `provider-${kind}` };
        },
      };
      throw new Error(`Unexpected dependency: ${name}`);
    },
  }, { filename: file });
  return { run: module.exports.processBookingNotifications, calls, sent, delays };
}

const notification = (index, kind = 'admin') => ({ id: `notification-${index}`, booking_id: `booking-${index}`,
  recipient_kind: kind, lease_token: `lease-${index}`, payload: { id: `booking-${index}` } });

test('partial provider failure persists both lease outcomes and keeps the failed recipient queued', async () => {
  const instance = worker({ rows: [notification(1), notification(1, 'customer')],
    deliveries: { customer: { status: 'failed' } },
    statuses: [{ recipient_kind: 'admin', status: 'sent' }, { recipient_kind: 'customer', status: 'queued' }] });
  const result = await instance.run('booking-1');
  assert.equal(result.admin, 'sent');
  assert.equal(result.customer, 'queued');
  const completed = instance.calls.filter(call => call.name === 'complete_booking_notification');
  assert.equal(completed.length, 2);
  assert.equal(completed[0].args.p_provider_id, 'provider-admin');
  assert.equal(completed[1].args.p_provider_id, null);
  assert.equal(completed[1].args.p_error, 'Provider failed');
  assert.equal(completed[1].args.p_lease_token, 'lease-1');
  assert.equal(instance.calls[0].args.p_booking_id, 'booking-1');
  assert.equal(instance.calls[0].args.p_limit, 2);
});

test('scheduled catch-up claims a bounded batch and spaces pairs without dropping any lease', async () => {
  const instance = worker({ rows: Array.from({ length: 8 }, (_, index) => notification(index)) });
  await instance.run();
  assert.equal(instance.calls[0].args.p_limit, 8);
  assert.equal(instance.calls[0].args.p_booking_id, null);
  assert.equal(instance.sent.length, 8);
  assert.equal(instance.calls.filter(call => call.name === 'complete_booking_notification').length, 8);
  assert.equal(instance.delays.join(','), '1000,1000,1000');
});

test('a failed claim sends no mail, allowing the caller to defer the persisted request', async () => {
  const instance = worker({ claimError: { code: 'transport-failure' } });
  await assert.rejects(instance.run('booking-1'), /Could not claim notifications/);
  assert.equal(instance.sent.length, 0);
});

test('an uncompleted lease is reported as queued rather than falsely claiming a sent notification', async () => {
  const instance = worker({ rows: [notification(1)], completeError: { code: 'transport-failure' },
    statuses: [{ recipient_kind: 'admin', status: 'processing' }] });
  const result = await instance.run('booking-1');
  assert.equal(result.admin, 'queued');
  assert.equal(result.customer, 'queued');
});
