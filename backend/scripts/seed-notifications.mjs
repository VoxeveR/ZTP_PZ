// Creates sample notifications through the running API so the Prometheus metrics change over the next minute.
// Usage (API running on API_URL, default http://127.0.0.1:8000): npm run notifications:seed
const api = (process.env.API_URL ?? 'http://127.0.0.1:8000').replace(/\/+$/, '');
const url = `${api}/api/v1/notifications`;
const run = Date.now().toString(36);

const inSeconds = (seconds) => new Date(Date.now() + seconds * 1000).toISOString();

async function create(body, headers = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ timezone: 'Europe/Warsaw', ...body }),
  });
  const json = await response.json();
  if (!response.ok) throw new Error(`POST ${response.status}: ${JSON.stringify(json)}`);
  return { status: response.status, notification: json };
}

const samples = [
  {
    label: 'EMAIL, due in 10 s',
    body: {
      channel: 'EMAIL',
      recipient: 'klient1@example.com',
      content: 'Keyboard1 is back in stock',
      scheduledAt: inSeconds(10),
    },
  },
  {
    label: 'PUSH, due in 15 s',
    body: { channel: 'PUSH', recipient: 'ztp-demo', content: 'Price drop on Laptop', scheduledAt: inSeconds(15) },
  },
  {
    label: 'EMAIL, due in 20 s',
    body: {
      channel: 'EMAIL',
      recipient: 'klient2@example.com',
      content: 'Your order has shipped',
      scheduledAt: inSeconds(20),
    },
  },
  {
    label: 'PUSH, due in 25 s, invalid topic -> FAILED',
    body: {
      channel: 'PUSH',
      recipient: 'invalid topic!',
      content: 'This push cannot be delivered',
      scheduledAt: inSeconds(25),
    },
  },
  {
    label: 'PUSH, due in 30 s',
    body: { channel: 'PUSH', recipient: 'ztp-demo', content: 'New category: Books', scheduledAt: inSeconds(30) },
  },
  {
    label: 'EMAIL, due in 1 h (stays PENDING)',
    body: {
      channel: 'EMAIL',
      recipient: 'klient3@example.com',
      content: 'Weekly summary',
      scheduledAt: inSeconds(3600),
    },
  },
  {
    label: 'PUSH, due in 1 h, then CANCELLED',
    body: { channel: 'PUSH', recipient: 'ztp-demo', content: 'Cancelled promotion', scheduledAt: inSeconds(3600) },
    cancel: true,
  },
];

try {
  for (const sample of samples) {
    const { notification } = await create(sample.body);
    if (sample.cancel) {
      const response = await fetch(`${url}/${notification.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'CANCELLED' }),
      });
      if (!response.ok) throw new Error(`PATCH ${response.status}`);
    }
    console.log(`#${notification.id}  ${sample.label}`);
  }

  // The same request twice with one Idempotency-Key: the second call returns the first notification.
  const key = `seed-${run}`;
  const body = {
    channel: 'EMAIL',
    recipient: 'klient4@example.com',
    content: 'Sent once despite a retry',
    scheduledAt: inSeconds(35),
  };
  const first = await create(body, { 'Idempotency-Key': key });
  const retry = await create(body, { 'Idempotency-Key': key });
  console.log(
    `#${first.notification.id}  EMAIL, due in 35 s, Idempotency-Key ${key}: first ${first.status}, retry ${retry.status} -> #${retry.notification.id}`,
  );
} catch (error) {
  console.error(`Seeding failed: ${error instanceof Error ? error.message : String(error)}`);
  console.error(`Is the API running on ${api}? Start it with: npm run start:dev`);
  process.exitCode = 1;
}

console.log(`\nWatch the metrics change: ${api}/metrics and http://localhost:9090 (e.g. notifications_by_channel)`);
