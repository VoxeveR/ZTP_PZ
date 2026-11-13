const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');
const root = path.resolve(__dirname, '..', '..', '..');
const backend = path.join(root, 'backend');
const deps = path.join(process.env.TEMP, 'ztp-report-tools', 'node_modules');
const { chromium } = require(path.join(deps, 'playwright'));
const sharp = require(path.join(deps, 'sharp'));
const backendRequire = createRequire(path.join(backend, 'package.json'));
backendRequire('reflect-metadata');
const { DataSource } = backendRequire('typeorm');
const assets = path.join(__dirname, 'assets');

(async () => {
  process.chdir(backend);
  const { prepareTestDatabase } = await import(pathToFileURL(path.join(backend, 'test/support/test-database.mjs')));
  const { createApplication, cleanup } = await prepareTestDatabase();
  let app, browser;
  try {
    app = await createApplication();
    app.useLogger(false);
    await app.listen(0, '127.0.0.1');
    const base = await app.getUrl();
    const database = app.get(DataSource);
    const schema = await database.query(`
      SELECT table_name, column_name, data_type, udt_name, character_maximum_length,
        numeric_precision, numeric_scale, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name IN ('categories','products','forbidden_product_names','product_history')
      ORDER BY table_name, ordinal_position
    `);
    fs.writeFileSync(path.join(__dirname, 'database-schema.json'), JSON.stringify(schema, null, 2));
    const constraints = await database.query(`
      SELECT c.conrelid::regclass::text AS table_name, c.conname, c.contype,
        pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND c.conrelid::regclass::text IN ('categories','products','forbidden_product_names','product_history')
      ORDER BY table_name, c.conname
    `);
    fs.writeFileSync(path.join(__dirname, 'database-constraints.json'), JSON.stringify(constraints, null, 2));
    const categories = await database.query('SELECT * FROM categories ORDER BY id');
    const electronics = categories.find(c => c.name === 'Electronics');
    browser = await chromium.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
    const page = await browser.newPage({viewport: {width: 1060, height: 900}, deviceScaleFactor: 1.5});
    const evidence = {base, database: process.env.DB_NAME, categories, cases: []};
    const css = `
      .swagger-ui .curl-command, .swagger-ui .response-controls,
      .swagger-ui .responses-table:not(.live-responses-table),
      .swagger-ui .response-col_links, .swagger-ui .download-contents {display:none!important}
      .swagger-ui .responses-inner {padding:12px!important}
      .swagger-ui .responses-inner > h4 {display:none!important}
      .swagger-ui .response-col_description > .headers-wrapper {display:none!important}
      .swagger-ui .live-responses-table .response-col_description > div:has(> pre.microlight) {display:none!important}
      .swagger-ui .responses-wrapper > .opblock-section-header {display:none!important}
      .swagger-ui .response-col_description > h5 {display:none!important}
      .swagger-ui .opblock-summary-path {font-size:19px!important}
      .swagger-ui .highlight-code pre, .swagger-ui .microlight {font-size:17px!important; line-height:1.4!important}
      .swagger-ui .highlight-code pre {max-height:none!important}
      .swagger-ui .highlight-code {max-height:420px;overflow:hidden}
      .swagger-ui .response-col_status {font-size:19px!important}
      .swagger-ui .request-url pre {font-size:16px!important}
      .swagger-ui .opblock {box-shadow:none!important}
    `;
    async function run(key, method, route, body, id, expectedStatus) {
      await page.goto(`${base}/docs`, {waitUntil:'networkidle'});
      await page.addStyleTag({content:css});
      const op = page.locator('.opblock').filter({has:page.locator(`.opblock-summary-method`, {hasText:new RegExp(`^${method}$`)})})
        .filter({has:page.locator(`.opblock-summary-path[data-path="${route}"]`)});
      if (await op.count() !== 1) throw new Error(`Operation locator ${key}: ${await op.count()}`);
      await op.locator('.opblock-summary').click();
      await op.getByRole('button', {name:'Try it out', exact:true}).click();
      if (id !== undefined) await op.locator('tr[data-param-name="id"] input').fill(String(id));
      if (body !== undefined) await op.locator('textarea').fill(JSON.stringify(body, null, 2));
      const target = `${base}${route.replace('{id}', String(id))}`;
      const received = page.waitForResponse(r => r.url() === target && r.request().method() === method);
      await op.getByRole('button', {name:'Execute', exact:true}).click();
      const response = await received;
      const text = await response.text();
      let responseBody;
      try { responseBody=JSON.parse(text); } catch { responseBody=text; }
      if (response.status() !== expectedStatus) throw new Error(`${key}: expected ${expectedStatus}, got ${response.status()}: ${text}`);
      await op.locator('.live-responses-table').waitFor();
      if (key === '14-history-after-delete') {
        await op.locator('.highlight-code').first().evaluate(el => { el.style.maxHeight='540px'; });
      }
      // These are actual Swagger UI fragments: operation heading and executed response.
      const head = await op.locator('.opblock-summary').screenshot();
      const live = await op.locator('.responses-wrapper').screenshot();
      const mh = await sharp(head).metadata();
      const ml = await sharp(live).metadata();
      const width=Math.max(mh.width,ml.width);
      const out=path.join(assets,`${key}.png`);
      await sharp({create:{width,height:mh.height+ml.height+12,channels:3,background:'#ffffff'}})
        .composite([{input:head,top:0,left:0},{input:live,top:mh.height+12,left:0}]).png().toFile(out);
      evidence.cases.push({key,method,route,url:target,requestBody:body,id,status:response.status(),responseBody,image:`assets/${key}.png`});
      fs.writeFileSync(path.join(__dirname,'evidence.json'),JSON.stringify(evidence,null,2));
      console.log(`${key}: HTTP ${response.status()}`);
      return responseBody;
    }
    await page.goto(`${base}/docs`,{waitUntil:'networkidle'});
    await page.screenshot({path:path.join(assets,'swagger-overview.png'),fullPage:true});
    await run('01-get-products','GET','/api/v1/products',undefined,undefined,200);
    const payload={name:'ReportProduct1',price:'149.90',quantity:10,categoryId:electronics.id};
    const created=await run('02-post-created','POST','/api/v1/products',payload,undefined,201);
    await run('03-get-product','GET','/api/v1/products/{id}',undefined,created.id,200);
    await run('04-post-name-422','POST','/api/v1/products',{...payload,name:'ab'},undefined,422);
    await run('05-post-price-422','POST','/api/v1/products',{...payload,name:'PriceReport1',price:'9.99'},undefined,422);
    await run('06-post-stock-422','POST','/api/v1/products',{...payload,name:'StockReport1',quantity:-1},undefined,422);
    await run('07-post-forbidden-422','POST','/api/v1/products',{...payload,name:'FakeReport1'},undefined,422);
    const missing={...payload,name:'MissingReport1'}; delete missing.quantity;
    await run('08-post-missing-400','POST','/api/v1/products',missing,undefined,400);
    await run('09-post-conflict-409','POST','/api/v1/products',{...payload,name:payload.name.toUpperCase()},undefined,409);
    const replaced=await run('10-put-replaced','PUT','/api/v1/products/{id}',{...payload,price:'199.90',quantity:12},created.id,200);
    const patched=await run('11-patch-updated','PATCH','/api/v1/products/{id}',{quantity:7},created.id,200);
    await run('12-delete-product','DELETE','/api/v1/products/{id}',undefined,created.id,204);
    await run('13-get-deleted-404','GET','/api/v1/products/{id}',undefined,created.id,404);
    const history=await run('14-history-after-delete','GET','/api/v1/products/{id}/history',undefined,created.id,200);
    if (history.map(h=>h.action).join(',')!=='DELETE,UPDATE,REPLACE,CREATE') throw new Error('Unexpected history chain');
    fs.writeFileSync(path.join(__dirname,'history-example.json'),JSON.stringify(history,null,2));
    fs.writeFileSync(path.join(__dirname,'capture-complete.json'),JSON.stringify({completed:true,temporaryDatabaseRemoved:true,base,created,replaced,patched},null,2));
  } finally {
    try { if (browser) await browser.close(); }
    finally { try { if(app) await app.close(); } finally { await cleanup(); } }
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
