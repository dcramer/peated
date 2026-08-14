import { afterEach, expect, test, vi } from "vitest";
import {
  classifyScrapedBottleReference,
  runScrapedBottleReference,
} from "./scrapedBottleReference";

vi.mock("./service", () => ({
  classifyScrapedBottleReference: vi.fn(),
  runScrapedBottleReference: vi.fn(),
}));

afterEach(() => {
  vi.resetAllMocks();
});

test("keeps scraped classification on the isolated service capability", async () => {
  const {
    classifyScrapedBottleReference: classifyInService,
    runScrapedBottleReference: runInService,
  } = await import("./service");
  const input = { reference: { name: "Scraped Bottle" } };
  const classification = { status: "ignored" as const, reason: "ignored" };
  const run = { result: classification, modelMetadata: null };
  vi.mocked(classifyInService).mockResolvedValue(classification as never);
  vi.mocked(runInService).mockResolvedValue(run as never);

  await expect(classifyScrapedBottleReference(input)).resolves.toBe(
    classification,
  );
  await expect(runScrapedBottleReference(input)).resolves.toBe(run);
  expect(classifyInService).toHaveBeenCalledWith(input);
  expect(runInService).toHaveBeenCalledWith(input);
});
