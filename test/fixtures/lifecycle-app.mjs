import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { createApplication } from '../../dist/app.js';

// Run the real application in a separate process so a signal cannot stop the test runner.
const app = await createApplication();
const database = app.get(DataSource);
app.getHttpAdapter().get('/__test/slow', async (_request, response) => {
  process.send({ type: 'request-started' });
  try {
    await database.query('SELECT pg_sleep(0.5)');
    response.json({ completed: true });
  } catch (error) {
    response.status(500).json({ message: String(error) });
  }
});

await app.listen(0, '127.0.0.1');
process.send({ type: 'ready', url: await app.getUrl() });
