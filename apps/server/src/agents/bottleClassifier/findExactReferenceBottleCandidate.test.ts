import {
  findExactReferenceBottleCandidate,
  resolveExactReferenceBottleRun,
} from "./findExactReferenceBottleCandidate";
import { runBottleReference } from "./service";

describe("findExactReferenceBottleCandidate", () => {
  test("returns a deterministic candidate for a literal stored reference", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Uigeadail" });

    const candidate = await findExactReferenceBottleCandidate(bottle.fullName);

    expect(candidate).toMatchObject({
      bottleId: bottle.id,
      reference: bottle.fullName,
      fullName: bottle.fullName,
      source: expect.arrayContaining(["exact"]),
    });
  });

  test("returns the accepted reference that produced the match", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Uigeadail" });
    await fixtures.BottleReference({
      bottleId: bottle.id,
      name: "Ardbeg The Ultimate Uigeadail",
    });

    const candidate = await findExactReferenceBottleCandidate(
      "Ardbeg The Ultimate Uigeadail",
    );

    expect(candidate).toMatchObject({
      bottleId: bottle.id,
      reference: "Ardbeg The Ultimate Uigeadail",
      source: expect.arrayContaining(["exact"]),
    });
  });

  test("builds a deterministic match without model metadata", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Uigeadail" });

    const run = await resolveExactReferenceBottleRun({
      reference: { name: bottle.fullName },
      extractedIdentity: null,
    });

    expect(run).toMatchObject({
      result: {
        status: "classified",
        decision: {
          action: "match",
          matchedBottleId: bottle.id,
          candidateBottleIds: [bottle.id],
          referenceScope: "none",
          confidenceBasis: {
            unresolvedRisks: [],
            webEvidence: "not_needed",
          },
        },
        artifacts: {
          candidates: [
            expect.objectContaining({
              bottleId: bottle.id,
              reference: bottle.fullName,
              source: expect.arrayContaining(["exact"]),
            }),
          ],
        },
      },
      modelMetadata: null,
    });
  });

  test("the server classifier entry point skips the model", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Uigeadail" });

    const run = await runBottleReference({
      reference: { name: bottle.fullName },
    });

    expect(run.result).toMatchObject({
      status: "classified",
      decision: {
        action: "match",
        matchedBottleId: bottle.id,
      },
    });
    expect(run.modelMetadata).toBeNull();
  });

  test("does not resolve an ignored or unassigned reference", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Uigeadail" });
    await fixtures.BottleReference({
      bottleId: bottle.id,
      ignored: true,
      name: "Ignored Uigeadail Reference",
    });
    await fixtures.BottleReference({
      bottleId: null,
      name: "Unassigned Uigeadail Reference",
    });

    await expect(
      resolveExactReferenceBottleRun({
        reference: { name: "Ignored Uigeadail Reference" },
      }),
    ).resolves.toBeNull();
    await expect(
      resolveExactReferenceBottleRun({
        reference: { name: "Unassigned Uigeadail Reference" },
      }),
    ).resolves.toBeNull();
  });

  test("does not treat a display alias as an accepted reference", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Uigeadail" });
    await fixtures.BottleAlias({
      bottleId: bottle.id,
      name: "Ultimate Islay Alias",
    });

    await expect(
      resolveExactReferenceBottleRun({
        reference: { name: "Ultimate Islay Alias" },
      }),
    ).resolves.toBeNull();
  });

  test("returns null when no literal stored reference matches", async () => {
    await expect(
      findExactReferenceBottleCandidate("No Stored Bottle Reference"),
    ).resolves.toBeNull();
  });
});
