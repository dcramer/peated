import { findExactReferenceBottleCandidate } from "./findExactReferenceBottleCandidate";

describe("findExactReferenceBottleCandidate", () => {
  test("returns a deterministic candidate for a literal stored reference", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Uigeadail" });

    const candidate = await findExactReferenceBottleCandidate(bottle.fullName);

    expect(candidate).toMatchObject({
      bottleId: bottle.id,
      fullName: bottle.fullName,
      source: expect.arrayContaining(["exact"]),
    });
  });

  test("returns null when no literal stored reference matches", async () => {
    await expect(
      findExactReferenceBottleCandidate("No Stored Bottle Reference"),
    ).resolves.toBeNull();
  });
});
