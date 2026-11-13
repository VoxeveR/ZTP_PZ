import 'reflect-metadata';
import assert from 'node:assert/strict';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import { after, test } from 'node:test';
import { DataSource } from 'typeorm';
import { prepareTestDatabase } from './support/test-database.mjs';
import { LifecycleService } from '../dist/infrastructure/lifecycle/lifecycle.service.js';

const { createApplication, cleanup } = await prepareTestDatabase();
after(cleanup);

test(
  'shutdown drains HTTP requests before closing PostgreSQL and removes signal listeners',
  { timeout: 15000 },
  async (t) => {
    const previousListeners = ['SIGINT', 'SIGTERM'].map((signal) => process.listenerCount(signal));
    const app = await createApplication();
    const database = app.get(DataSource);
    const lifecycle = app.get(LifecycleService);
    const originalBeforeShutdown = lifecycle.beforeApplicationShutdown.bind(lifecycle);

    let releaseRequest;
    const requestGate = new Promise((resolve) => {
      releaseRequest = resolve;
    });
    let signalRequestStarted;
    const requestStarted = new Promise((resolve) => {
      signalRequestStarted = resolve;
    });
    let signalShutdownStarted;
    const shutdownStarted = new Promise((resolve) => {
      signalShutdownStarted = resolve;
    });
    let releaseShutdown;
    const shutdownGate = new Promise((resolve) => {
      releaseShutdown = resolve;
    });
    t.after(async () => {
      releaseRequest();
      releaseShutdown();
      if (database.isInitialized) await app.close();
    });

    // Hold beforeApplicationShutdown to observe the HTTP adapter's closing state.
    lifecycle.beforeApplicationShutdown = async (signal) => {
      originalBeforeShutdown(signal);
      signalShutdownStarted();
      await shutdownGate;
    };
    app.getHttpAdapter().get('/__test/slow', async (_request, response) => {
      signalRequestStarted();
      await requestGate;
      const [row] = await database.query('SELECT 1 AS value');
      response.json(row);
    });

    await app.listen(0, '127.0.0.1');
    const url = await app.getUrl();
    const responsePending = fetch(`${url}/__test/slow`);
    await requestStarted;
    const closing = app.close('SIGTERM');
    await shutdownStarted;

    const rejected = await fetch(`${url}/api/v1/products`);
    assert.equal(rejected.status, 503);
    assert.equal(rejected.headers.get('connection'), 'close');
    await rejected.text();
    assert.equal(database.isInitialized, true, 'The database must stay open during draining');

    releaseShutdown();
    // The close operation must wait for the active request, even after HTTP disposal starts.
    const state = await Promise.race([closing.then(() => 'closed'), delay(30, 'draining')]);
    assert.equal(state, 'draining');
    releaseRequest();
    const completed = await responsePending;
    assert.equal(completed.status, 200);
    assert.deepEqual(await completed.json(), { value: 1 });
    await closing;
    assert.equal(database.isInitialized, false, 'The PostgreSQL pool must be closed');
    assert.deepEqual(
      ['SIGINT', 'SIGTERM'].map((signal) => process.listenerCount(signal)),
      previousListeners,
    );
    await assert.rejects(fetch(`${url}/api/v1/products`));
  },
);

function waitForMessage(child, type) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error(`Timed out waiting for ${type}`)), 15000);
    const onMessage = (message) => {
      if (message.type === type) finish(undefined, message);
    };
    const onExit = (code, signal) => finish(new Error(`Child exited before ${type}: ${code}/${signal}`));
    const finish = (error, message) => {
      clearTimeout(timer);
      child.off('message', onMessage);
      child.off('exit', onExit);
      child.off('error', finish);
      if (error) reject(error);
      else resolve(message);
    };
    child.on('message', onMessage);
    child.once('exit', onExit);
    child.once('error', finish);
  });
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  test(
    `real ${signal} drains an active database request before exiting`,
    {
      skip: process.platform === 'win32' ? 'POSIX signal delivery requires Linux/macOS' : false,
      timeout: 20000,
    },
    async (t) => {
      const child = fork(new URL('./fixtures/lifecycle-app.mjs', import.meta.url), {
        stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
      });
      t.after(() => {
        if (child.exitCode === null && child.signalCode === null) child.kill('SIGKILL');
      });
      let output = '';
      child.stdout.on('data', (chunk) => {
        output += chunk;
      });
      child.stderr.on('data', (chunk) => {
        output += chunk;
      });
      const exited = once(child, 'exit');
      const { url } = await waitForMessage(child, 'ready');
      const requestStarted = waitForMessage(child, 'request-started');
      const responsePending = fetch(`${url}/__test/slow`);
      await requestStarted;
      child.kill(signal);
      const response = await responsePending;
      assert.equal(response.status, 200, output);
      assert.deepEqual(await response.json(), { completed: true });
      const [exitCode, exitSignal] = await exited;
      assert.equal(exitCode, null, output);
      assert.equal(exitSignal, signal, output);
      assert.ok(output.includes(`Shutdown requested (${signal})`), output);
      assert.ok(output.includes(`HTTP server closed (${signal})`), output);
    },
  );
}
