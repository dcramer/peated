import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { BottleCandidate } from "./classifierTypes";
import type { ClassifyBottleReferenceInput } from "./contract";
import {
  classifierEvalFixtureSchema,
  listFixtureFiles,
} from "./evalFixtureSchemas";

export type SearchResponseFixture = {
  when: string[];
  results: BottleCandidate[];
};

export type ClassifierEvalExpectation = {
  status: "ignored" | "classified";
  action?:
    | "match"
    | "create_bottle"
    | "create_release"
    | "create_bottle_and_release"
    | "no_match";
  identityScope?: "product" | "exact_cask";
  matchedBottleId?: number | null;
  matchedReleaseId?: number | null;
  parentBottleId?: number | null;
  proposedBottle?: Record<string, unknown> | null;
  proposedRelease?: Record<string, unknown> | null;
  confidenceAtLeast?: number;
  confidenceBelow?: number;
  verifyEligible?: boolean;
  summary: string;
};

export type ClassifierEvalCase = {
  fixtureId: string;
  name: string;
  input: ClassifyBottleReferenceInput;
  searchResponses?: SearchResponseFixture[];
  expected: ClassifierEvalExpectation;
};

const fixtureDir = fileURLToPath(
  new URL("./eval-fixtures/decision-cases/", import.meta.url),
);

function loadFixtureFiles(): ClassifierEvalCase[] {
  return listFixtureFiles(fixtureDir).map((filename) => {
    const rawFixture = JSON.parse(readFileSync(filename, "utf8"));
    const fixture = classifierEvalFixtureSchema.parse(rawFixture);

    return {
      fixtureId: fixture.id,
      name: fixture.name,
      input: fixture.input,
      searchResponses: fixture.searchResponses,
      expected: fixture.expected,
    };
  });
}

// Keep the decision-oriented classifier eval corpus file-backed so adding a
// new scenario is just dropping in one JSON listing fixture.
export const EVAL_CASES: ClassifierEvalCase[] = loadFixtureFiles();
