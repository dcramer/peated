import { afterEach, describe, expect, test, vi } from "vitest";
import {
  classifyBottleReference,
  runBottleReference,
} from "./classifyBottleReference";

vi.mock("./service", () => ({
  classifyBottleReference: vi.fn(),
  runBottleReference: vi.fn(),
}));

describe("server bottleClassifier wrapper", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  test("delegates to the composed server service", async () => {
    const { classifyBottleReference: classifyBottleReferenceInService } =
      await import("./service");

    vi.mocked(classifyBottleReferenceInService).mockResolvedValue({
      status: "ignored",
      reason: "ignored",
      proposedOperations: [],
      findings: [],
      artifacts: {
        extractedIdentity: null,
        candidates: [],
        searchEvidence: [],
        resolvedEntities: [],
        bottleContexts: [],
        entityContexts: [],
      },
    });

    const input = {
      reference: {
        name: "Wild Turkey Rare Breed Rye",
      },
    };

    await expect(classifyBottleReference(input)).resolves.toMatchObject({
      status: "ignored",
    });
    expect(classifyBottleReferenceInService).toHaveBeenCalledWith(input);
  });

  test("preserves run metadata from the composed server service", async () => {
    const { runBottleReference: runBottleReferenceInService } =
      await import("./service");
    const run = {
      result: {
        status: "ignored" as const,
        reason: "ignored",
        proposedOperations: [] as [],
        findings: [] as [],
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
      modelMetadata: null,
    };
    vi.mocked(runBottleReferenceInService).mockResolvedValue(run);
    const input = { reference: { name: "Wild Turkey Rare Breed Rye" } };

    await expect(runBottleReference(input)).resolves.toBe(run);
    expect(runBottleReferenceInService).toHaveBeenCalledWith(input);
  });
});
