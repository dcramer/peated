import { afterEach, describe, expect, test, vi } from "vitest";
import { classifyBottleReference } from "./classifyBottleReference";

vi.mock("./service", () => ({
  classifyBottleReference: vi.fn(),
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
      artifacts: {
        extractedIdentity: null,
        candidates: [],
        searchEvidence: [],
        resolvedEntities: [],
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
});
