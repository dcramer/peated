import { createIgnoredBottleClassification } from "@peated/bottle-classifier/contract";
import { expect, test, vi } from "vitest";
import {
  classifyScrapedBottleReference,
  runScrapedBottleReference,
} from "./scrapedBottleReference";

import type * as classifierService from "./service";

test("keeps scraped classification on the isolated service capability", async () => {
  const classifyInService =
    vi.fn<typeof classifierService.classifyScrapedBottleReference>();
  const runInService =
    vi.fn<typeof classifierService.runScrapedBottleReference>();
  const input = { reference: { name: "Scraped Bottle" } };
  const classification = createIgnoredBottleClassification({
    reason: "ignored",
    artifacts: {},
  });
  const run = { result: classification, modelMetadata: null };
  classifyInService.mockResolvedValue(classification);
  runInService.mockResolvedValue(run);

  await expect(
    classifyScrapedBottleReference(input, classifyInService),
  ).resolves.toBe(classification);
  await expect(runScrapedBottleReference(input, runInService)).resolves.toBe(
    run,
  );
  expect(classifyInService).toHaveBeenCalledWith(input);
  expect(runInService).toHaveBeenCalledWith(input);
});
