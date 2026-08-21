import { parseDate } from "./dates";

test.each([
  ["2026-08-18", "2026-08-18T00:00:00.000Z"],
  ["2026-08-18T10:00:00", "2026-08-18T10:00:00.000Z"],
  ["2026-08-18T09:30:00+01:00", "2026-08-18T08:30:00.000Z"],
  ["18 Aug, 2026", "2026-08-18T00:00:00.000Z"],
  ["18 August 2026", "2026-08-18T00:00:00.000Z"],
  ["18 Sept 2026", "2026-09-18T00:00:00.000Z"],
  ["August 18, 2026", "2026-08-18T00:00:00.000Z"],
  ["Thu, 20 Aug 2026 08:21:00 +0200", "2026-08-20T06:21:00.000Z"],
])("parses %s", (value, expected) => {
  expect(parseDate(value)).toEqual(new Date(expected));
});

test("uses an explicit fallback year for a partial date", () => {
  expect(parseDate("18 Aug", { fallbackYear: 2026 })).toEqual(
    new Date("2026-08-18T00:00:00.000Z"),
  );
  expect(parseDate("18 Aug")).toBeNull();
});

test.each(["", "not a date", "2026-02-30", "31 Apr 2026"])(
  "rejects %s",
  (value) => {
    expect(parseDate(value)).toBeNull();
  },
);
