import { readdir } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import { allScenarioIds, getScenarios, SCENARIOS } from "./scenarios/index.mjs";
import { MAX_SCENARIOS, selectScenarioIds } from "./select-scenarios.mjs";

const scenarioDirectory = new URL("./scenarios/", import.meta.url);
const supportFiles = new Set([
  "index.mjs",
  "shared-changes.mjs",
  "viewports.mjs",
]);

async function loadScenarioFiles() {
  const files = (await readdir(scenarioDirectory))
    .filter((file) => file.endsWith(".mjs") && !supportFiles.has(file))
    .sort();

  return Promise.all(
    files.map(async (file) => {
      const exports = await import(new URL(file, scenarioDirectory));
      const scenarios = Object.entries(exports).filter(([name]) =>
        name.endsWith("Scenario"),
      );
      expect(scenarios, `${file} must export one scenario`).toHaveLength(1);
      return { file, scenario: scenarios[0][1] };
    }),
  );
}

describe("selectScenarioIds", () => {
  it("selects the page that owns a changed file", () => {
    expect(
      selectScenarioIds([
        "apps/web/src/app/(app)/bottles/[bottleId]/bottlePageClient.stylex.tsx",
      ]),
    ).toEqual(["bottle-detail"]);
  });

  it("selects the tasting page for tasting workflow changes", () => {
    expect(
      selectScenarioIds([
        "apps/web/src/components/tastingForm/tastingForm.stylex.tsx",
      ]),
    ).toEqual(["add-tasting"]);
  });

  it("selects login for authentication changes", () => {
    expect(
      selectScenarioIds([
        "apps/web/src/components/designSystem/patterns/authentication.stylex.tsx",
      ]),
    ).toEqual(["login"]);
  });

  it("selects brand, distillery, and bottler for their shared page", () => {
    expect(
      selectScenarioIds([
        "apps/web/src/app/(app)/entities/[entityId]/entityOverviewClient.stylex.tsx",
      ]),
    ).toEqual(["brand-detail", "distillery-detail", "bottler-detail"]);
  });

  it("marks every page that reads fixed test data", () => {
    expect(
      selectScenarioIds(["apps/web/e2e/rpc-fixtures.mjs"], { max: 20 }),
    ).toEqual([
      "home",
      "bottle-detail",
      "member-profile",
      "add-tasting",
      "brand-detail",
      "distillery-detail",
      "bottler-detail",
    ]);
  });

  it("selects four representative pages for shared UI changes", () => {
    const selected = selectScenarioIds([
      "apps/web/src/components/designSystem/components/button.stylex.tsx",
    ]);

    expect(selected).toEqual([
      "home",
      "bottle-detail",
      "member-profile",
      "add-tasting",
    ]);
    expect(selected).toHaveLength(MAX_SCENARIOS);
  });

  it("selects the representative pages for web setup changes", () => {
    expect(selectScenarioIds(["apps/web/next.config.mjs"])).toEqual([
      "home",
      "bottle-detail",
      "member-profile",
      "add-tasting",
    ]);
  });

  it("does not run for browser test changes", () => {
    expect(selectScenarioIds(["apps/web/e2e/activity-feed.spec.ts"])).toEqual(
      [],
    );
  });

  it("returns every page when all is requested", () => {
    expect(selectScenarioIds([], { all: true })).toEqual(allScenarioIds());
  });
});

describe("scenario list", () => {
  it("registers every scenario file with a matching id", async () => {
    const files = await loadScenarioFiles();
    const fileIds = files.map(({ file, scenario }) => {
      expect(scenario.id).toBe(file.replace(/\.mjs$/, ""));
      return scenario.id;
    });

    expect(fileIds.sort()).toEqual(allScenarioIds().sort());
  });

  it("has one unique id per page", () => {
    const ids = allScenarioIds();
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("requires each page to explain when it runs", () => {
    expect(SCENARIOS.every((scenario) => scenario.shouldRunFor)).toBe(true);
  });

  it.each(SCENARIOS)("defines a complete $id capture", (scenario) => {
    expect(scenario.id).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
    expect(scenario.label).toEqual(expect.any(String));
    expect(scenario.heading).toEqual(expect.any(String));
    expect(scenario.path).toMatch(/^\//);
    expect(scenario.shouldRunFor).toEqual(expect.any(Function));
    expect(scenario.viewports.length).toBeGreaterThan(0);

    for (const viewport of scenario.viewports) {
      expect(viewport).toEqual({
        height: expect.any(Number),
        name: expect.any(String),
        width: expect.any(Number),
      });
      expect(viewport.height).toBeGreaterThan(0);
      expect(viewport.width).toBeGreaterThan(0);
    }

    if (scenario.signedIn !== undefined) {
      expect(scenario.signedIn).toEqual(expect.any(Boolean));
    }
  });

  it("rejects unknown ids", () => {
    expect(() => getScenarios(["missing"])).toThrow(
      "Unknown screenshot scenario: missing",
    );
  });
});
