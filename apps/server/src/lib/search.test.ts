import { expect, it } from "vitest";
import {
  buildBottleSearchDocuments,
  buildBottleSeriesSearchDocument,
  buildEntitySearchDocument,
} from "./search";

it("puts a bottle's series among its names", () => {
  const documents = buildBottleSearchDocuments(
    {
      fullName: "Decadent Drinks Glenburgie 38-year-old",
      name: "Glenburgie 38-year-old",
      brandId: 1,
      createdByActorId: 1,
    },
    {
      name: "Decadent Drinks",
      kind: "bottler",
      createdByActorId: 1,
    },
    [],
    undefined,
    [],
    {
      name: "Whiskyland",
      fullName: "Decadent Drinks Whiskyland",
      brandId: 1,
      createdByActorId: 1,
    },
  );

  expect(documents.searchNames.split("\n")).toContain("Whiskyland");
});

it("keeps release facts out of the names document", () => {
  const documents = buildBottleSearchDocuments(
    {
      name: "Single Cask",
      fullName: "Test Single Cask",
      brandId: 1,
      createdByActorId: 1,
      abv: 56.75,
      statedAge: 12,
    },
    { name: "Test", kind: "brand", createdByActorId: 1 },
  );
  expect(documents.searchNames).toBe("Test Single Cask");
  expect(documents.searchTerms).toContain("56.75% ABV");
  expect(documents.searchTerms).not.toContain("56.8% ABV");
  expect(documents.searchTerms).toContain("12-year-old");
});

it("puts every Entity name and alias in one search document", () => {
  const document = buildEntitySearchDocument(
    {
      name: "The Glenlivet Distillery",
      shortName: "Glenlivet",
      kind: "distillery",
      createdByActorId: 1,
    },
    [{ name: "The Glenlivet Distillery" }, { name: "Glenlivet Distillers" }],
  );
  expect(document.searchNames).toBe(
    "The Glenlivet Distillery\nGlenlivet\nGlenlivet Distillers",
  );
});

it("puts the Brand names in the Series document without repeats", () => {
  const document = buildBottleSeriesSearchDocument(
    {
      name: "Octomore",
      fullName: "Bruichladdich Distillery Octomore",
      brandId: 1,
      createdByActorId: 1,
    },
    {
      name: "Bruichladdich Distillery",
      shortName: "Bruichladdich",
      kind: "distillery",
      createdByActorId: 1,
    },
  );
  expect(document.searchNames).toBe(
    "Bruichladdich Distillery Octomore\nBruichladdich Distillery\nBruichladdich Octomore",
  );
});
