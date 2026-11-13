import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

// Each test file owns a separate database. HTTP writes never touch appdb.
export async function prepareTestDatabase() {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const connection = {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    database: process.env.DB_NAME ?? 'appdb',
    user: process.env.DB_USER ?? 'appuser',
    password: process.env.DB_PASSWORD ?? 'apppassword',
  };
  const name = `ztp_test_${randomUUID().replaceAll('-', '')}`;
  const admin = new pg.Client(connection);
  await admin.connect();
  try {
    await admin.query(`CREATE DATABASE "${name}"`);
  } finally {
    await admin.end();
  }
  const previousName = process.env.DB_NAME;
  process.env.DB_NAME = name;
  const cleanup = async () => {
    const client = new pg.Client(connection);
    await client.connect();
    try {
      // Only the randomly named database created above can be removed here.
      await client.query(`DROP DATABASE IF EXISTS "${name}" WITH (FORCE)`);
    } finally {
      await client.end();
      if (previousName === undefined) delete process.env.DB_NAME;
      else process.env.DB_NAME = previousName;
    }
  };
  try {
    const { createApplication } = await import('../../dist/app.js');
    return { createApplication, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  }
}
