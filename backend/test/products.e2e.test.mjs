import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { prepareTestDatabase } from './support/test-database.mjs';

const { createApplication, cleanup } = await prepareTestDatabase();

let app;
let baseUrl;
let expectedProducts;

before(async () => {
  app = await createApplication();
  // An ephemeral port lets these tests run while the development server is open.
  await app.listen(0, '127.0.0.1');
  baseUrl = await app.getUrl();
  const rows = await app.get(DataSource).query(`
    SELECT p.id, p.name, p.price, p.quantity, c.id AS category_id, c.name AS category_name,
      c.min_price, c.max_price
    FROM products p JOIN categories c ON c.id = p.category_id ORDER BY p.id
  `);
  expectedProducts = rows.map((row) => ({
    id: row.id,
    name: row.name,
    price: row.price,
    quantity: row.quantity,
    category: { id: row.category_id, name: row.category_name, minPrice: row.min_price, maxPrice: row.max_price },
  }));
  assert.ok(expectedProducts.length > 0, 'The migration should seed example products');
});

after(async () => {
  try {
    if (app) await app.close();
  } finally {
    await cleanup();
  }
});

test('GET products returns the actual PostgreSQL rows, categories, and exact prices', async () => {
  const response = await fetch(`${baseUrl}/api/v1/products`);
  assert.equal(response.status, 200);
  const products = await response.json();
  assert.deepEqual(products, expectedProducts);
  for (const product of products) assert.match(product.price, /^\d+\.\d{2}$/);
});

test('GET products/:id returns the matching product', async () => {
  for (const product of expectedProducts) {
    const response = await fetch(`${baseUrl}/api/v1/products/${product.id}`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), product);
  }
});

test('GET a missing product returns 404', async () => {
  const ids = new Set(expectedProducts.map((product) => product.id));
  let missingId = 1;
  while (ids.has(missingId)) missingId++;
  const response = await fetch(`${baseUrl}/api/v1/products/${missingId}`);
  assert.equal(response.status, 404);
  assert.equal((await response.json()).statusCode, 404);
});

for (const id of ['abc', '1.5', '-1', '0', '2147483648', '9007199254740993', '1e2']) {
  test(`GET products/${id} rejects an invalid ID with 400`, async () => {
    const response = await fetch(`${baseUrl}/api/v1/products/${id}`);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).statusCode, 400);
  });
}

test('Swagger documents all CRUD endpoints and the decimal price contract', async () => {
  const response = await fetch(`${baseUrl}/docs-json`);
  assert.equal(response.status, 200);
  const document = await response.json();
  assert.ok(document.paths['/api/v1/products'].get);
  const getProduct = document.paths['/api/v1/products/{id}'].get;
  assert.ok(getProduct.responses['200']);
  assert.ok(getProduct.responses['400']);
  assert.ok(getProduct.responses['404']);
  assert.ok(document.paths['/api/v1/products'].post.responses['201']);
  assert.ok(document.paths['/api/v1/products/{id}'].put.responses['409']);
  assert.ok(document.paths['/api/v1/products/{id}'].put.responses['422']);
  assert.ok(document.paths['/api/v1/products/{id}'].delete.responses['204']);
  assert.deepEqual(document.components.schemas.ProductWriteDto.required.toSorted(), [
    'categoryId',
    'name',
    'price',
    'quantity',
  ]);
  assert.equal(document.components.schemas.ProductResponseDto.properties.price.type, 'string');
});

test('Swagger UI is served at /docs', async () => {
  const response = await fetch(`${baseUrl}/docs`);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /swagger-ui/);
});

test('the configured future React origin can read API responses', async () => {
  const origin = app.get(ConfigService).getOrThrow('CORS_ORIGIN');
  const response = await fetch(`${baseUrl}/api/v1/products`, { headers: { Origin: origin } });
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('access-control-allow-origin'), origin);
});

let nextName = 1;
function validPayload(overrides = {}) {
  const category = expectedProducts.find((product) => product.category.name === 'Electronics').category;
  return { name: `Product${nextName++}`, price: '149.90', quantity: 5, categoryId: category.id, ...overrides };
}

async function send(method, path, payload) {
  return fetch(`${baseUrl}/api/v1/products${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

async function createProduct(payload = validPayload()) {
  const response = await send('POST', '', payload);
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
}

test('POST persists the product and GET exposes its stock and category limits', async () => {
  const payload = validPayload({ quantity: 0 });
  const product = await createProduct(payload);
  assert.equal(product.name, payload.name);
  assert.equal(product.price, '149.90');
  assert.equal(product.quantity, 0);
  assert.equal(product.category.id, payload.categoryId);
  assert.equal(product.category.minPrice, '10.00');
  const response = await fetch(`${baseUrl}/api/v1/products/${product.id}`);
  assert.deepEqual(await response.json(), product);
  const [row] = await app.get(DataSource).query('SELECT quantity, price FROM products WHERE id = $1', [product.id]);
  assert.deepEqual(row, { quantity: 0, price: '149.90' });
});

test('PUT replaces all fields and is idempotent, including keeping its own name', async () => {
  const product = await createProduct();
  const books = expectedProducts.find((entry) => entry.category.name === 'Books').category;
  const replacement = validPayload({ name: product.name, price: 25.25, quantity: 12, categoryId: books.id });
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await send('PUT', `/${product.id}`, replacement);
    assert.equal(response.status, 200, await response.clone().text());
    const updated = await response.json();
    assert.equal(updated.id, product.id);
    assert.equal(updated.name, product.name);
    assert.equal(updated.price, '25.25');
    assert.equal(updated.quantity, 12);
    assert.equal(updated.category.id, books.id);
  }
});

test('DELETE returns an empty 204 and subsequent GET/DELETE return 404', async () => {
  const product = await createProduct();
  const response = await send('DELETE', `/${product.id}`);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), '');
  assert.equal((await fetch(`${baseUrl}/api/v1/products/${product.id}`)).status, 404);
  assert.equal((await send('DELETE', `/${product.id}`)).status, 404);
});

test('product names are unique regardless of letter case, including concurrent POST requests', async () => {
  const payload = validPayload();
  const responses = await Promise.all([
    send('POST', '', payload),
    send('POST', '', { ...payload, name: payload.name.toUpperCase() }),
  ]);
  assert.deepEqual(responses.map((response) => response.status).sort(), [201, 409]);
  for (const response of responses) await response.text();
  const [{ count }] = await app
    .get(DataSource)
    .query('SELECT count(*)::int AS count FROM products WHERE lower(name) = lower($1)', [payload.name]);
  assert.equal(count, 1);
});

test('PUT rejects the name of another product without changing the stored product', async () => {
  const first = await createProduct();
  const second = await createProduct();
  const response = await send('PUT', `/${second.id}`, validPayload({ name: first.name.toUpperCase() }));
  assert.equal(response.status, 409);
  assert.deepEqual(await (await fetch(`${baseUrl}/api/v1/products/${second.id}`)).json(), second);
});

for (const name of ['Ab1', `${'A'.repeat(19)}1`, 'Żółw123']) {
  test(`POST accepts a valid alphanumeric name: ${name}`, async () => {
    assert.equal((await createProduct(validPayload({ name }))).name, name);
  });
}

const domainFailures = [
  ['too short name', { name: 'ab' }],
  ['too long name', { name: 'A'.repeat(21) }],
  ['spaces in name', { name: 'Bad Name' }],
  ['punctuation in name', { name: 'Bad-Name' }],
  ['forbidden phrase regardless of case', { name: 'PhoneBaNnEd1' }],
  ['negative stock', { quantity: -1 }],
  ['stock outside the database integer range', { quantity: 2147483648 }],
  ['negative price', { price: -1 }],
  ['price below category minimum', { price: '9.99' }],
  ['price above category maximum', { price: '100000.01' }],
];
for (const [description, invalid] of domainFailures) {
  test(`POST rejects ${description} with 422`, async () => {
    const response = await send('POST', '', validPayload(invalid));
    assert.equal(response.status, 422, await response.clone().text());
  });
}

test('forbidden phrases are read from the database rather than hardcoded', async () => {
  await app.get(DataSource).query("INSERT INTO forbidden_product_names (name) VALUES ('customblock')");
  const response = await send('POST', '', validPayload({ name: 'CustomBlock123' }));
  assert.equal(response.status, 422);
});

for (const price of ['10.00', '100000.00']) {
  test(`POST accepts the inclusive category price boundary ${price}`, async () => {
    assert.equal((await createProduct(validPayload({ price }))).price, price);
  });
}

test('POST accepts numeric prices and preserves exact two-decimal output', async () => {
  const food = expectedProducts.find((product) => product.category.name === 'Food').category;
  assert.equal((await createProduct(validPayload({ price: 0.1, categoryId: food.id }))).price, '0.10');
});

const technicalFailures = [
  ['fractional stock', { quantity: 1.5 }],
  ['stock as a string', { quantity: '5' }],
  ['name with a wrong type', { name: 123 }],
  ['null name', { name: null }],
  ['price with three decimal places', { price: 10.001 }],
  ['decimal string with three decimal places', { price: '10.001' }],
  ['price with a wrong type', { price: {} }],
  ['category with a wrong type', { categoryId: '1' }],
  ['category ID outside the database integer range', { categoryId: 2147483648 }],
  ['unexpected field', { id: 100 }],
];
for (const [description, invalid] of technicalFailures) {
  test(`POST rejects ${description} with 400`, async () => {
    const response = await send('POST', '', validPayload(invalid));
    assert.equal(response.status, 400, await response.clone().text());
  });
}

for (const field of ['name', 'price', 'quantity', 'categoryId']) {
  test(`POST and PUT require ${field}`, async () => {
    const product = await createProduct();
    const payload = validPayload();
    delete payload[field];
    assert.equal((await send('POST', '', payload)).status, 400);
    assert.equal((await send('PUT', `/${product.id}`, payload)).status, 400);
    assert.deepEqual(await (await fetch(`${baseUrl}/api/v1/products/${product.id}`)).json(), product);
  });
}

test('missing category returns 400 for POST and PUT', async () => {
  const product = await createProduct();
  const payload = validPayload({ categoryId: 2147483647 });
  assert.equal((await send('POST', '', payload)).status, 400);
  assert.equal((await send('PUT', `/${product.id}`, payload)).status, 400);
});

test('PUT checks product existence before domain validation', async () => {
  const response = await send('PUT', '/2147483647', validPayload({ name: 'ab', quantity: -1 }));
  assert.equal(response.status, 404);
});

test('PUT validates the price against the replacement category and preserves failed updates', async () => {
  const product = await createProduct(validPayload({ price: '1500.00' }));
  const books = expectedProducts.find((entry) => entry.category.name === 'Books').category;
  const response = await send('PUT', `/${product.id}`, validPayload({ price: product.price, categoryId: books.id }));
  assert.equal(response.status, 422);
  assert.deepEqual(await (await fetch(`${baseUrl}/api/v1/products/${product.id}`)).json(), product);
});

test('PUT enforces the forbidden-name and stock rules too', async () => {
  const product = await createProduct();
  for (const invalid of [{ name: 'Fake123' }, { quantity: -1 }, { name: 'ab' }]) {
    const response = await send('PUT', `/${product.id}`, validPayload(invalid));
    assert.equal(response.status, 422);
  }
  assert.deepEqual(await (await fetch(`${baseUrl}/api/v1/products/${product.id}`)).json(), product);
});

test('all write routes reject malformed IDs and invalid JSON is rejected', async () => {
  for (const method of ['PUT', 'DELETE']) {
    assert.equal((await send(method, '/abc', method === 'PUT' ? validPayload() : undefined)).status, 400);
  }
  const response = await fetch(`${baseUrl}/api/v1/products`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{bad json',
  });
  assert.equal(response.status, 400);
});

test('the database also enforces stock, name format, and case-insensitive uniqueness', async () => {
  const database = app.get(DataSource);
  const product = await createProduct();
  for (const [sql, values, code] of [
    ['UPDATE products SET quantity = -1 WHERE id = $1', [product.id], '23514'],
    ["UPDATE products SET name = 'Bad Name' WHERE id = $1", [product.id], '23514'],
    [
      'INSERT INTO products(name, price, category_id) VALUES ($1, 20, $2)',
      [product.name.toUpperCase(), product.category.id],
      '23505',
    ],
  ]) {
    await assert.rejects(database.query(sql, values), (error) => error.driverError.code === code);
  }
});

test('GET returns an empty array when the isolated test database has no products', async () => {
  await app.get(DataSource).query('DELETE FROM products');
  const response = await fetch(`${baseUrl}/api/v1/products`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
});
