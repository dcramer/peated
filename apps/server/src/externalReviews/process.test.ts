import { expect, test, vi } from "vitest";
import { CURRENT_REVIEW_VERSION, processExternalReview } from "./process";

test("builds every derived review value from one saved body", async () => {
  const createClip = vi.fn().mockResolvedValue("A short review clip.");

  await expect(
    processExternalReview(
      "Nose: vanilla and smoke.",
      [
        { name: "vanilla", synonyms: [] },
        { name: "smoke", synonyms: [] },
      ],
      createClip,
    ),
  ).resolves.toEqual({
    clip: "A short review clip.",
    tags: ["smoke", "vanilla"],
    version: CURRENT_REVIEW_VERSION,
  });
  expect(createClip).toHaveBeenCalledWith("Nose: vanilla and smoke.");
});
