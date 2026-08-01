import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { z } from "zod";
import type { BottleContextSource } from "./bottleContextContract";
import type { BottleCandidate } from "./classifierTypes";
import type { ClassifyBottleReferenceInput } from "./contract";
import type { classifierEvalExpectationSchema } from "./evalFixtureSchemas";
import {
  classifierEvalFixtureSchema,
  listFixtureFiles,
} from "./evalFixtureSchemas";
import type { LocalCatalog } from "./localCatalog";

export type SearchResponseFixture = {
  when: string[];
  results: BottleCandidate[];
};

export type ClassifierEvalExpectation = z.infer<
  typeof classifierEvalExpectationSchema
>;

export type ClassifierEvalContext = z.infer<
  typeof classifierEvalFixtureSchema
>["context"];

export type ClassifierEvalCase = {
  fixtureId: string;
  name: string;
  input: ClassifyBottleReferenceInput;
  localCatalog?: LocalCatalog;
  searchResponses?: SearchResponseFixture[];
  requireExpectedOperationEvidence: boolean;
  context: ClassifierEvalContext;
  expected: ClassifierEvalExpectation;
};

export async function loadClassifierEvalBottleContext({
  context,
  bottleId,
  fallback,
}: {
  context: ClassifierEvalContext;
  bottleId: number;
  fallback: () => Promise<BottleContextSource | null>;
}): Promise<BottleContextSource | null> {
  if (!context.inspectedBottleIds.includes(bottleId)) {
    return null;
  }

  const explicitContext = context.bottleContexts?.find(
    (candidate) => candidate.bottleId === bottleId,
  );
  return explicitContext ?? (await fallback());
}

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
      localCatalog: fixture.localCatalog,
      searchResponses: fixture.searchResponses,
      requireExpectedOperationEvidence:
        fixture.requireExpectedOperationEvidence,
      context: fixture.context,
      expected: fixture.expected,
    };
  });
}

// Keep the decision-oriented classifier eval corpus file-backed so adding a
// new scenario is just dropping in one JSON listing fixture.
export const EVAL_CASES: ClassifierEvalCase[] = loadFixtureFiles();
