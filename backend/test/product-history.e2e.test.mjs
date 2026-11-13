import 'reflect-metadata';
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { DataSource } from 'typeorm';
import { prepareTestDatabase } from './support/test-database.mjs';

const { createApplication, cleanup } = await prepareTestDatabase();
let app;
let url;
let electronics;
let books;
let seededId;
let counter = 1;

before(async () => {
  app = await createApplication();
  await app.listen(0, '127.0.0.1');
  url = `${await app.getUrl()}/api/v1/products`;
  const products = await (await fetch(url)).json();
  electronics = products.find((product) => product.category.name === 'Electronics').category;
  books = products.find((product) => product.category.name === 'Books').category;
  seededId = products[0].id;
});

after(async () => {
  try {
    if (app) await app.close();
  } finally {
    await cleanup();
  }
});

function payload(overrides = {}) {
  return { name: `History${counter++}`, price: '149.90', quantity: 4, categoryId: electronics.id, ...overrides };
}

function write(method, path, body) {
  return fetch(`${url}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function create(body = payload()) {
  const response = await write('POST', '', body);
  assert.equal(response.status, 201, await response.clone().text());
  return response.json();
}

async function history(id) {
  const response = await fetch(`${url}/${id}/history`);
  assert.equal(response.status, 200, await response.clone().text());
  return response.json();
}

test('POST, PUT, PATCH and DELETE persist complete before/after snapshots, including after deletion', async () => {
  const original = await create();
  const replacedResponse = await write(
    'PUT',
    `/${original.id}`,
    payload({ price: 25.25, quantity: 8, categoryId: books.id }),
  );
  assert.equal(replacedResponse.status, 200);
  const replaced = await replacedResponse.json();
  const patchedResponse = await write('PATCH', `/${original.id}`, { quantity: 0 });
  assert.equal(patchedResponse.status, 200);
  const patched = await patchedResponse.json();
  assert.deepEqual(patched, { ...replaced, quantity: 0 });
  assert.equal((await write('DELETE', `/${original.id}`)).status, 204);
  assert.equal((await fetch(`${url}/${original.id}`)).status, 404);

  const entries = await history(original.id);
  assert.deepEqual(
    entries.map((entry) => entry.action),
    ['DELETE', 'UPDATE', 'REPLACE', 'CREATE'],
  );
  assert.deepEqual(
    entries.map((entry) => [entry.previousState, entry.currentState]),
    [
      [patched, {}],
      [replaced, patched],
      [original, replaced],
      [{}, original],
    ],
  );
  for (const entry of entries) {
    assert.equal(entry.productId, original.id);
    assert.ok(Number.isInteger(entry.id));
    assert.ok(!Number.isNaN(Date.parse(entry.changedAt)));
  }
  const [{ count }] = await app
    .get(DataSource)
    .query('SELECT count(*)::int AS count FROM product_history WHERE product_id = $1', [original.id]);
  assert.equal(count, 4);
});

test('a validation error in POST leaves both products and history unchanged', async () => {
  const database = app.get(DataSource);
  const counts = () =>
    database.query(`
    SELECT (SELECT count(*) FROM products) AS products,
           (SELECT count(*) FROM product_history) AS history
  `);
  const before = await counts();
  assert.equal((await write('POST', '', payload({ name: 'ab' }))).status, 422);
  assert.deepEqual(await counts(), before);
});

test('failed PUT or PATCH changes neither the current product nor its history', async () => {
  const original = await create();
  const previousHistory = await history(original.id);
  assert.equal((await write('PUT', `/${original.id}`, payload({ quantity: -1 }))).status, 422);
  assert.equal((await write('PATCH', `/${original.id}`, { name: 'Fake123' })).status, 422);
  assert.deepEqual(await (await fetch(`${url}/${original.id}`)).json(), original);
  assert.deepEqual(await history(original.id), previousHistory);
});

test('PATCH revalidates the existing price when only the category changes', async () => {
  const original = await create(payload({ price: '1500.00' }));
  assert.equal((await write('PATCH', `/${original.id}`, { categoryId: books.id })).status, 422);
  assert.equal((await history(original.id)).length, 1);
  assert.deepEqual(await (await fetch(`${url}/${original.id}`)).json(), original);
});

test('PATCH rejects null, an empty patch, and unknown fields without creating history', async () => {
  const original = await create();
  for (const field of ['name', 'price', 'quantity', 'categoryId']) {
    assert.equal((await write('PATCH', `/${original.id}`, { [field]: null })).status, 400);
  }
  assert.equal((await write('PATCH', `/${original.id}`, {})).status, 422);
  assert.equal((await write('PATCH', `/${original.id}`, { id: 99 })).status, 400);
  assert.equal((await history(original.id)).length, 1);
});

test('history is isolated per product and existing products without changes return an empty list', async () => {
  assert.deepEqual(await history(seededId), []);
  const first = await create();
  const second = await create();
  const entries = await history(first.id);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].productId, first.id);
  assert.notEqual(entries[0].productId, second.id);
  assert.equal((await fetch(`${url}/2147483647/history`)).status, 404);
  for (const id of ['abc', '1e2', '0']) {
    assert.equal((await fetch(`${url}/${id}/history`)).status, 400);
  }
  assert.equal((await write('PATCH', '/2147483647', { quantity: 1 })).status, 404);
});

test('concurrent PATCH requests form a continuous chain of committed snapshots', async () => {
  const original = await create();
  const responses = await Promise.all([
    write('PATCH', `/${original.id}`, { quantity: 10 }),
    write('PATCH', `/${original.id}`, { quantity: 20 }),
  ]);
  for (const response of responses) {
    assert.equal(response.status, 200);
    await response.json();
  }
  const entries = (await history(original.id)).reverse();
  assert.deepEqual(
    entries.map((entry) => entry.action),
    ['CREATE', 'UPDATE', 'UPDATE'],
  );
  assert.deepEqual(entries[1].previousState, entries[0].currentState);
  assert.deepEqual(entries[2].previousState, entries[1].currentState);
  assert.deepEqual(await (await fetch(`${url}/${original.id}`)).json(), entries[2].currentState);
});

test('failure to save history rolls back POST, PUT, PATCH and DELETE', async () => {
  const original = await create();
  const previousHistory = await history(original.id);
  const database = app.get(DataSource);
  const attemptedCreate = payload();
  // Reject new audit records without invalidating the already committed entries.
  await database.query('ALTER TABLE product_history ADD CONSTRAINT reject_history_write CHECK (false) NOT VALID');
  try {
    assert.equal((await write('POST', '', attemptedCreate)).status, 500);
    assert.equal((await write('PUT', `/${original.id}`, payload())).status, 500);
    assert.equal((await write('PATCH', `/${original.id}`, { quantity: 15 })).status, 500);
    assert.equal((await write('DELETE', `/${original.id}`)).status, 500);
  } finally {
    await database.query('ALTER TABLE product_history DROP CONSTRAINT reject_history_write');
  }
  assert.deepEqual(await (await fetch(`${url}/${original.id}`)).json(), original);
  assert.deepEqual(await history(original.id), previousHistory);
  const [{ count }] = await database.query('SELECT count(*)::int AS count FROM products WHERE name = $1', [
    attemptedCreate.name,
  ]);
  assert.equal(count, 0);
});

test('OpenAPI describes PATCH and the persistent history response', async () => {
  const document = await (await fetch(`${await app.getUrl()}/docs-json`)).json();
  assert.ok(document.paths['/api/v1/products/{id}'].patch.responses['200']);
  const operation = document.paths['/api/v1/products/{id}/history'].get;
  assert.ok(operation.responses['200']);
  assert.ok(operation.responses['404']);
  assert.ok(document.components.schemas.ProductHistoryResponseDto.properties.previousState);
  assert.ok(document.components.schemas.ProductHistoryResponseDto.properties.currentState);
});
