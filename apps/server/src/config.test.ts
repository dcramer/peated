describe("server version", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test.each([
    {
      name: "prefers an explicit version over the Render commit",
      version: "release-1",
      renderCommit: "0123456789abcdef0123456789abcdef01234567",
      expected: "release-1",
    },
    {
      name: "uses the Render commit when VERSION is unset",
      version: undefined,
      renderCommit: "0123456789abcdef0123456789abcdef01234567",
      expected: "0123456789abcdef0123456789abcdef01234567",
    },
    {
      name: "uses the Render commit when VERSION is empty",
      version: "",
      renderCommit: "0123456789abcdef0123456789abcdef01234567",
      expected: "0123456789abcdef0123456789abcdef01234567",
    },
    {
      name: "keeps the version empty when deployment metadata is unset",
      version: undefined,
      renderCommit: undefined,
      expected: "",
    },
    {
      name: "keeps the version empty when deployment metadata is empty",
      version: "",
      renderCommit: "",
      expected: "",
    },
  ])("$name", async ({ version, renderCommit, expected }) => {
    vi.stubEnv("VERSION", version);
    vi.stubEnv("RENDER_GIT_COMMIT", renderCommit);

    const { default: config } = await import("./config");

    expect(config.VERSION).toBe(expected);
  });
});
