import { beforeEach, expect, test, vi } from "vitest";
import {
  createReviewClip,
  ReviewClipResultSchema,
  type ReviewClipServices,
} from "./clip";

const enabled = vi.fn<ReviewClipServices["enabled"]>();
const generate = vi.fn<ReviewClipServices["generate"]>();
const isConfigured = vi.fn<ReviewClipServices["isConfigured"]>();
const services: ReviewClipServices = {
  enabled,
  generate,
  isConfigured,
};

beforeEach(() => {
  enabled.mockReset().mockReturnValue(true);
  generate.mockReset();
  isConfigured.mockReset().mockReturnValue(true);
});

test("returns a short generated clip", async () => {
  generate.mockResolvedValue({
    clip: "Dense smoke gives way to dark fruit and a long, dry finish.",
  });

  await expect(
    createReviewClip(
      "The whisky starts with smoke and opens into dark fruit.",
      services,
    ),
  ).resolves.toBe(
    "Dense smoke gives way to dark fruit and a long, dry finish.",
  );
  expect(generate).toHaveBeenCalledWith(
    "The whisky starts with smoke and opens into dark fruit.",
  );
});

test("does not call the model when clips are disabled", async () => {
  enabled.mockReturnValue(false);

  await expect(
    createReviewClip("A useful review.", services),
  ).resolves.toBeNull();
  expect(generate).not.toHaveBeenCalled();
});

test("does not call the model when model access is not configured", async () => {
  isConfigured.mockReturnValue(false);

  await expect(
    createReviewClip("A useful review.", services),
  ).resolves.toBeNull();
  expect(generate).not.toHaveBeenCalled();
});

test("returns null when the model request fails", async () => {
  generate.mockRejectedValue(new Error("Unavailable"));

  await expect(
    createReviewClip("A useful review.", services),
  ).resolves.toBeNull();
});

test("rejects invalid model output", () => {
  expect(
    ReviewClipResultSchema.safeParse({ clip: "x".repeat(181) }).success,
  ).toBe(false);
});

test("bounds long review text before the model request", async () => {
  generate.mockResolvedValue({ clip: "A useful short clip." });

  await createReviewClip("x".repeat(50_001), services);

  expect(generate).toHaveBeenCalledWith("x".repeat(50_000));
});
