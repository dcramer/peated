import { createRouterClient } from "@orpc/server";
import { createBottleLookupProcedure } from "@peated/server/orpc/routes/ai/bottle-lookup";
import type { BottleDetailsModel } from "@peated/server/worker/jobs/generateBottleDetails";
import { describe, expect, test, vi } from "vitest";

const model = vi.fn<BottleDetailsModel>();

describe("POST /ai/bottle-lookup", () => {
  test("returns only generated tags from the allowed tag list", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const smoke = await fixtures.Tag({ name: "smoke" });
    const fruit = await fixtures.Tag({ name: "fruit" });
    const bottleLookupClient = createRouterClient(
      { bottleLookup: createBottleLookupProcedure(model) },
      { context: { user } },
    );
    model.mockResolvedValue({
      description: "Generated description",
      tastingNotes: null,
      category: "single_malt",
      suggestedTags: [smoke.name, "unsupported", fruit.name],
      flavorProfile: "peated",
    });

    const result = await bottleLookupClient.bottleLookup({
      name: "Generated Tag Example",
    });

    expect(result.suggestedTags).toEqual(["smoke", "fruit"]);
  });
});
