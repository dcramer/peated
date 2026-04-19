import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { ClassifyBottleReferenceInput } from "./contract";
import {
  legacyReleaseRepairResolutionEvalFixtureSchema,
  listFixtureFiles,
} from "./evalFixtureSchemas";
import type { LegacyReleaseRepairParentCandidate } from "./legacyReleaseRepairIdentity";
import type { LegacyReleaseRepairClassifierBlockedReason } from "./legacyReleaseRepairResolution";

export type LegacyReleaseRepairResolutionEvalCase = {
  fixtureId: string;
  input: ClassifyBottleReferenceInput;
  name: string;
  reviewedParentRows: LegacyReleaseRepairParentCandidate[];
  expected: {
    blockedReason?: LegacyReleaseRepairClassifierBlockedReason;
    parentBottleId?: number;
    resolution: "allow_create_parent" | "blocked" | "reuse_existing_parent";
    summary: string;
  };
};

const fixtureDir = fileURLToPath(
  new URL("./eval-fixtures/legacy-release-repair/", import.meta.url),
);

function buildEvalCase(
  rawFixture: unknown,
): LegacyReleaseRepairResolutionEvalCase {
  const fixture =
    legacyReleaseRepairResolutionEvalFixtureSchema.parse(rawFixture);

  return {
    fixtureId: fixture.id,
    input: {
      reference: {
        name: fixture.referenceName,
      },
      extractedIdentity: fixture.extractedIdentity,
      initialCandidates: fixture.initialCandidates,
    },
    name: fixture.name,
    reviewedParentRows: fixture.reviewedParentRows,
    expected: fixture.expected,
  };
}

function loadFixtureFiles(): LegacyReleaseRepairResolutionEvalCase[] {
  return listFixtureFiles(fixtureDir).map((filename) =>
    buildEvalCase(JSON.parse(readFileSync(filename, "utf8"))),
  );
}

export const LEGACY_RELEASE_REPAIR_RESOLUTION_EVAL_CASES: LegacyReleaseRepairResolutionEvalCase[] =
  loadFixtureFiles();
