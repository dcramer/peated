import * as labelExtractor from "@peated/server/agents/labelExtractor";
import waitError from "@peated/server/lib/test/waitError";
import { routerClient } from "@peated/server/orpc/router";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@peated/server/agents/labelExtractor");

describe("POST /labels/extract", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  test("extracts from image URL", async () => {
    const mockResult = {
      brand: "Macallan",
      expression: "12 Year Old",
      category: "single_malt",
      statedAge: 12,
      abv: 43,
      caskType: "Sherry Oak",
    };

    vi.mocked(labelExtractor.extractFromImage).mockResolvedValue(mockResult);

    const result = await routerClient.ai.labelExtract({
      imageUrl: "https://example.com/image.jpg",
    });

    expect(labelExtractor.extractFromImage).toHaveBeenCalledWith(
      "https://example.com/image.jpg"
    );
    expect(result).toEqual(mockResult);
  });

  test("extracts from text", async () => {
    const mockResult = {
      brand: "Macallan",
      expression: "12 Year Old",
      category: "single_malt",
      statedAge: 12,
      abv: 43,
      caskType: "Sherry Oak",
    };

    vi.mocked(labelExtractor.extractFromText).mockResolvedValue(mockResult);

    const result = await routerClient.ai.labelExtract({
      label: "Macallan 12 Year Old Single Malt",
    });

    expect(labelExtractor.extractFromText).toHaveBeenCalledWith(
      "Macallan 12 Year Old Single Malt"
    );
    expect(result).toEqual(mockResult);
  });

  test("requires either imageUrl or label", async () => {
    const err = await waitError(routerClient.ai.labelExtract({}));

    expect(err).toMatchInlineSnapshot("[Error: Input validation failed]");
  });

  test("handles extraction errors", async () => {
    vi.mocked(labelExtractor.extractFromImage).mockRejectedValue(
      new Error("Failed to process image")
    );

    const err = await waitError(
      routerClient.ai.labelExtract({
        imageUrl: "https://example.com/image.jpg",
      })
    );

    expect(err).toMatchInlineSnapshot(
      "[Error: Failed to extract label information]"
    );
  });
});
