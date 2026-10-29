import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { getSupporterCounts, START_MS } from '../lib/calendar-status.mjs';

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
      removeAttribute: name => { delete attributes[name]; },
      classList: { toggle: (name, on) => on ? classes.add(name) : classes.delete(name), remove: name => classes.delete(name) },
    };
  });
  const initialLinks = links.map(link => link.attributes.href);
  let nextRefresh;
  let reply = { supporterCounts: getSupporterCounts([plan], scope) };
  let fail = false;
  vm.runInNewContext(source, {
    document: { querySelector: selector => selector === '.calendar-legend' ? legend : message, querySelectorAll: () => links },
    window: { setTimeout: (callback, delay) => { assert.equal(delay, 60000); nextRefresh = callback; } },
    AbortSignal,
    fetch: async url => { assert.equal(url, '/api/calendar-status'); return { ok: !fail, json: async () => reply }; },
  });
  await new Promise(resolve => setImmediate(resolve));
  const filled = () => links.flatMap((link, index) => [...link.classes].some(c => c.startsWith('supporters-')) ? [index + 1] : []);
  assert.deepEqual(filled(), [2]);
  assert.match(links[1].attributes['aria-label'], /^1 monthly supporter\./);
  assert.equal(legend.hidden, false);

  reply = { supporterCounts: getSupporterCounts([{ ...plan, status: 'canceled' }], scope) };
  await nextRefresh();
  assert.deepEqual(filled(), []);
  assert.match(links[1].attributes['aria-label'], /^0 monthly supporters\./);

  reply = { supporterCounts: { 2: 1, 21: 2, 31: 3 } };
  await nextRefresh();
  assert.ok(links[1].classes.has('supporters-1'));
  assert.ok(links[20].classes.has('supporters-2'));
  assert.ok(links[30].classes.has('supporters-3'));
  reply = { supporterCounts: { 2: 1, 21: 2, 31: 5 } };
  await nextRefresh();
  assert.ok(links[30].classes.has('supporters-3'));
  assert.match(links[30].attributes['aria-label'], /^5 monthly supporters\./);
  reply = { supporterCounts: { 2: 1, 21: 2, 31: 2 } };
  await nextRefresh();
  assert.ok(!links[30].classes.has('supporters-3'));
  assert.ok(links[30].classes.has('supporters-2'));
  fail = true;
  await nextRefresh();
  assert.deepEqual(filled(), []);
  assert.equal(legend.hidden, true);
  assert.equal(message.hidden, false);
  assert.match(message.textContent, /unavailable/);
  assert.ok(links.every(link => /^December /.test(link.attributes['aria-label'])));

  fail = false;
  await nextRefresh();
  assert.deepEqual(filled(), [2, 21, 31]);
  assert.equal(message.hidden, true);
  assert.equal(legend.hidden, false);
  assert.deepEqual(links.map(link => link.attributes.href), initialLinks);

  // Every amount visits all levels independently, including Santa appearing at
  // three, remaining above three, and disappearing when the count decreases.
  const levels = [0, 1, 2, 3, 5, 2, 0];
  for (let step = 0; step < levels.length; step++) {
    const counts = Object.fromEntries(links.map((_, index) => [index + 1, levels[(index + step) % levels.length]]));
    reply = { supporterCounts: counts };
    await nextRefresh();
    for (const [index, link] of links.entries()) {
      const count = counts[index + 1];
      assert.deepEqual([...link.classes], count ? [`supporters-${Math.min(count, 3)}`] : [], `Day ${index + 1}, count ${count}`);
      assert.equal(link.attributes.title, `${count} monthly supporter${count === 1 ? '' : 's'}`);
      assert.ok(link.attributes['aria-label'].startsWith(`${link.attributes.title}. December ${index + 1}:`));
      assert.equal(link.attributes.href, initialLinks[index]);
    }
  }
});
