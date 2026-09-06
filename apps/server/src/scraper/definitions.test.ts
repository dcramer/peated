import { z } from "zod";
import {
  createScraperRegistry,
  defineScraperSource,
  defineScrapeTarget,
  resolveScraperOrigin,
} from "./definitions";

const adapter = async () => {};
const sink = async () => {};

function source(
  key: "finedrams" | "whiskyworld",
  targetKeys: [string, ...string[]],
) {
  return defineScraperSource({
    key,
    externalSiteKey: key,
    targetKeys,
    cursorSchema: z.object({ page: z.number().int().positive() }).strict(),
    observationSchema: z.object({ name: z.string() }).strict(),
    adapter,
    sink,
  });
}

test("applies conservative target and run defaults", () => {
  const target = defineScrapeTarget({
    key: "retailer",
    origins: [{ origin: "https://example.com", robots: { mode: "enforce" } }],
  });
  const definition = source("finedrams", ["retailer"]);

  expect(target).toMatchObject({
    enabled: true,
    minimumSpacingMs: 60_000,
    requestsPerWindow: 60,
    windowMs: 3_600_000,
    timeoutMs: 30_000,
    maxResponseBytes: 10 * 1024 * 1024,
    maxRetries: 2,
  });
  expect(definition.requestLimit).toBe(100);
  expect(definition.resumeFromLastRun).toBe(false);
});

test("allows sources to share one target and a target to declare several origins", () => {
  const registry = createScraperRegistry({
    targets: [
      defineScrapeTarget({
        key: "operator",
        origins: [
          { origin: "https://www.example.com", robots: { mode: "enforce" } },
          {
            origin: "https://api.example.net",
            robots: {
              mode: "not_applicable",
              rationale: "Documented public catalog API, reviewed for access.",
            },
          },
        ],
      }),
    ],
    sources: [
      source("finedrams", ["operator"]),
      source("whiskyworld", ["operator"]),
    ],
  });

  expect(registry.sources).toHaveLength(2);
  expect(registry.targets.get("operator")?.origins).toHaveLength(2);
});

test("accepts a lower hourly limit without a reason", () => {
  expect(
    defineScrapeTarget({
      key: "slow-operator",
      requestsPerHour: 30,
      origins: [{ origin: "https://example.com", robots: { mode: "enforce" } }],
    }),
  ).toMatchObject({ minimumSpacingMs: 120_000, requestsPerWindow: 30 });
});

test("spaces the hourly limit evenly", () => {
  const target = defineScrapeTarget({
    key: "slow-operator",
    requestsPerHour: 10,
    origins: [{ origin: "https://example.com", robots: { mode: "enforce" } }],
  });

  expect(target.minimumSpacingMs).toBe(6 * 60_000);
});

test("requires a reason for a higher hourly limit", () => {
  expect(() =>
    defineScrapeTarget({
      key: "fast-operator",
      requestsPerHour: 3_600,
      origins: [{ origin: "https://example.com", robots: { mode: "enforce" } }],
    }),
  ).toThrow(/requires a reason/);

  expect(
    defineScrapeTarget({
      key: "fast-operator",
      requestsPerHour: 3_600,
      fasterRateReason: "The provider allows one request per second.",
      origins: [{ origin: "https://example.com", robots: { mode: "enforce" } }],
    }).minimumSpacingMs,
  ).toBe(1_000);
});

test("rejects unknown fields and invalid origins", () => {
  expect(() =>
    defineScrapeTarget({
      key: "operator",
      origins: [
        { origin: "https://example.com/path", robots: { mode: "enforce" } },
      ],
    }),
  ).toThrow(/exact HTTP origin/);

  expect(() =>
    defineScrapeTarget({
      key: "operator",
      origins: [{ origin: "https://example.com", robots: { mode: "enforce" } }],
      // @ts-expect-error proving runtime rejection of unrecognized config
      accidentalLimit: 10,
    }),
  ).toThrow();
});

test("rejects undeclared targets and origins", () => {
  const registry = createScraperRegistry({
    targets: [
      defineScrapeTarget({
        key: "operator",
        origins: [
          { origin: "https://example.com", robots: { mode: "enforce" } },
        ],
      }),
    ],
    sources: [source("finedrams", ["operator"])],
  });

  expect(() =>
    resolveScraperOrigin(
      registry,
      "finedrams",
      "operator",
      new URL("https://other.example/path"),
    ),
  ).toThrow(/not declared/);
  expect(() =>
    createScraperRegistry({
      targets: [...registry.targets.values()],
      sources: [source("whiskyworld", ["missing"])],
    }),
  ).toThrow(/unknown target/);
});
