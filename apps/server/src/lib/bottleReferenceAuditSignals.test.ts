import { getBottleReferenceAuditSignals } from "./bottleReferenceAuditSignals";

const bottle = {
  id: 1,
  fullName: "SMWS 1.234 Hello World 12-year-old",
  statedAge: 12,
  abv: 57.1,
  vintageYear: 2010,
  releaseYear: 2023,
  edition: "First Fill",
  caskNumber: "1234",
};

describe("getBottleReferenceAuditSignals", () => {
  test("reports explicit identity conflicts deterministically", () => {
    const signals = getBottleReferenceAuditSignals({
      referenceName:
        "SMWS 2.99 10-year-old 55.0% ABV vintage 2011 2024 release cask 987 edition Refill",
      bottle,
      siblings: [],
    });
    expect(signals.map(({ kind }) => kind)).toEqual([
      "smws_conflict",
      "age_conflict",
      "abv_conflict",
      "vintage_year_conflict",
      "release_year_conflict",
      "cask_conflict",
      "edition_conflict",
    ]);
  });

  test("reports overlap, generic prefixes, and sibling ambiguity", () => {
    const signals = getBottleReferenceAuditSignals({
      referenceName: "SMWS 1.234",
      bottle,
      siblings: [
        { ...bottle, id: 2, fullName: "SMWS 1.234 Foo Bar 13-year-old" },
      ],
      normalizedOverlapNames: ["SMWS   1.234"],
    });
    expect(signals.map(({ kind }) => kind)).toEqual([
      "normalized_overlap",
      "generic_prefix",
      "sibling_ambiguity",
    ]);
  });
});
