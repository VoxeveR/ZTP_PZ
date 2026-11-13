export function validateEnvironment(config: Record<string, unknown>) {
  const port = readPort(config.PORT, 8000, 'PORT');
  const dbPort = readPort(config.DB_PORT, 5432, 'DB_PORT');
  return {
    ...config,
    PORT: port,
    HOST: readText(config.HOST, '127.0.0.1', 'HOST'),
    DB_PORT: dbPort,
    DB_HOST: readText(config.DB_HOST, 'localhost', 'DB_HOST'),
    DB_NAME: readText(config.DB_NAME, 'appdb', 'DB_NAME'),
    DB_USER: readText(config.DB_USER, 'appuser', 'DB_USER'),
    DB_PASSWORD: readText(config.DB_PASSWORD, 'apppassword', 'DB_PASSWORD'),
    CORS_ORIGIN: readText(config.CORS_ORIGIN, 'http://localhost:5173', 'CORS_ORIGIN'),
    SMTP_HOST: readText(config.SMTP_HOST, 'localhost', 'SMTP_HOST'),
    SMTP_PORT: readPort(config.SMTP_PORT, 1025, 'SMTP_PORT'),
    MAIL_FROM: readText(config.MAIL_FROM, 'noreply@ztp.local', 'MAIL_FROM'),
    NTFY_URL: readText(config.NTFY_URL, 'http://localhost:8088', 'NTFY_URL'),
    NOTIFICATION_WORKER_ENABLED: readBoolean(config.NOTIFICATION_WORKER_ENABLED, true, 'NOTIFICATION_WORKER_ENABLED'),
    NOTIFICATION_WORKER_INTERVAL_MS: readInterval(config.NOTIFICATION_WORKER_INTERVAL_MS, 5000),
  };
}

function readBoolean(value: unknown, fallback: boolean, key: string): boolean {
  if (value === undefined) return fallback;
  if (value === true || value === 'true') return true;
  if (value === false || value === 'false') return false;
  throw new Error(`${key} must be true or false`);
}

function readInterval(value: unknown, fallback: number): number {
  const interval = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(interval) || interval < 100) {
    throw new Error('NOTIFICATION_WORKER_INTERVAL_MS must be an integer of at least 100');
  }
  return interval;
}

function readPort(value: unknown, fallback: number, key: string): number {
  const port = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${key} must be an integer between 1 and 65535`);
  }
  return port;
}

function readText(value: unknown, fallback: string, key: string): string {
  if (value !== undefined && typeof value !== 'string' && typeof value !== 'number') {
    throw new Error(`${key} must be a string`);
  }
  const text = value === undefined ? fallback : String(value);
  if (!text.trim()) throw new Error(`${key} must not be empty`);
  return text;
}
