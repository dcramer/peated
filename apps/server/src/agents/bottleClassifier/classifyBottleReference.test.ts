import { describe, expect, test, vi } from "vitest";
import { classifyBottleReference } from "./classifyBottleReference";

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
        extractedIdentitySource: null,
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
});
