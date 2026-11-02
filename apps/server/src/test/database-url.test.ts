import { assertTestDatabaseName, testDatabaseUrl } from "./database-url";

const BASE = "postgresql://postgres:postgres@localhost:15432";

describe("testDatabaseUrl", () => {
  test("keeps test_peated in the main checkout", () => {
    expect(testDatabaseUrl(`${BASE}/test_peated`, null)).toBe(
      `${BASE}/test_peated`,
    );
  });

  test("gives each linked worktree its own database", () => {
    expect(
      testDatabaseUrl(`${BASE}/test_peated`, "repo-patterns-toolchain-552e61"),
    ).toBe(`${BASE}/test_peated_repo_patterns_toolchain_552e61`);
  });

  test("keeps a database named in .env.test.local", () => {
    expect(testDatabaseUrl(`${BASE}/test_peated_drafts`, "some-tree")).toBe(
      `${BASE}/test_peated_drafts`,
    );
  });

  test("keeps long worktree names unique within the Postgres limit", () => {
    const first = testDatabaseUrl(`${BASE}/test_peated`, `${"x".repeat(80)}-a`);
    const second = testDatabaseUrl(
      `${BASE}/test_peated`,
      `${"x".repeat(80)}-b`,
    );
    const name = new URL(first!).pathname.slice(1);

    expect(name).toHaveLength(63);
    expect(name).toMatch(/^test_peated_[a-z0-9_]+$/);
    expect(first).not.toBe(second);
  });

  test("leaves a dev database alone so config loading never fails", () => {
    expect(testDatabaseUrl(`${BASE}/peated`, "some-tree")).toBe(
      `${BASE}/peated`,
    );
  });
});

describe("assertTestDatabaseName", () => {
  test("accepts test databases", () => {
    expect(() => assertTestDatabaseName("test_peated_drafts")).not.toThrow();
  });

  test("refuses a database that is not a test database", () => {
    expect(() => assertTestDatabaseName("peated")).toThrow(
      /must name a database that starts with "test"/,
    );
  });
});
