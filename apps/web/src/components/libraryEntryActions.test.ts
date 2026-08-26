import type { Outputs } from "@peated/server/orpc/router";
import { QueryClient, type QueryKey } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  LibraryEntryStatusMenu,
  removeCollectionBottleFromListCaches,
  replaceCollectionBottleInListCaches,
} from "./libraryEntryActions";

type CollectionBottleList = Outputs["collections"]["bottles"]["list"];
type CollectionBottle = CollectionBottleList["results"][number];

const collectionBottleListQueryKey = [
  ["collections", "bottles", "list"],
  { type: "query" },
] as const satisfies QueryKey;

const firstListQueryKey = [
  ["collections", "bottles", "list"],
  {
    input: { collection: "library", cursor: 1, user: "alice" },
    type: "query",
  },
] as const satisfies QueryKey;

const filteredListQueryKey = [
  ["collections", "bottles", "list"],
  {
    input: {
      collection: "library",
      cursor: 1,
      status: "sealed",
      user: "alice",
    },
    type: "query",
  },
] as const satisfies QueryKey;

const unrelatedQueryKey = [
  ["search", "results"],
  {
    input: {
      legacyLookingMetadata: {
        collectionResource: "collections",
        bottleResource: "bottles",
        operation: "list",
        collection: "library",
        username: "alice",
      },
    },
    type: "query",
  },
] as const satisfies QueryKey;

function makeUnrelatedData(collidingId: number) {
  return {
    results: [
      {
        id: collidingId,
        legacyLookingMetadata: {
          collectionResource: "collections",
          bottleResource: "bottles",
          operation: "list",
          collection: "library",
          username: "alice",
        },
      },
    ],
  };
}

function makeCollectionBottle(id: number): CollectionBottle {
  const timestamp = "2026-07-21T12:00:00.000Z";

  return {
    id,
    imageUrl: null,
    status: "sealed",
    bottle: {
      id: id + 100,
      peatedId: `B${String(id + 100).padStart(4, "0")}`,
      fullName: `Bottle ${id}`,
      name: `Bottle ${id}`,
      series: null,
      category: "single_malt",
      edition: null,
      statedAge: null,
      caskStrength: null,
      singleCask: null,
      naturalColor: null,
      nonChillFiltered: null,
      maltPhenolPpm: null,
      noAgeStatement: null,
      abv: null,
      vintageYear: null,
      bottlingYear: null,
      releaseYear: null,
      releaseDate: null,
      maturation: null,
      caskNumber: null,
      outturn: null,
      brand: {
        id: 1,
        peatedId: "E0001",
        name: "Test Brand",
        shortName: null,
        type: ["brand"],
        kind: null,
        ownerId: null,
        description: null,
        descriptionSrc: null,
        yearEstablished: null,
        website: null,
        country: null,
        region: null,
        address: null,
        location: null,
        totalTastings: 0,
        totalBottles: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      distillers: [],
      bottler: null,
      description: null,
      descriptionSrc: null,
      imageUrl: null,
      flavorProfile: null,
      tastingNotes: null,
      suggestedTags: [],
      avgRating: null,
      avgScore: null,
      totalScores: 0,
      ratingStats: {
        pass: 0,
        sip: 0,
        savor: 0,
        total: 0,
        avg: null,
        percentage: { pass: 0, sip: 0, savor: 0 },
      },
      totalTastings: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      isFavorite: false,
      isLibrary: true,
      hasTasted: false,
    },
    hasTasted: false,
  };
}

function makeCollectionBottleList(
  results: CollectionBottle[],
  nextCursor: number | null,
): CollectionBottleList {
  return {
    results,
    rel: { nextCursor, prevCursor: null },
  };
}

describe("Library entry list caches", () => {
  it("replaces an entry by its globally unique id in every list query", () => {
    const queryClient = new QueryClient();
    const originalEntry = makeCollectionBottle(10);
    const otherEntry = makeCollectionBottle(11);
    const firstList = makeCollectionBottleList([originalEntry, otherEntry], 2);
    const filteredList = makeCollectionBottleList([originalEntry], null);
    const unrelatedData = makeUnrelatedData(originalEntry.id);

    queryClient.setQueryData(firstListQueryKey, firstList);
    queryClient.setQueryData(filteredListQueryKey, filteredList);
    queryClient.setQueryData(unrelatedQueryKey, unrelatedData);

    const updatedEntry = {
      ...originalEntry,
      imageUrl: "https://example.com/library-entry.jpg",
      status: "open",
    } satisfies CollectionBottle;
    replaceCollectionBottleInListCaches(
      queryClient,
      collectionBottleListQueryKey,
      updatedEntry,
    );

    const updatedFirstList =
      queryClient.getQueryData<CollectionBottleList>(firstListQueryKey);
    const updatedFilteredList =
      queryClient.getQueryData<CollectionBottleList>(filteredListQueryKey);

    expect(updatedFirstList?.results).toEqual([updatedEntry, otherEntry]);
    expect(updatedFilteredList?.results).toEqual([updatedEntry]);
    expect(updatedFirstList?.rel).toBe(firstList.rel);
    expect(updatedFilteredList?.rel).toBe(filteredList.rel);
    expect(queryClient.getQueryData(unrelatedQueryKey)).toBe(unrelatedData);
  });

  it("removes an entry by its globally unique id from every list query", () => {
    const queryClient = new QueryClient();
    const removedEntry = makeCollectionBottle(10);
    const retainedEntry = makeCollectionBottle(11);
    const firstList = makeCollectionBottleList(
      [removedEntry, retainedEntry],
      2,
    );
    const filteredList = makeCollectionBottleList([removedEntry], null);
    const unrelatedData = makeUnrelatedData(removedEntry.id);

    queryClient.setQueryData(firstListQueryKey, firstList);
    queryClient.setQueryData(filteredListQueryKey, filteredList);
    queryClient.setQueryData(unrelatedQueryKey, unrelatedData);

    removeCollectionBottleFromListCaches(
      queryClient,
      collectionBottleListQueryKey,
      removedEntry.id,
    );

    const updatedFirstList =
      queryClient.getQueryData<CollectionBottleList>(firstListQueryKey);
    const updatedFilteredList =
      queryClient.getQueryData<CollectionBottleList>(filteredListQueryKey);

    expect(updatedFirstList?.results).toEqual([retainedEntry]);
    expect(updatedFilteredList?.results).toEqual([]);
    expect(updatedFirstList?.rel).toBe(firstList.rel);
    expect(updatedFilteredList?.rel).toBe(filteredList.rel);
    expect(queryClient.getQueryData(unrelatedQueryKey)).toBe(unrelatedData);
  });
});

describe("Library entry status menu", () => {
  it("renders the current status as a compact semantic control", () => {
    const html = renderToStaticMarkup(
      createElement(LibraryEntryStatusMenu, {
        value: "sealed",
        disabled: false,
        onChange: () => {},
      }),
    );

    expect(html).toContain("Sealed");
    expect(html).toContain('data-status="sealed"');
    expect(html).toContain("rounded-full");
    expect(html).toContain("border-emerald");
    expect(html).toContain("bg-emerald");
    expect(html).toContain(
      'aria-label="Change bottle status, current status Sealed"',
    );
  });
});
