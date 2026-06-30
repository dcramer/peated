import type { PoolConfig } from "pg";

const SYSTEM_SSL_CERT_PARAMS = ["sslcert", "sslrootcert"] as const;

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

export function getPostgresConnectionConfig(): PoolConfig {
  if (process.env.INSTANCE_UNIX_SOCKET) {
    return {
      host: process.env.INSTANCE_UNIX_SOCKET,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
    };
  }

  return {
    connectionString: process.env.DATABASE_URL
      ? normalizePostgresConnectionString(process.env.DATABASE_URL)
      : undefined,
  };
}
