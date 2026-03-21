import { describe, expect, test } from "vitest";
import {
  normalizePotentialProofLikeAbvFields,
  normalizePotentialProofLikeDecision,
  normalizePotentialProofToAbv,
} from "./abv";

describe("ABV normalization", () => {
  test("converts proof-like values to ABV", () => {
    expect(normalizePotentialProofToAbv(115.6)).toBe(57.8);
    expect(normalizePotentialProofToAbv(114)).toBe(57);
  });

  test("drops impossible values above proof range", () => {
    expect(normalizePotentialProofToAbv(2024)).toBeNull();
  });

  test("drops negative values", () => {
    expect(normalizePotentialProofToAbv(-1)).toBeNull();
  });

  test("normalizes abv fields on structured payloads", () => {
    expect(
      normalizePotentialProofLikeAbvFields({
        abv: 115.6,
        caskStrength: true,
      }),
    ).toEqual({
      abv: 57.8,
      caskStrength: true,
    });
  });

  test("normalizes create_new decision draft ABV fields", () => {
    expect(
      normalizePotentialProofLikeDecision({
        action: "create_new",
        proposedBottle: null,
        proposedRelease: {
          abv: 115.6,
          caskStrength: true,
        },
      }),
    ).toEqual({
      action: "create_new",
      proposedBottle: null,
      proposedRelease: {
        abv: 57.8,
        caskStrength: true,
      },
    });
  });
});
