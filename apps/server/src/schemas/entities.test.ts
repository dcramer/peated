import {
  EntityPronunciationIpaSchema,
  EntityPronunciationSchema,
} from "./entities";

describe("EntityPronunciationSchema", () => {
  test.each(["glen GEER-ee", "lag-uh-VOO-lin", "BAYNZ", "boo-nuh-HAH-vun"])(
    "accepts %s",
    (pronunciation) => {
      expect(EntityPronunciationSchema.parse(pronunciation)).toBe(
        pronunciation,
      );
    },
  );

  test("trims surrounding spaces", () => {
    expect(EntityPronunciationSchema.parse("  glen GEER-ee ")).toBe(
      "glen GEER-ee",
    );
  });

  test("accepts null", () => {
    expect(EntityPronunciationSchema.parse(null)).toBeNull();
  });

  test.each([
    ["no stressed syllable", "glen geer-ee"],
    ["a mixed-case syllable", "Glen GEER-ee"],
    ["digits", "glen GEER-ee 2"],
    ["IPA symbols", "ɡlɛn ˈɡɪəri"],
    ["an empty syllable", "glen GEER--ee"],
    ["an empty value", " "],
  ])("rejects %s", (_reason, pronunciation) => {
    const result = EntityPronunciationSchema.safeParse(pronunciation);
    expect(result.error?.issues[0]?.message).toBe(
      'Use lowercase syllables with the stressed one in capitals, like "glen GEER-ee".',
    );
  });

  test("rejects values over 100 characters", () => {
    expect(
      EntityPronunciationSchema.safeParse(`GLEN ${"ee-".repeat(40)}ee`).success,
    ).toBe(false);
  });
});

describe("EntityPronunciationIpaSchema", () => {
  test.each(["ɡlɛn ˈɡɪəri", "ˌlæɡəˈvuːlɪn", "bʊnəˈhɑːvən"])(
    "accepts %s",
    (pronunciation) => {
      expect(EntityPronunciationIpaSchema.parse(pronunciation)).toBe(
        pronunciation,
      );
    },
  );

  test("accepts null", () => {
    expect(EntityPronunciationIpaSchema.parse(null)).toBeNull();
  });

  test.each([
    ["slashes", "/ɡlɛn ˈɡɪəri/"],
    ["brackets", "[ɡlɛn ˈɡɪəri]"],
    ["capital letters", "Glen GEER-ee"],
    ["digits", "ɡlɛn 2"],
    ["an empty value", " "],
  ])("rejects %s", (_reason, pronunciation) => {
    const result = EntityPronunciationIpaSchema.safeParse(pronunciation);
    expect(result.error?.issues[0]?.message).toBe(
      'Use IPA symbols without slashes, like "ɡlɛn ˈɡɪəri".',
    );
  });
});
