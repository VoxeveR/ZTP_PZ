import 'reflect-metadata';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import { DataSource } from 'typeorm';
import { prepareTestDatabase } from './support/test-database.mjs';

// Integration tests for stage 2.2: they deliver through the MailHog and ntfy containers (npm run db:up).
// The worker is off so it cannot race the explicit process-ready calls.
process.env.NOTIFICATION_WORKER_ENABLED = 'false';
const mailhogApi = (process.env.MAILHOG_API_URL ?? 'http://localhost:8025').replace(/\/+$/, '');
const ntfyUrl = (process.env.NTFY_URL ?? 'http://localhost:8088').replace(/\/+$/, '');

const { createApplication, cleanup } = await prepareTestDatabase();
const run = randomUUID().slice(0, 8);
let app;
let url;

before(async () => {
  app = await createApplication();
  await app.listen(0, '127.0.0.1');
  url = `${await app.getUrl()}/api/v1/notifications`;
});

after(async () => {
  try {
    if (app) await app.close();
  } finally {
    await cleanup();
  }
});

/** Local Warsaw wall-clock time `minutes` from now, without an offset, as the client would send it. */
function warsawLocal(minutes) {
  const moment = new Date(Date.now() + minutes * 60_000);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Warsaw',
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(moment)
      .map((part) => [part.type, part.value]),
  );
  const local = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
  moment.setUTCMilliseconds(0);
  return { local, utc: moment.toISOString() };
}

function payload(channel, overrides = {}) {
  const recipient = channel === 'EMAIL' ? `customer-${run}-${randomUUID().slice(0, 6)}@example.com` : `ztp-${run}`;
  return {
    content: `Test ${channel} notification ${randomUUID().slice(0, 6)}`,
    channel,
    recipient,
    scheduledAt: warsawLocal(10).local,
    timezone: 'Europe/Warsaw',
    ...overrides,
  };
}

function post(path, body) {
  return fetch(`${url}${path}`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function create(body) {
  const response = await post('', body);
  assert.equal(response.status, 201);
  return response.json();
}

async function makeDue(id) {
  await app
    .get(DataSource)
    .query(`UPDATE notifications SET scheduled_at = now() - interval '1 minute' WHERE id = $1`, [id]);
}

test('GET returns 200 and a list', async () => {
  const response = await fetch(url);
  assert.equal(response.status, 200);
  assert.ok(Array.isArray(await response.json()));
});

test('POST creates a PENDING notification, stores scheduledAt in UTC and it is visible on GET', async () => {
  const { local, utc } = warsawLocal(10);
  const body = payload('PUSH', { scheduledAt: local });
  const created = await create(body);

  assert.equal(created.status, 'PENDING');
  assert.equal(created.content, body.content);
  assert.equal(created.channel, 'PUSH');
  assert.equal(created.recipient, body.recipient);
  assert.equal(created.timezone, 'Europe/Warsaw');
  assert.equal(created.scheduledAt, utc);
  assert.ok(created.createdAt);

  const list = await (await fetch(url)).json();
  assert.ok(list.some((notification) => notification.id === created.id));
  const fetched = await (await fetch(`${url}/${created.id}`)).json();
  assert.deepEqual(fetched, created);
});

test('GET returns 404 for a missing notification and 400 for an invalid ID', async () => {
  assert.equal((await fetch(`${url}/2147483647`)).status, 404);
  assert.equal((await fetch(`${url}/abc`)).status, 400);
});

test('POST validation: past date, invalid time zone and blank content give 422; missing fields give 400', async () => {
  const past = await post('', payload('PUSH', { scheduledAt: warsawLocal(-5).local }));
  assert.equal(past.status, 422);
  assert.equal((await past.json()).message, 'scheduledAt must be in the future');

  assert.equal((await post('', payload('EMAIL', { timezone: 'Mars/Base' }))).status, 422);
  assert.equal((await post('', payload('EMAIL', { content: '   ' }))).status, 422);

  const withoutTimezone = payload('EMAIL');
  delete withoutTimezone.timezone;
  assert.equal((await post('', withoutTimezone)).status, 400);
  assert.equal((await post('', payload('SMS'))).status, 400);
  assert.equal((await post('', payload('EMAIL', { scheduledAt: 'tomorrow' }))).status, 400);
});

test('send-now delivers a PUSH notification to ntfy and marks it SENT', async () => {
  const created = await create(payload('PUSH'));
  const response = await post(`/${created.id}/send-now`);
  assert.equal(response.status, 200);
  const sent = await response.json();
  assert.equal(sent.status, 'SENT');
  assert.equal((await (await fetch(`${url}/${created.id}`)).json()).status, 'SENT');

  const topic = await (await fetch(`${ntfyUrl}/${created.recipient}/json?poll=1`)).text();
  const messages = topic
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line).message);
  assert.ok(messages.includes(created.content), 'the message should be on the ntfy topic');
});

test('send-now delivers an EMAIL notification to MailHog and marks it SENT', async () => {
  const created = await create(payload('EMAIL'));
  const response = await post(`/${created.id}/send-now`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).status, 'SENT');

  const search = await (
    await fetch(`${mailhogApi}/api/v2/search?kind=to&query=${encodeURIComponent(created.recipient)}`)
  ).json();
  assert.equal(search.total, 1, 'MailHog should hold exactly one message for this recipient');
  assert.match(search.items[0].Content.Body, new RegExp(created.content));
});

test('send-now returns 422 for a notification that is no longer PENDING and 404 for a missing one', async () => {
  const created = await create(payload('PUSH'));
  assert.equal((await post(`/${created.id}/send-now`)).status, 200);

  const second = await post(`/${created.id}/send-now`);
  assert.equal(second.status, 422);
  assert.match((await second.json()).message, /Only PENDING notifications can be sent/);
  assert.equal((await post('/2147483647/send-now')).status, 404);
});

test('process-ready sends only due PENDING notifications', async () => {
  const dueEmail = await create(payload('EMAIL'));
  const duePush = await create(payload('PUSH'));
  const future = await create(payload('PUSH'));
  const cancelled = await create(payload('PUSH'));
  await makeDue(dueEmail.id);
  await makeDue(duePush.id);
  await makeDue(cancelled.id);
  const cancel = await fetch(`${url}/${cancelled.id}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'CANCELLED' }),
  });
  assert.equal(cancel.status, 200);

  const response = await post('/process-ready');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { processedCount: 2 });

  const status = async (id) => (await (await fetch(`${url}/${id}`)).json()).status;
  assert.equal(await status(dueEmail.id), 'SENT');
  assert.equal(await status(duePush.id), 'SENT');
  assert.equal(await status(future.id), 'PENDING');
  assert.equal(await status(cancelled.id), 'CANCELLED');

  assert.deepEqual(await (await post('/process-ready')).json(), { processedCount: 0 });
});
