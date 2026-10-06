/** Settings come from environment variables or a .env file next to the project. */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

export function loadDotEnv(file = path.join(projectRoot, '.env')) {
  if (!existsSync(file)) return {};
  const out = {};
  for (const rawLine of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq < 1) continue;
    let v = line.slice(eq + 1).trim();
    if (v.length > 1 && ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))) {
      v = v.slice(1, -1);
    }
    out[line.slice(0, eq).trim()] = v;
  }
  return out;
}

const bool = (v, d) => (v == null || v === '' ? d : /^(1|true|yes|on)$/i.test(v));
const int = (v, d) => {
  const n = Number.parseInt(v ?? '', 10);
  return Number.isFinite(n) ? n : d;
};

export function loadConfig(rawEnv = process.env, fileEnv = loadDotEnv()) {
  const env = { ...fileEnv };
  for (const [k, v] of Object.entries(rawEnv)) if (v !== undefined && v !== '') env[k] = v;

  if (!env.DB_USER || !env.DB_PASSWORD) {
    throw new Error('DB_USER and DB_PASSWORD are required (the kitchen_display login from setup/01). See .env.example.');
  }
  const instanceName = env.DB_INSTANCE || undefined;
  const port = env.DB_PORT ? int(env.DB_PORT, 1433) : undefined;
  if (instanceName && port) throw new Error('Set DB_INSTANCE or DB_PORT, not both.');

  const sql = {
    server: env.DB_SERVER ?? 'localhost',
    database: env.DB_DATABASE ?? 'KFDisplay',
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    options: {
      instanceName,
      encrypt: bool(env.DB_ENCRYPT, false),
      trustServerCertificate: bool(env.DB_TRUST_SERVER_CERT, true),
      enableArithAbort: true,
    },
    requestTimeout: 15000,
    connectionTimeout: 15000,
    pool: { max: 4, min: 0, idleTimeoutMillis: 30000 },
  };
  if (port) sql.port = port;
  if (bool(env.DB_LEGACY_TLS, false)) {
    sql.options.cryptoCredentialsDetails = { minVersion: 'TLSv1', ciphers: 'DEFAULT@SECLEVEL=0' };
  }

  return {
    sql,
    port: int(env.KDS_PORT, 8790),
    host: env.KDS_HOST || '0.0.0.0',
    warnMinutes: int(env.KDS_WARN_MINUTES, 5),
    lateMinutes: int(env.KDS_LATE_MINUTES, 10),
    windowHours: int(env.KDS_WINDOW_HOURS, 12),
    recallCount: int(env.KDS_RECALL_COUNT, 40),
  };
}
