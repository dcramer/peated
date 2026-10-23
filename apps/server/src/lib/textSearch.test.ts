import { textSearchQuery } from "./textSearch";

test("never interprets user operators as Boolean instructions", () => {
  expect(textSearchQuery('Reserve OR "cask" -NOT *')).toBe(
    '"reserve" AND "cask"',
  );
});

test("searches an operator word when it is the whole query", () => {
  expect(textSearchQuery("Or", { prefix: true })).toBe("or*");
  expect(textSearchQuery("or")).toBe('"or"');
  expect(textSearchQuery("Glen Or", { prefix: true })).toBe("glen*");
});

test("expands spelling errors without expanding numeric release identifiers", () => {
  expect(textSearchQuery("Benrines 1990 53.322 49.6", { fuzzy: true })).toBe(
    'benrines~1 AND "1990" AND "53.322" AND "49.6"',
  );
});

test("bounds repeated or oversized search input", () => {
  expect(textSearchQuery("oak oak")).toBe('"oak"');
  expect(
    textSearchQuery(
      Array.from({ length: 100 }, (_, i) => "word" + i).join(" "),
    ).split(" AND "),
  ).toHaveLength(32);
});

test("prefixes alphabetic tokens without expanding numeric identifiers", () => {
  expect(textSearchQuery("Speyside reser", { prefix: true })).toBe(
    "speyside* AND reser*",
  );
  expect(textSearchQuery("Speyside 199", { prefix: true })).toBe(
    'speyside* AND "199"',
  );
});

test("prefixes alphabetic tokens from two letters", () => {
  expect(textSearchQuery("Gl", { prefix: true })).toBe("gl*");
  expect(textSearchQuery("G", { prefix: true })).toBe('"g"');
});

test("drops words shared by most whiskies from a broad OR search", () => {
  expect(
    textSearchQuery("Arran 14-year-old Single Malt Scotch Whisky", {
      any: true,
    }),
  ).toBe('"arran" OR "14-year-old"');
  expect(
    textSearchQuery("Arran 14-year-old Single Malt Scotch Whisky", {
      any: true,
      fuzzy: true,
    }),
  ).toBe('arran~1 OR "14-year-old"');
});

test("keeps every word when a broad search has only shared words", () => {
  expect(textSearchQuery("Single Malt Scotch Whisky", { any: true })).toBe(
    '"single" OR "malt" OR "scotch" OR "whisky"',
  );
});

test("keeps shared words in an AND search", () => {
  expect(textSearchQuery("Old Pulteney 12", { prefix: true })).toBe(
    'old* AND pulteney* AND "12"',
  );
});
