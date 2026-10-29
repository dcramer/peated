import { isAIGatewayConfigured } from "@peated/server/lib/openaiClient";
import { experimental_decide as decide } from "ai";
import { describe, expect, test } from "vitest";
import { createDecisionModel } from "./decisionModel";

// A smoke check that the configured decision model answers through AI
// Gateway. The questions have plain answers; this does not measure judgment.
describe.skipIf(!isAIGatewayConfigured())("decision model", () => {
  test("answers yes-or-no and pick-one questions", async () => {
    const result = await decide({
      model: createDecisionModel(),
      state:
        "Lagavulin 16 Year Old Islay Single Malt Scotch Whisky, 43% ABV, 700 ml",
      questions: {
        isWhisky: {
          type: "boolean",
          instructions: "Is this product a whisky?",
        },
        category: {
          type: "choice",
          instructions: "Which kind of whisky is this product?",
          criteria: {
            single_malt: "Malt whisky from a single distillery",
            blend: "A mix of malt and grain whiskies",
            bourbon: "American whiskey made mostly from corn",
          },
        },
      },
    });

    expect(result.answers.isWhisky.probability).toBeGreaterThan(0.5);
    expect(result.answers.category.choice).toBe("single_malt");
  });
});
