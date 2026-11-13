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
  };
}

function readPort(value: unknown, fallback: number, key: string): number {
  const port = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`${key} must be an integer between 1 and 65535`);
  }
  return port;
}

function readText(value: unknown, fallback: string, key: string): string {
  const text = value === undefined ? fallback : String(value);
  if (!text.trim()) throw new Error(`${key} must not be empty`);
  return text;
}
