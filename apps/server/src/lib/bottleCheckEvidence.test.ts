import { buildBottleClassificationArtifacts } from "@peated/bottle-classifier/contract";
import { describe, expect, test } from "vitest";

import { getPersistedBottleCheckSourceEvidencePaths } from "./bottleCheckEvidence";

describe("getPersistedBottleCheckSourceEvidencePaths", () => {
  test("derives known fields from a sanitized reference snapshot", () => {
    expect(
      getPersistedBottleCheckSourceEvidencePaths({
        intent: "resolve_reference",
        inputSnapshot: {
          reference: {
            name: "Example Bottle",
            imageUrl: {
              kind: "omitted_inline_image",
              mediaType: "image/jpeg",
              byteLength: 19,
            },
            unexpectedMetadata: "not source evidence",
          },
        },
        artifacts: {
          ...buildBottleClassificationArtifacts({
            extractedIdentity: {
              brand: "Example",
              bottler: null,
              expression: null,
              series: null,
              distillery: null,
              category: null,
              stated_age: null,
              abv: null,
              release_year: null,
              vintage_year: null,
              cask_strength: null,
              single_cask: null,
              maturation: null,
              cask_number: null,
              outturn: null,
              edition: null,
            },
          }),
        },
      }),
    ).toEqual([
      "reference.name",
      "reference.imageUrl",
      "extractedIdentity.brand",
    ]);
  });

  test("validates artifacts at the persisted JSON boundary", () => {
    expect(() =>
      getPersistedBottleCheckSourceEvidencePaths({
        intent: "resolve_reference",
        inputSnapshot: { reference: { name: "Example Bottle" } },
        artifacts: { candidates: "invalid" },
      }),
    ).toThrow();
  });
});
