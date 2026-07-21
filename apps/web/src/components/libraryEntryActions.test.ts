import type { Outputs } from "@peated/server/orpc/router";
import { QueryClient, type QueryKey } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import {
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
    target: {
      schemaVersion: 1,
      kind: "group",
      targetId: id + 100,
      group: {
        schemaVersion: 1,
        id: id + 200,
        fullName: `Bottle group ${id}`,
        name: `Group ${id}`,
        brandId: 1,
        bottlerId: null,
        distillerIds: [],
        category: "single_malt",
        seriesId: null,
        statedAge: null,
        representativeBottleId: null,
        description: null,
        descriptionSrc: null,
        imageUrl: null,
        flavorProfile: null,
        tastingNotes: null,
        suggestedTags: [],
        avgRating: null,
        ratingStats: {
          pass: 0,
          sip: 0,
          savor: 0,
          total: 0,
          avg: null,
          percentage: { pass: 0, sip: 0, savor: 0 },
        },
        totalTastings: 0,
        totalBottles: 1,
        createdByActorId: 1,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
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
