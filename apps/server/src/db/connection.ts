import type { PoolConfig } from "pg";

const SYSTEM_SSL_CERT_PARAMS = ["sslcert", "sslrootcert"] as const;
// Connection budget rule: each service must leave room in PlanetScale's
// PgBouncer pool for the other services and database operations.
const DEFAULT_POOL_MAX = 5;
const DEFAULT_CONNECTION_TIMEOUT_MS = 5_000;
const DEFAULT_IDLE_TIMEOUT_MS = 30_000;
const DEFAULT_MAX_LIFETIME_SECONDS = 3_600;

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

export function normalizePostgresConnectionString(connectionString: string) {
  const url = new URL(connectionString);
  let removedSystemCertParam = false;

  for (const param of SYSTEM_SSL_CERT_PARAMS) {
    if (url.searchParams.get(param) === "system") {
      url.searchParams.delete(param);
      removedSystemCertParam = true;
    }
  }

  if (
    removedSystemCertParam &&
    !url.searchParams.has("ssl") &&
    !url.searchParams.has("sslmode")
  ) {
    url.searchParams.set("sslmode", "verify-full");
  }

  return url.toString();
}

export function getPostgresConnectionConfig(
  env: NodeJS.ProcessEnv = process.env,
): PoolConfig {
  if (env.INSTANCE_UNIX_SOCKET) {
    return {
      host: env.INSTANCE_UNIX_SOCKET,
      user: env.DATABASE_USER,
      password: env.DATABASE_PASSWORD,
      database: env.DATABASE_NAME,
    };
  }

  return {
    connectionString: env.DATABASE_URL
      ? normalizePostgresConnectionString(env.DATABASE_URL)
      : undefined,
  };
}

export function getPostgresPoolConfig(
  env: NodeJS.ProcessEnv = process.env,
): PoolConfig {
  const applicationName =
    env.DATABASE_APPLICATION_NAME?.trim() ||
    (env.RENDER_SERVICE_NAME ? `peated-${env.RENDER_SERVICE_NAME}` : undefined);
  const statementTimeout = env.DATABASE_STATEMENT_TIMEOUT_MS
    ? positiveInteger(env.DATABASE_STATEMENT_TIMEOUT_MS, 30_000)
    : undefined;

  return {
    ...getPostgresConnectionConfig(env),
    application_name: applicationName,
    max: positiveInteger(env.DATABASE_POOL_MAX, DEFAULT_POOL_MAX),
    connectionTimeoutMillis: positiveInteger(
      env.DATABASE_CONNECTION_TIMEOUT_MS,
      DEFAULT_CONNECTION_TIMEOUT_MS,
    ),
    idleTimeoutMillis: positiveInteger(
      env.DATABASE_IDLE_TIMEOUT_MS,
      DEFAULT_IDLE_TIMEOUT_MS,
    ),
    maxLifetimeSeconds: positiveInteger(
      env.DATABASE_MAX_LIFETIME_SECONDS,
      DEFAULT_MAX_LIFETIME_SECONDS,
    ),
    statement_timeout: statementTimeout,
    idle_in_transaction_session_timeout: statementTimeout,
  };
}
