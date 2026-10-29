import { isAIGatewayConfigured } from "@peated/server/lib/openaiClient";
import { experimental_decide as decide, generateText } from "ai";
import { describe, expect, test } from "vitest";
import { createDecisionModel, createLanguageModel } from "./aiSdkModels";

// Smoke checks that AI SDK models answer through AI Gateway with our settings.
// The questions have plain answers; these do not measure judgment.
describe.skipIf(!isAIGatewayConfigured())("AI SDK models", () => {
  test("the decision model answers yes-or-no and pick-one questions", async () => {
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

  test("the language model follows the reasoning setting with storage off", async () => {
    const ask = (reasoning: "none" | "high") =>
      generateText({
        model: createLanguageModel(),
        prompt: "What is 17 times 23? Reply with the number only.",
        reasoning,
        providerOptions: { openai: { store: false } },
      });

    const [withoutReasoning, withReasoning] = await Promise.all([
      ask("none"),
      ask("high"),
    ]);

    expect(withoutReasoning.text.trim()).toBe("391");
    expect(withReasoning.text.trim()).toBe("391");
    expect(withoutReasoning.usage.outputTokenDetails.reasoningTokens ?? 0).toBe(
      0,
    );
    expect(
      withReasoning.usage.outputTokenDetails.reasoningTokens,
    ).toBeGreaterThan(0);
  });
});
