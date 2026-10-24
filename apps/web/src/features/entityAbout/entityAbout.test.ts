import { mockBrora, mockEntityAbouts } from "@peated/server/orpc/mock/fixtures";
import { describe, expect, it } from "vitest";

import {
  fillYears,
  getCitationNumbers,
  getEraContext,
  getKeyFacts,
  getNameSpans,
  getOperatingSpans,
  getOwners,
  type EntityAbout,
} from "./entityAbout";

const brora = mockEntityAbouts.get(mockBrora.id)!;

describe("getOperatingSpans", () => {
  it("turns openings and closings into producing and silent spans", () => {
    expect(getOperatingSpans(brora)).toEqual([
      { label: "Producing", start: 1819, end: 1931 },
      { label: "Silent", start: 1931, end: 1938 },
      { label: "Producing", start: 1938, end: 1941 },
      { label: "Silent", start: 1941, end: 1945 },
      { label: "Producing", start: 1945, end: 1968 },
      { label: "Silent", start: 1968, end: 1968 },
      { label: "Producing", start: 1968, end: 1983 },
      { label: "Silent", start: 1983, end: 2021 },
      { label: "Producing", start: 2021, end: null },
    ]);
  });

  it("returns nothing until the opening is known", () => {
    const withoutOpening: EntityAbout = {
      ...brora,
      events: brora.events.filter((event) => event.kind !== "opened"),
    };

    expect(getOperatingSpans(withoutOpening)).toEqual([]);
  });
});

describe("getNameSpans", () => {
  it("follows the first name through each rename", () => {
    expect(getNameSpans(brora, "Brora")).toEqual([
      { label: "Clynelish", start: 1819, end: 1969 },
      { label: "Brora", start: 1969, end: null },
    ]);
  });
});

describe("getOwners", () => {
  it("lists acquisitions newest first, with the years each owner held it", () => {
    expect(
      getOwners(brora).map(({ label, start, end }) => [label, start, end]),
    ).toEqual([
      ["Diageo", 1997, null],
      ["Guinness", 1986, 1997],
      ["The Distillers Company", 1925, 1986],
      ["John Risk and the Distillers Company", 1912, 1925],
      ["James Ainslie & Co. and John Risk", 1896, 1912],
    ]);
  });
});

describe("getKeyFacts", () => {
  it("adds the founding year and first name before site facts", () => {
    expect(
      getKeyFacts(brora, "Brora").map(({ label, value }) => [label, value]),
    ).toEqual([
      ["Founded", "1819"],
      ["First name", "Clynelish, until 1969"],
      ["Water", "Clynemilton Burn"],
      ["Listed building", "Category B"],
    ]);
  });
});

describe("getCitationNumbers", () => {
  it("numbers sources in the order the page first cites them", () => {
    const numbers = getCitationNumbers(brora, getKeyFacts(brora, "Brora"));

    expect([...numbers.keys()].slice(0, 3)).toEqual(["hes", "df", "wf2"]);
    expect(new Set(numbers.values()).size).toBe(numbers.size);
  });
});

describe("getEraContext", () => {
  it("names the era a vintage falls in", () => {
    expect(getEraContext(brora, "Brora", 1972)).toEqual({
      kind: "era",
      span: { label: "Heavily peated", start: 1969, end: 1973 },
    });
  });

  it("names the former name when no era covers the vintage", () => {
    expect(getEraContext(brora, "Brora", 1965)).toEqual({
      kind: "name",
      span: { label: "Clynelish", start: 1819, end: 1969 },
    });
  });

  it("says nothing for a vintage with no era under today's name", () => {
    expect(getEraContext(brora, "Brora", 1981)).toBeNull();
  });
});

describe("fillYears", () => {
  it("keeps empty years between the first and last vintage", () => {
    expect(
      fillYears({
        results: [
          { year: 1970, count: 1 },
          { year: 1972, count: 2 },
        ],
        withoutYear: 0,
      }),
    ).toEqual([
      { year: 1970, count: 1 },
      { year: 1971, count: 0 },
      { year: 1972, count: 2 },
    ]);
  });
});
