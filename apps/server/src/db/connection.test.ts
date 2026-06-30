import { normalizePostgresConnectionString } from "./connection";

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
