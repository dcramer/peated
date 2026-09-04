import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { JsonValue } from "vitest-evals/harness";
import { z } from "zod";
import {
  BottleExtractedDetailsSchema,
  BottleSearchEvidenceSchema,
  type BottleExtractedDetails,
} from "./classifierTypes";
import type { BottleWebSearchExecutor } from "./tools";
import { webEvidenceUrlsMatch } from "./webEvidenceUrl";

const FixedWebSearchResultSchema = z
  .object({
    evidence: z.array(BottleSearchEvidenceSchema).min(1),
    errors: z.array(z.object({ query: z.string(), error: z.string() })),
  })
  .strict();

const FixedWebPageSchema = z
  .object({
    url: z.string().url(),
    result: BottleSearchEvidenceSchema,
  })
  .strict();

const FixedImageExtractionSchema = z
  .object({
    url: z.string().url(),
    result: BottleExtractedDetailsSchema.nullable(),
  })
  .strict();

export const FixedWebEvidenceCaseSchema = z
  .object({
    searchResult: FixedWebSearchResultSchema,
    pageResults: z.array(FixedWebPageSchema).default([]),
    imageResults: z.array(FixedImageExtractionSchema).default([]),
  })
  .strict();

export const FixedWebEvidencePackSchema = z
  .object({
    name: z.string().min(1),
    reviewedAt: z.string().date(),
    notes: z.string().min(1).optional(),
    sources: z.array(z.string().url()).min(1),
    cases: z.record(z.string().min(1), FixedWebEvidenceCaseSchema),
  })
  .strict();

export type FixedWebEvidenceCase = z.infer<typeof FixedWebEvidenceCaseSchema>;

export function loadFixedWebEvidenceCase(
  filename: string,
  fixtureId: string,
): FixedWebEvidenceCase {
  const pack = FixedWebEvidencePackSchema.parse(
    JSON.parse(readFileSync(resolve(process.cwd(), filename), "utf8")),
  );
  const evidence = pack.cases[fixtureId];
  if (!evidence) {
    throw new Error(
      `Fixed web evidence pack ${filename} has no case for fixture ${fixtureId}.`,
    );
  }
  return evidence;
}

export function createFixedImageExtractor(
  evidence: FixedWebEvidenceCase,
): (imageUrl: string) => Promise<BottleExtractedDetails | null> {
  return async (imageUrl) => {
    const image = evidence.imageResults.find((candidate) =>
      webEvidenceUrlsMatch(candidate.url, imageUrl),
    );
    if (!image) {
      throw new Error(`No reviewed fixed image extraction for ${imageUrl}.`);
    }
    return image.result;
  };
}

export function createFixedWebSearchExecutor(
  evidence: FixedWebEvidenceCase,
): BottleWebSearchExecutor {
  return async ({ toolName, args }) => {
    if (toolName === "firecrawl_web_search") {
      return evidence.searchResult;
    }

    if (!("url" in args)) {
      return { error: "Fixed page evidence requires a URL." };
    }
    const page = evidence.pageResults.find((candidate) =>
      webEvidenceUrlsMatch(candidate.url, args.url),
    );
    return (
      page?.result ?? {
        error: `No reviewed fixed page evidence for ${args.url}.`,
      }
    );
  };
}

export function parseFixedWebEvidencePack(value: JsonValue) {
  return FixedWebEvidencePackSchema.parse(value);
}
