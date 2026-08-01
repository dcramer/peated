import { afterEach, describe, expect, test, vi } from "vitest";
import { runBottleReference } from "./runBottleReference";

vi.mock("./service", () => ({
  runBottleReference: vi.fn(),
}));

describe("server Bottle reference run wrapper", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test("delegates the result and aggregate metadata envelope", async () => {
    const { runBottleReference: runBottleReferenceInService } =
      await import("./service");
    const input = { reference: { name: "Wild Turkey Rare Breed Rye" } };
    const modelMetadata = {
      agentDurationMs: 123,
      usage: {
        requests: 2,
        inputTokens: 100,
        outputTokens: 20,
        totalTokens: 120,
      },
      toolCalls: {
        count: 1,
        names: ["search_bottles"],
      },
    };
    vi.mocked(runBottleReferenceInService).mockResolvedValue({
      result: {
        status: "ignored",
        reason: "ignored",
        proposedOperations: [],
        findings: [],
        artifacts: {
          extractedIdentity: null,
          imageEvidence: null,
          candidates: [],
          searchEvidence: [],
          resolvedEntities: [],
          bottleContexts: [],
          entityContexts: [],
        },
      },
      modelMetadata,
    });

    await expect(runBottleReference(input)).resolves.toMatchObject({
      result: { status: "ignored" },
      modelMetadata,
    });
    expect(runBottleReferenceInService).toHaveBeenCalledWith(input);
  });
});
