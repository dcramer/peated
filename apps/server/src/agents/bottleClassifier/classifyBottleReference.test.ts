import { describe, expect, test, vi } from "vitest";
import {
  classifyBottleReference,
  runBottleReference,
} from "./classifyBottleReference";

import type * as classifierService from "./service";

describe("server bottleClassifier wrapper", () => {
  test("delegates to the composed server service", async () => {
    const classifyBottleReferenceInService =
      vi.fn<typeof classifierService.classifyBottleReference>();
    classifyBottleReferenceInService.mockResolvedValue({
      status: "ignored",
      reason: "ignored",
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

    await expect(
      classifyBottleReference(input, classifyBottleReferenceInService),
    ).resolves.toMatchObject({ status: "ignored" });
    expect(classifyBottleReferenceInService).toHaveBeenCalledWith(input);
  });

  test("preserves run metadata from the composed server service", async () => {
    const runBottleReferenceInService =
      vi.fn<typeof classifierService.runBottleReference>();
    const run = {
      result: {
        status: "ignored" as const,
        reason: "ignored",
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
    runBottleReferenceInService.mockResolvedValue(run);
    const input = { reference: { name: "Wild Turkey Rare Breed Rye" } };

    await expect(
      runBottleReference(input, runBottleReferenceInService),
    ).resolves.toBe(run);
    expect(runBottleReferenceInService).toHaveBeenCalledWith(input);
  });
});
