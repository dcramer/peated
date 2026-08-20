import { getStructuredResponse } from "@peated/server/lib/openai";
import { routerClient } from "@peated/server/orpc/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@peated/server/lib/openai", () => ({
  getStructuredResponse: vi.fn(),
}));

describe("POST /ai/bottle-lookup", () => {
  beforeEach(() => {
    vi.mocked(getStructuredResponse).mockReset();
  });

  test("returns only generated tags from the allowed tag list", async ({
    fixtures,
  }) => {
    const user = await fixtures.User({ mod: true });
    const smoke = await fixtures.Tag({ name: "smoke" });
    const fruit = await fixtures.Tag({ name: "fruit" });
    vi.mocked(getStructuredResponse).mockResolvedValue({
      description: "Generated description",
      tastingNotes: null,
      category: "single_malt",
      suggestedTags: [smoke.name, "unsupported", fruit.name],
      flavorProfile: "peated",
    });

    const result = await routerClient.ai.bottleLookup(
      { name: "Generated Tag Example" },
      { context: { user } },
    );

    expect(result.suggestedTags).toEqual(["smoke", "fruit"]);
  });
});
