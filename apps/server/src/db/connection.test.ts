import {
  getPostgresPoolConfig,
  normalizePostgresConnectionString,
} from "./connection";

describe("normalizePostgresConnectionString", () => {
  test("removes system sslcert sentinel values", () => {
    const result = new URL(
      normalizePostgresConnectionString(
        "postgres://user:pass@example.com:5432/peated?sslmode=verify-full&sslcert=system",
      ),
    );

    expect(result.searchParams.get("sslmode")).toBe("verify-full");
    expect(result.searchParams.has("sslcert")).toBe(false);
  });

  test("keeps explicit certificate paths", () => {
    const result = new URL(
      normalizePostgresConnectionString(
        "postgres://user:pass@example.com:5432/peated?sslmode=verify-full&sslcert=%2Fetc%2Fclient.crt",
      ),
    );

    expect(result.searchParams.get("sslcert")).toBe("/etc/client.crt");
  });

  test("defaults system certificate URLs to verified TLS", () => {
    const result = new URL(
      normalizePostgresConnectionString(
        "postgres://user:pass@example.com:5432/peated?sslrootcert=system",
      ),
    );

    expect(result.searchParams.get("sslmode")).toBe("verify-full");
    expect(result.searchParams.has("sslrootcert")).toBe(false);
  });
});

describe("getPostgresPoolConfig", () => {
  test("bounds and labels production pool connections", () => {
    expect(
      getPostgresPoolConfig({
        DATABASE_URL: "postgres://user:pass@example.com:6432/peated",
        RENDER_SERVICE_NAME: "worker",
      }),
    ).toMatchObject({
      application_name: "peated-worker",
      max: 5,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
      maxLifetimeSeconds: 3_600,
    });
  });

  test("accepts explicit pool limits and statement timeouts", () => {
    expect(
      getPostgresPoolConfig({
        DATABASE_APPLICATION_NAME: "peated-api",
        DATABASE_POOL_MAX: "8",
        DATABASE_CONNECTION_TIMEOUT_MS: "2000",
        DATABASE_IDLE_TIMEOUT_MS: "10000",
        DATABASE_MAX_LIFETIME_SECONDS: "1800",
        DATABASE_STATEMENT_TIMEOUT_MS: "15000",
      }),
    ).toMatchObject({
      application_name: "peated-api",
      max: 8,
      connectionTimeoutMillis: 2_000,
      idleTimeoutMillis: 10_000,
      maxLifetimeSeconds: 1_800,
      statement_timeout: 15_000,
      idle_in_transaction_session_timeout: 15_000,
    });
  });
});
