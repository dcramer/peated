// Drafts a decision eval test case from a saved production classifier run.
//
//   pnpm -s cli api get '/audits/runs?sourceKind=review&sourceId=123' > run.json
//   pnpm --filter @peated/bottle-classifier fixtures:draft "$PWD/run.json" <fixture-id> "$PWD/<out-dir>"
//
// Writes <fixture-id>.json, a decision test case with the observed input,
// candidates, Bottle and Entity context, and a provenance outline, and
// <fixture-id>.evidence.json, a reviewed-evidence pack with the run's web and
// label evidence for controlled comparisons. A person must still verify the
// Bottle online, write `expected`, and complete `provenance`; the fixture
// validator rejects the draft until they do.
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const [runPath, fixtureId, outDir] = process.argv.slice(2);
if (!runPath || !fixtureId || !outDir) {
  console.error(
    "Usage: draft-eval-fixture.mjs <run.json> <fixture-id> <out-dir>",
  );
  process.exit(1);
}

const response = JSON.parse(await readFile(runPath, "utf8"));
const run = response.results?.[0];
if (!run?.input?.reference || !run.artifacts) {
  throw new Error(`${runPath} does not contain a saved classifier run.`);
}
const { input, output, artifacts } = run;
const decision = output?.decision ?? null;

// The runtime context carries parsed label evidence; test cases keep the image
// source only and replay the label reading through the evidence pack.
const bottleContexts = (artifacts.bottleContexts ?? []).map(
  ({ publicImages = [], ...context }) => ({
    ...context,
    imageSources: publicImages.map(
      ({ labelEvidence: _label, ...image }) => image,
    ),
  }),
);
const imageResults = (artifacts.bottleContexts ?? []).flatMap(
  ({ publicImages = [] }) =>
    publicImages
      .filter((image) => image.labelEvidence)
      .map((image) => ({
        url: image.url,
        result: image.labelEvidence.extractedIdentity,
      })),
);

const fixture = {
  id: fixtureId,
  name: `${input.reference.name}: describe the expected outcome`,
  input: {
    reference: input.reference,
    extractedIdentity: artifacts.extractedIdentity ?? null,
    imageEvidence: artifacts.imageEvidence ?? null,
    initialCandidates: artifacts.candidates ?? [],
  },
  context: {
    inspectedBottleIds: bottleContexts.map((context) => context.bottleId),
    bottleContexts,
    inspectedEntities: artifacts.resolvedEntities ?? [],
    inspectedSeries: [],
  },
  provenance: {
    source: "production_miss",
    verifiedSourceUrls: [],
    dbOutcome: {
      bottleId: decision?.matchedBottleId ?? null,
      createsBottle: decision?.action === "create_bottle",
      summary: `Production returned ${decision?.action ?? output?.status ?? "no decision"}${decision?.proposedBottle ? ` with the name \`${decision.proposedBottle.name}\`` : ""}.`,
    },
    notes: `Captured from saved classifier run ${run.id} (${run.sourceKind} ${run.sourceId}, model ${run.model}, ${run.createdAt}). Production rationale: ${decision?.rationale ?? "none"}`,
  },
  expected: {
    status: "classified",
    summary: "Write the verified expected outcome.",
  },
};

const evidence = {
  name: `${fixtureId} production evidence`,
  reviewedAt: new Date().toISOString().slice(0, 10),
  sources: [
    ...new Set(
      (artifacts.searchEvidence ?? []).flatMap((entry) =>
        (entry.results ?? []).map((result) => result.url),
      ),
    ),
  ],
  cases: {
    [fixtureId]: {
      searchResult: { evidence: artifacts.searchEvidence ?? [], errors: [] },
      pageResults: [],
      imageResults,
    },
  },
};

await writeFile(
  join(outDir, `${fixtureId}.json`),
  `${JSON.stringify(fixture, null, 2)}\n`,
);
await writeFile(
  join(outDir, `${fixtureId}.evidence.json`),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
console.log(
  `Wrote ${fixtureId}: ${fixture.input.initialCandidates.length} candidates, ${bottleContexts.length} Bottle contexts, ${evidence.cases[fixtureId].searchResult.evidence.length} search results, ${imageResults.length} label readings.`,
);
