import { findExactAliasBottleCandidate } from "./findExactAliasBottleCandidate";

describe("findExactAliasBottleCandidate", () => {
  test("returns a deterministic candidate for a literal stored alias", async ({
    fixtures,
  }) => {
    const bottle = await fixtures.Bottle({ name: "Uigeadail" });

    const candidate = await findExactAliasBottleCandidate(bottle.fullName);

    expect(candidate).toMatchObject({
      bottleId: bottle.id,
      fullName: bottle.fullName,
      source: expect.arrayContaining(["exact"]),
    });
  });

  test("returns null when no literal stored alias matches", async () => {
    await expect(
      findExactAliasBottleCandidate("No Stored Bottle Alias"),
    ).resolves.toBeNull();
  });
});
