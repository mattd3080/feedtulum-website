import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { getFilledDays, START_MS } from '../lib/calendar-status.mjs';

const source = await readFile(new URL('../giving-calendar/status.js', import.meta.url), 'utf8');

test('a paid $2 plan fills square 2; cancellation, outages and recovery update the UI without changing links', async () => {
  const scope = { accountId: 'act_test', campaignId: 'cmp_test', nowMs: START_MS + 1000 };
  const plan = {
    id: 'sub_test', account: { id: scope.accountId }, campaign: { id: scope.campaignId },
    created: START_MS, status: 'active', livemode: true, currency: 'usd', recurring_frequency: '1.month',
    amount_in_cents: 242, meta_data: { 'base-amount': 200, 'donor-pays-fees': 42 },
    donation_parent: { status: 'processed', livemode: true, recurring: true, refunded: null },
  };
  const legend = { hidden: true };
  const message = { hidden: true, textContent: '' };
  const links = Array.from({ length: 31 }, (_, index) => {
    const day = index + 1;
    const attributes = { 'aria-label': `December ${day}: Give ${day} US dollars a month`, href: `https://pages.donately.com/feedtulum/campaign/feed-tulum/donate?amount=${day}&recurring-frequency=1.month` };
    const classes = new Set();
    return {
      attributes, classes,
      querySelector: () => ({ textContent: String(day) }),
      getAttribute: name => attributes[name],
      setAttribute: (name, value) => { attributes[name] = value; },
      classList: { toggle: (name, on) => on ? classes.add(name) : classes.delete(name), remove: name => classes.delete(name) },
    };
  });
  const initialLinks = links.map(link => link.attributes.href);
  let nextRefresh;
  let reply = { filledDays: getFilledDays([plan], scope) };
  let fail = false;
  vm.runInNewContext(source, {
    document: { querySelector: selector => selector === '.calendar-legend' ? legend : message, querySelectorAll: () => links },
    window: { setTimeout: (callback, delay) => { assert.equal(delay, 60000); nextRefresh = callback; } },
    AbortSignal,
    fetch: async url => { assert.equal(url, '/api/calendar-status'); return { ok: !fail, json: async () => reply }; },
  });
  await new Promise(resolve => setImmediate(resolve));
  const filled = () => links.flatMap((link, index) => link.classes.has('is-filled') ? [index + 1] : []);
  assert.deepEqual(filled(), [2]);
  assert.match(links[1].attributes['aria-label'], /^Filled\./);
  assert.equal(legend.hidden, false);

  reply = { filledDays: getFilledDays([{ ...plan, status: 'canceled' }], scope) };
  await nextRefresh();
  assert.deepEqual(filled(), []);
  assert.match(links[1].attributes['aria-label'], /^Available\./);

  reply = { filledDays: [2, 21, 31] };
  await nextRefresh();
  fail = true;
  await nextRefresh();
  assert.deepEqual(filled(), []);
  assert.equal(legend.hidden, true);
  assert.equal(message.hidden, false);
  assert.match(message.textContent, /unavailable/);
  assert.ok(links.every(link => !/^(Filled|Available)\./.test(link.attributes['aria-label'])));

  fail = false;
  await nextRefresh();
  assert.deepEqual(filled(), [2, 21, 31]);
  assert.equal(message.hidden, true);
  assert.equal(legend.hidden, false);
  assert.deepEqual(links.map(link => link.attributes.href), initialLinks);
});
