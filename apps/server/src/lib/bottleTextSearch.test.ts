import { bottleTextQuery } from "./bottleTextSearch";

test("never interprets user operators as Boolean instructions", () => {
  expect(bottleTextQuery('Reserve OR "cask" -NOT *')).toBe(
    '"reserve" AND "cask"',
  );
});

test("expands spelling errors without expanding numeric release identifiers", () => {
  expect(bottleTextQuery("Benrines 1990 53.322 49.6", { fuzzy: true })).toBe(
    'benrines~1 AND "1990" AND "53.322" AND "49.6"',
  );
});

test("bounds repeated or oversized search input", () => {
  expect(bottleTextQuery("oak oak")).toBe('"oak"');
  expect(
    bottleTextQuery(
      Array.from({ length: 100 }, (_, i) => "word" + i).join(" "),
    ).split(" AND "),
  ).toHaveLength(32);
});

test("prefixes alphabetic tokens without expanding numeric identifiers", () => {
  expect(bottleTextQuery("Speyside reser", { prefix: true })).toBe(
    "speyside* AND reser*",
  );
  expect(bottleTextQuery("Speyside 199", { prefix: true })).toBe(
    'speyside* AND "199"',
  );
});

test("drops words shared by most whiskies from a broad OR search", () => {
  expect(
    bottleTextQuery("Arran 14-year-old Single Malt Scotch Whisky", {
      any: true,
    }),
  ).toBe('"arran" OR "14-year-old"');
  expect(
    bottleTextQuery("Arran 14-year-old Single Malt Scotch Whisky", {
      any: true,
      fuzzy: true,
    }),
  ).toBe('arran~1 OR "14-year-old"');
});

test("keeps every word when a broad search has only shared words", () => {
  expect(bottleTextQuery("Single Malt Scotch Whisky", { any: true })).toBe(
    '"single" OR "malt" OR "scotch" OR "whisky"',
  );
});

test("keeps shared words in an AND search", () => {
  expect(bottleTextQuery("Old Pulteney 12", { prefix: true })).toBe(
    'old* AND pulteney* AND "12"',
  );
});
