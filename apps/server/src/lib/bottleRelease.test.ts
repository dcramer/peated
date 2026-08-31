import {
  formatReleaseDate,
  isValidReleaseDate,
  parseExactReleaseDate,
} from "./bottleRelease";

test.each([
  [{ releaseYear: null, releaseMonth: null, releaseDay: null }, true],
  [{ releaseYear: 2024, releaseMonth: null, releaseDay: null }, true],
  [{ releaseYear: 2024, releaseMonth: 2, releaseDay: null }, true],
  [{ releaseYear: 2024, releaseMonth: 2, releaseDay: 29 }, true],
  [{ releaseYear: null, releaseMonth: 2, releaseDay: null }, false],
  [{ releaseYear: 2024, releaseMonth: null, releaseDay: 1 }, false],
  [{ releaseYear: 2023, releaseMonth: 2, releaseDay: 29 }, false],
] as const)("validates partial release date %o", (parts, expected) => {
  expect(isValidReleaseDate(parts)).toBe(expected);
});

test("parses only valid exact ISO dates", () => {
  expect(parseExactReleaseDate("2024-09-15")).toEqual({
    releaseYear: 2024,
    releaseMonth: 9,
    releaseDay: 15,
  });
  expect(parseExactReleaseDate("2024-02-30")).toBeNull();
  expect(parseExactReleaseDate("September 15, 2024")).toBeNull();
});

test.each([
  [{ releaseYear: 2024, releaseMonth: null, releaseDay: null }, "2024"],
  [{ releaseYear: 2024, releaseMonth: 9, releaseDay: null }, "Sep 2024"],
  [{ releaseYear: 2024, releaseMonth: 9, releaseDay: 15 }, "Sep 15, 2024"],
] as const)("formats known release precision", (parts, expected) => {
  expect(formatReleaseDate(parts)).toBe(expected);
});
