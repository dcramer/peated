import { describe, expect, test } from "vitest";
import { z } from "zod";
import {
  BottleCandidateSchema,
  type BottleCandidate,
} from "../classifierTypes";
import { mergeBottleCandidate } from "./candidates";

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
});
