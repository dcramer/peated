import config from "@peated/server/config";
import { routerClient } from "@peated/server/orpc/router";
import { describe, expect, test } from "vitest";

describe("GET /", () => {
  test("returns version info", async () => {
    const result = await routerClient.root();
    expect(result.version).toBeDefined();
  });

  test("reports Bottle Check capabilities from the server flags", async () => {
    const originalVisibility = config.BOTTLE_CHECK_MODERATOR_VISIBILITY;
    const originalShadowGeneration = config.BOTTLE_CHECK_SHADOW_GENERATION;
    const originalExecution = config.BOTTLE_CHECK_EXECUTION;

    try {
      config.BOTTLE_CHECK_MODERATOR_VISIBILITY = true;
      config.BOTTLE_CHECK_SHADOW_GENERATION = false;
      config.BOTTLE_CHECK_EXECUTION = false;

      await expect(routerClient.root()).resolves.toMatchObject({
        capabilities: {
          bottleAudits: false,
          bottleCheckExecution: false,
          bottleChecks: true,
        },
      });

      config.BOTTLE_CHECK_SHADOW_GENERATION = true;
      config.BOTTLE_CHECK_EXECUTION = true;

      await expect(routerClient.root()).resolves.toMatchObject({
        capabilities: {
          bottleAudits: true,
          bottleCheckExecution: true,
          bottleChecks: true,
        },
      });
    } finally {
      config.BOTTLE_CHECK_MODERATOR_VISIBILITY = originalVisibility;
      config.BOTTLE_CHECK_SHADOW_GENERATION = originalShadowGeneration;
      config.BOTTLE_CHECK_EXECUTION = originalExecution;
    }
  });
});
