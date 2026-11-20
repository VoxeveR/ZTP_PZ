// Captures the evidence for the lab 2 report from a real run: the app on port 8000 (so Prometheus can scrape it)
// on a throwaway database with the worker on, driven through Swagger UI, ntfy, MailHog and Prometheus in Chrome.
// Usage, from the repo root, with `npm run db:up` done and nothing else on port 8000:
//   node docs/reports/sprawozdanie_projekt_2/capture-evidence.cjs
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const root = path.resolve(__dirname, '..', '..', '..');
const backend = path.join(root, 'backend');
const deps = path.join(process.env.TEMP, 'ztp-report-tools', 'node_modules');
const { chromium } = require(path.join(deps, 'playwright'));
const sharp = require(path.join(deps, 'sharp'));
const backendRequire = createRequire(path.join(backend, 'package.json'));
backendRequire('reflect-metadata');
const { DataSource } = backendRequire('typeorm');
const assets = path.join(__dirname, 'assets');
const run = promisify(execFile);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// A topic per run, so the ntfy screenshot shows only this run's message.
const topic = `ztp-sprawozdanie-${Date.now().toString(36)}`;

/** Records the application's log lines (the worker's in particular) for the report. */
class RecordingLogger {
  constructor() { this.lines = []; }
  write(level, message, context) {
    const line = `${new Date().toISOString()} ${level.padEnd(5)} [${context ?? ''}] ${message}`;
    this.lines.push(line);
  }
  log(m, c) { this.write('LOG', m, c); }
  warn(m, c) { this.write('WARN', m, c); }
  error(m, c) { this.write('ERROR', m, c); }
  debug() {}
  verbose() {}
}

/** Warsaw wall-clock time `seconds` from now, without an offset, as a client would type it. */
function warsawLocal(seconds) {
  const moment = new Date(Date.now() + seconds * 1000);
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Warsaw', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(moment).map((p) => [p.type, p.value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}`;
}

(async () => {
  const runStart = Date.now();
  fs.mkdirSync(assets, { recursive: true });
  process.chdir(backend);
  process.env.NOTIFICATION_WORKER_ENABLED = 'true';
  process.env.NOTIFICATION_WORKER_INTERVAL_MS = '5000';
  const { prepareTestDatabase } = await import(pathToFileURL(path.join(backend, 'test/support/test-database.mjs')));
  const { createApplication, cleanup } = await prepareTestDatabase();
  const logger = new RecordingLogger();
  let app, browser;
  let completed = false;
  try {
    app = await createApplication();
    app.useLogger(logger);
    await app.listen(8000, '127.0.0.1');
    const base = 'http://127.0.0.1:8000';
    const database = app.get(DataSource);
    const schema = await database.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable, column_default
      FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'notifications'
      ORDER BY ordinal_position`);
    const constraints = await database.query(`
      SELECT conname, pg_get_constraintdef(oid) AS definition FROM pg_constraint
      WHERE conrelid = 'notifications'::regclass ORDER BY conname`);
    const indexes = await database.query(`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'notifications' ORDER BY indexname`);
    fs.writeFileSync(path.join(__dirname, 'database-schema.json'), JSON.stringify({ schema, constraints, indexes }, null, 2));

    browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
    const page = await browser.newPage({ viewport: { width: 1060, height: 900 }, deviceScaleFactor: 1.5 });
    const evidence = { base, database: process.env.DB_NAME, topic, capturedAt: new Date().toISOString(), cases: [], screens: [] };
    const save = () => fs.writeFileSync(path.join(__dirname, 'evidence.json'), JSON.stringify(evidence, null, 2));
    const css = (showHeaders) => `
      .swagger-ui .curl-command, .swagger-ui .response-controls,
      .swagger-ui .responses-table:not(.live-responses-table),
      .swagger-ui .response-col_links, .swagger-ui .download-contents {display:none!important}
      .swagger-ui .responses-inner {padding:12px!important}
      .swagger-ui .responses-inner > h4 {display:none!important}
      ${showHeaders ? '' : '.swagger-ui .response-col_description > .headers-wrapper {display:none!important}'}
      .swagger-ui .live-responses-table .response-col_description > div:has(> pre.microlight) {display:none!important}
      .swagger-ui .responses-wrapper > .opblock-section-header {display:none!important}
      .swagger-ui .response-col_description > h5 {display:none!important}
      .swagger-ui .opblock-summary-path {font-size:19px!important}
      .swagger-ui .highlight-code pre, .swagger-ui .microlight {font-size:17px!important; line-height:1.4!important}
      .swagger-ui .highlight-code pre {max-height:none!important}
      .swagger-ui .highlight-code {max-height:470px;overflow:hidden}
      .swagger-ui .response-col_status {font-size:19px!important}
      .swagger-ui .opblock {box-shadow:none!important}`;

    // One Swagger UI operation, like a user: expand, Try it out, fill in, Execute; screenshot header + response.
    async function swagger(key, method, route, { body, id, headers = {}, expectedStatus, showHeaders = false, docs = 'notifications-docs' }) {
      await page.goto(`${base}/${docs}`, { waitUntil: 'networkidle' });
      await page.addStyleTag({ content: css(showHeaders) });
      const op = page.locator('.opblock')
        .filter({ has: page.locator('.opblock-summary-method', { hasText: new RegExp(`^${method}$`) }) })
        .filter({ has: page.locator(`.opblock-summary-path[data-path="${route}"]`) });
      if (await op.count() !== 1) throw new Error(`Operation locator ${key}: ${await op.count()}`);
      await op.locator('button.opblock-summary-control').click();
      await op.getByRole('button', { name: 'Try it out', exact: true }).click();
      if (id !== undefined) await op.locator('tr[data-param-name="id"] input').fill(String(id));
      for (const [name, value] of Object.entries(headers)) await op.locator(`tr[data-param-name="${name}"] input`).fill(value);
      if (body !== undefined) await op.locator('textarea.body-param__text').fill(JSON.stringify(body, null, 2));
      const target = `${base}${route.replace('{id}', String(id))}`;
      const received = page.waitForResponse((r) => r.url() === target && r.request().method() === method);
      await op.getByRole('button', { name: 'Execute', exact: true }).click();
      const response = await received;
      const text = await response.text();
      let responseBody;
      try { responseBody = JSON.parse(text); } catch { responseBody = text; }
      if (response.status() !== expectedStatus) throw new Error(`${key}: expected ${expectedStatus}, got ${response.status()}: ${text}`);
      await op.locator('.live-responses-table').waitFor();
      const head = await op.locator('.opblock-summary').screenshot();
      const live = await op.locator('.responses-wrapper').screenshot();
      const mh = await sharp(head).metadata();
      const ml = await sharp(live).metadata();
      const out = path.join(assets, `${key}.png`);
      await sharp({ create: { width: Math.max(mh.width, ml.width), height: mh.height + ml.height + 12, channels: 3, background: '#ffffff' } })
        .composite([{ input: head, top: 0, left: 0 }, { input: live, top: mh.height + 12, left: 0 }]).png().toFile(out);
      evidence.cases.push({ key, method, route, requestBody: body, id, headers, status: response.status(),
        responseHeaders: response.headers(), responseBody, image: `assets/${key}.png` });
      save();
      console.log(`${key}: HTTP ${response.status()}`);
      return responseBody;
    }
    // Prometheus polls continuously and never reaches networkidle, so its pages wait for `load`.
    async function screen(key, url, { wait = 1500, clip, fullPage = false, action, waitUntil = 'networkidle' } = {}) {
      await page.goto(url, { waitUntil });
      if (action) await action();
      await page.waitForTimeout(wait);
      await page.screenshot({ path: path.join(assets, `${key}.png`), fullPage, clip });
      evidence.screens.push({ key, url, image: `assets/${key}.png` });
      save();
      console.log(`${key}: ${url}`);
    }
    const until = async (check, timeoutMs, label) => {
      const end = Date.now() + timeoutMs;
      while (Date.now() < end) { if (await check()) return; await sleep(1000); }
      throw new Error(`Timed out waiting for ${label}`);
    };
    const statusOf = async (id) => (await (await fetch(`${base}/api/v1/notifications/${id}`)).json()).status;

    // 2. Interactive documentation: the three Swagger pages.
    await page.setViewportSize({ width: 1060, height: 1250 });
    await screen('docs-notifications', `${base}/notifications-docs`, { clip: { x: 0, y: 0, width: 1060, height: 1180 } });
    await screen('docs-products', `${base}/products-docs`, { clip: { x: 0, y: 0, width: 1060, height: 1100 } });
    await page.setViewportSize({ width: 1060, height: 900 });

    // 3.3 Channels: notifications scheduled 25 s ahead in Warsaw local time, sent by the worker.
    const scheduledLocal = warsawLocal(25);
    const push = await swagger('01-post-push-scheduled', 'POST', '/api/v1/notifications', { expectedStatus: 201,
      body: { content: 'Produkt Keyboard1 znów dostępny w magazynie', channel: 'PUSH', recipient: topic, scheduledAt: scheduledLocal, timezone: 'Europe/Warsaw' } });
    const mail = await swagger('02-post-email-scheduled', 'POST', '/api/v1/notifications', { expectedStatus: 201,
      body: { content: 'Twoje zamówienie produktu Laptop zostało wysłane.', channel: 'EMAIL', recipient: 'klient@example.com', scheduledAt: scheduledLocal, timezone: 'Europe/Warsaw' } });
    evidence.scheduled = { local: scheduledLocal, utc: push.scheduledAt, pushId: push.id, emailId: mail.id };
    await until(async () => (await statusOf(push.id)) === 'SENT' && (await statusOf(mail.id)) === 'SENT', 60_000, 'worker delivery');
    evidence.scheduled.sentObservedAt = new Date().toISOString();
    await swagger('03-get-push-sent', 'GET', '/api/v1/notifications/{id}', { id: push.id, expectedStatus: 200 });
    await swagger('04-get-email-sent', 'GET', '/api/v1/notifications/{id}', { id: mail.id, expectedStatus: 200 });
    await screen('ntfy-topic', `http://localhost:8088/${topic}`, { wait: 3500 });
    await screen('mailhog-message', 'http://localhost:8025', { wait: 1500, action: async () => {
      await page.waitForTimeout(1500);
      // Newest first: the e-mail the worker has just sent.
      await page.locator('.msglist-message').first().click();
    } });

    // 3.2 State machine: allowed and rejected transitions.
    const future = await (await fetch(`${base}/api/v1/notifications`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: 'Promocja na kategorię Books', channel: 'EMAIL', recipient: 'klient@example.com', scheduledAt: '2027-06-01T10:00:00', timezone: 'Europe/Warsaw' }) })).json();
    await swagger('05-patch-cancelled', 'PATCH', '/api/v1/notifications/{id}/status', { id: future.id, body: { status: 'CANCELLED' }, expectedStatus: 200 });
    await swagger('06-patch-final-422', 'PATCH', '/api/v1/notifications/{id}/status', { id: future.id, body: { status: 'SENT' }, expectedStatus: 422 });
    await swagger('07-send-now-not-pending-422', 'POST', '/api/v1/notifications/{id}/send-now', { id: push.id, expectedStatus: 422 });

    // 3.5 UTC: an explicit offset is an exact moment; a past moment is rejected.
    await swagger('08-post-utc-offset', 'POST', '/api/v1/notifications', { expectedStatus: 201,
      body: { content: 'Czas z oznaczeniem Z', channel: 'PUSH', recipient: topic, scheduledAt: '2027-07-15T09:00:00Z', timezone: 'Asia/Tokyo' } });
    await swagger('09-post-past-422', 'POST', '/api/v1/notifications', { expectedStatus: 422,
      body: { content: 'Termin w przeszłości', channel: 'EMAIL', recipient: 'klient@example.com', scheduledAt: '2020-01-15T09:00:00', timezone: 'Europe/Warsaw' } });

    // 3.6 Idempotency.
    const keyBody = { content: 'Potwierdzenie zamówienia 1024', channel: 'EMAIL', recipient: 'klient@example.com', scheduledAt: '2027-05-01T10:00:00', timezone: 'Europe/Warsaw' };
    await swagger('10-post-key-201', 'POST', '/api/v1/notifications', { body: keyBody, headers: { 'Idempotency-Key': 'zamowienie-1024' }, expectedStatus: 201 });
    await swagger('11-post-key-replay-200', 'POST', '/api/v1/notifications', { body: keyBody, headers: { 'Idempotency-Key': 'zamowienie-1024' }, expectedStatus: 200, showHeaders: true });
    await swagger('12-post-key-conflict-409', 'POST', '/api/v1/notifications', { body: { ...keyBody, content: 'Inna treść' }, headers: { 'Idempotency-Key': 'zamowienie-1024' }, expectedStatus: 409 });

    // 4. Prometheus: sample data, then the metrics endpoint and Prometheus UI after the worker processed it.
    const seed = await run('node', ['scripts/seed-notifications.mjs'], { cwd: backend });
    evidence.seedOutput = seed.stdout.trim();
    await sleep(55_000);
    await swagger('13-get-metrics', 'GET', '/metrics', { expectedStatus: 200 });
    await screen('prom-targets', 'http://localhost:9090/targets', { wait: 2500, waitUntil: 'load', clip: { x: 0, y: 0, width: 1060, height: 360 } });
    // The graph window spans this run only, so data from earlier runs on the same scrape target stays outside it.
    const range = `${Math.ceil((Date.now() - runStart) / 1000) + 15}s`;
    evidence.prometheusRange = range;
    const q = (expr, tab) => `http://localhost:9090/query?g0.expr=${encodeURIComponent(expr)}&g0.tab=${tab}&g0.range_input=${range}`;
    await page.setViewportSize({ width: 1060, height: 1400 });
    await screen('prom-table-by-channel', q('notifications_by_channel', 'table'), { wait: 3000, waitUntil: 'load', clip: { x: 0, y: 0, width: 1060, height: 720 } });
    await screen('prom-graph-by-channel', q('notifications_by_channel', 'graph'), { wait: 3500, waitUntil: 'load', clip: { x: 0, y: 0, width: 1060, height: 1130 } });
    // `or` would drop pending_total (same labels as sent_total), so the four totals are selected by name.
    await screen('prom-graph-totals', q('{__name__=~"notifications_(sent|pending|failed|cancelled)_total"}', 'graph'), { wait: 3500, waitUntil: 'load', clip: { x: 0, y: 0, width: 1060, height: 1010 } });
    evidence.metrics = (await (await fetch(`${base}/metrics`)).text());
    evidence.prometheus = await (await fetch(`http://localhost:9090/api/v1/query?query=${encodeURIComponent('notifications_by_channel')}`)).json();
    evidence.notifications = await (await fetch(`${base}/api/v1/notifications`)).json();
    save();
    completed = true;
  } finally {
    // Close the browser first: its keep-alive connections would otherwise hold up app.close().
    try { if (browser) await browser.close(); } finally {
      try { if (app) await app.close(); } finally {
        await cleanup();
        fs.writeFileSync(path.join(__dirname, 'server-log.txt'), logger.lines.join('\n') + '\n');
        fs.writeFileSync(path.join(__dirname, 'capture-complete.json'), JSON.stringify({ completed, temporaryDatabaseRemoved: true, at: new Date().toISOString() }, null, 2));
      }
    }
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
