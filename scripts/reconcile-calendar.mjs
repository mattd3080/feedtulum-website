import { pathToFileURL } from 'node:url';
import { ACCOUNT, CAMPAIGN, normalizeEvent } from '../lib/calendar-events.mjs';

// Input is passed through stdin, never command-line arguments or secret files.
// Only use snapshots whose current status was verified in Donately's dashboard.
export function prepareReconciliation(input, now = Date.now()) {
  const url = new URL(input.receiverUrl);
  if (url.origin !== 'https://www.feedtulum.com' || url.pathname !== '/api/donately-webhook' || url.username || url.password ||
      !/^[a-f0-9]{64}$/.test(url.searchParams.get('token') ?? '')) throw new Error('Invalid receiver');
  if (!Array.isArray(input.snapshots) || !input.snapshots.length || input.snapshots.length > 500) throw new Error('Invalid snapshot batch');
  return input.snapshots.map(s => {
    const observedAt = Date.parse(s.observedAt);
    const created = typeof s.created === 'number' ? s.created : Date.parse(s.created);
    if (!Number.isFinite(observedAt) || observedAt > now || now - observedAt > 3600000 ||
        !Number.isFinite(created) || created > now || created < 0 || s.verifiedLive !== true) throw new Error('Snapshot needs a recent dashboard verification');
    const record = { id:s.id, created, updated:observedAt, status:s.status, livemode:true,
      amount_in_cents:s.amount_in_cents, currency:s.currency,
      account:{id:ACCOUNT}, campaign:{id:CAMPAIGN} };
    if (!Number.isInteger(s.amount_in_cents) || s.amount_in_cents <= 0 || s.currency !== 'usd') throw new Error('Invalid verified amount');
    if (s.personId) record.person = {id:s.personId};
    if (Number.isInteger(s.baseAmount) && Number.isInteger(s.fees)) record.meta_data = {'base-amount':s.baseAmount,'donor-pays-fees':s.fees};
    let event;
    if (s.kind === 'subscription') {
      if (!['active','canceled','paused','suspended','failed','cancelled'].includes(s.status)) throw new Error('Unknown plan status');
      if (s.parentId) record.donation_parent_id = s.parentId;
      event = 'account.subscription.update.success';
    } else if (s.kind === 'payment') {
      if (!['processed','pending','failed','refunded'].includes(s.status) || s.verifiedRecurring !== true || typeof s.refunded !== 'boolean') throw new Error('Unknown payment status');
      record.recurring = true;
      record.refunded = s.refunded;
      record.subscription = {id:s.subscriptionId};
      event = 'account.donation.update.success';
    } else throw new Error('Unknown snapshot kind');
    normalizeEvent({object_data:record}, event, now);
    const target = new URL(url.origin + url.pathname);
    target.searchParams.set('token',url.searchParams.get('token'));
    target.searchParams.set('event',event);
    return {url:target.href,body:{object_data:record}};
  });
}

export async function reconcile(input, send = fetch) {
  const requests = prepareReconciliation(input);
  let completed = 0;
  for (const request of requests) {
    try {
      const response = await send(request.url, {method:'POST',redirect:'error',headers:{'Content-Type':'application/json'},body:JSON.stringify(request.body),signal:AbortSignal.timeout(20000)});
      if (!response.ok || (await response.json()).received !== true) throw new Error('Rejected');
      completed++;
    } catch {
      throw new Error(`Reconciliation stopped: ${completed}/${requests.length} snapshots saved. Verify and retry the remaining batch.`);
    }
  }
  return {saved:completed};
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    let raw='';
    for await (const chunk of process.stdin) {
      raw+=chunk;
      if (Buffer.byteLength(raw)>1048576) throw new Error('Oversized input');
    }
    console.log(JSON.stringify(await reconcile(JSON.parse(raw))));
  } catch (error) {
    // Parsing/URL errors can contain input; print only our fixed failure message.
    console.error(error.message.startsWith('Reconciliation stopped:') ? error.message : 'Invalid reconciliation input; no secret details logged.');
    process.exitCode=1;
  }
}
