import { testDatabaseUrl } from "./database-url";

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

  test("fits the Postgres name limit", () => {
    const url = testDatabaseUrl(`${BASE}/test_peated`, "x".repeat(80));
    expect(new URL(url!).pathname.slice(1)).toHaveLength(63);
  });

  test("refuses a database that is not a test database", () => {
    expect(() => testDatabaseUrl(`${BASE}/peated`, null)).toThrow(
      /must name a database that starts with "test"/,
    );
  });
});
