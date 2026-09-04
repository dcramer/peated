import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  BottleCandidateSchema,
  type BottleCandidate,
  type EntityResolution,
} from "../classifierTypes";
import { mergeBottleCandidate, mergeResolvedEntity } from "./candidates";

describe("mergeBottleCandidate", () => {
  test("keeps candidates JSON-safe when duplicate results have no family context", () => {
    const first = BottleCandidateSchema.parse({
      bottleId: 1,
      fullName: "Example Small Batch",
      source: ["exact"],
    });
    const second = BottleCandidateSchema.parse({
      bottleId: 1,
      fullName: "Example Small Batch",
      source: ["search"],
    });
    const candidates = new Map<number, BottleCandidate>();

    mergeBottleCandidate(candidates, first);
    mergeBottleCandidate(candidates, second);

    const merged = candidates.get(1);
    expect(merged?.familyContext).toBeNull();
    expect(z.json().safeParse(merged).success).toBe(true);
  });

  test("keeps the accepted reference that produced an exact match", () => {
    const candidates = new Map<number, BottleCandidate>();

    mergeBottleCandidate(
      candidates,
      BottleCandidateSchema.parse({
        bottleId: 1,
        reference: "Similar search reference",
        fullName: "Example Small Batch",
        source: ["vector"],
      }),
    );
    mergeBottleCandidate(
      candidates,
      BottleCandidateSchema.parse({
        bottleId: 1,
        reference: "Accepted exact reference",
        fullName: "Example Small Batch",
        source: ["exact"],
      }),
    );

    expect(candidates.get(1)).toMatchObject({
      reference: "Accepted exact reference",
      source: ["vector", "exact"],
    });
  });
});

describe("mergeResolvedEntity", () => {
  test("keeps the exact source record for a repeated query", () => {
    const entities = new Map<number, EntityResolution>();
    const base = {
      entityId: 1953,
      name: "Komagatake",
      shortName: null,
      kind: "brand" as const,
      reference: "Mars Shinshu Distillery",
      score: 0.8,
      source: ["text"],
    };

    mergeResolvedEntity(entities, {
      ...base,
      retrievedFor: [{ query: "Mars Shinshu Distillery" }],
    });
    mergeResolvedEntity(entities, {
      ...base,
      score: 1,
      source: ["exact"],
      retrievedFor: [
        { query: "Mars Shinshu Distillery", exact: true as const },
      ],
    });

    expect(entities.get(1953)?.retrievedFor).toEqual([
      { query: "Mars Shinshu Distillery", exact: true },
    ]);
  });
});
