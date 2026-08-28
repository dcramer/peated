import { describe, expect, it } from "vitest";

import {
  buildTastingCreateFormSubmission,
  buildTastingEditFormSubmission,
  buildTastingTagOptions,
  type TastingFormFields,
} from "./tastingForm";

const fields: TastingFormFields = {
  ratingBand: "good",
  notes: "Orchard fruit",
  tags: ["apple"],
  color: 8,
  servingStyle: "neat",
  friends: [],
};

describe("tasting form submissions", () => {
  it("builds create payloads with one Bottle and image intent", () => {
    const image = new File([], "label.jpg");
    expect(
      buildTastingCreateFormSubmission({
        fields,
        image,
        bottleId: 12,
      }),
    ).toEqual({ ...fields, bottle: 12, image });
    expect(
      buildTastingCreateFormSubmission({
        fields,
        image: undefined,
        bottleId: 12,
      }),
    ).toEqual({ ...fields, bottle: 12, image: undefined });
  });

  it("builds content-only edit payloads and preserves image intent", () => {
    const cleared = buildTastingEditFormSubmission({ fields, image: null });
    expect(cleared).toEqual({ ...fields, image: null });
    expect(cleared).not.toHaveProperty("target");
    expect(cleared).not.toHaveProperty("bottle");
    expect(cleared).not.toHaveProperty("release");

    expect(
      buildTastingEditFormSubmission({ fields, image: undefined }),
    ).toEqual({ ...fields, image: undefined });
  });
});

describe("tasting tag options", () => {
  it("keeps group suggestions and current tags without metadata visible", () => {
    expect(
      buildTastingTagOptions(
        ["smoke", "orchard-fruit"],
        ["orchard-fruit", "old-current-tag"],
      ),
    ).toEqual([
      { id: "smoke", count: 0 },
      { id: "orchard-fruit", count: 0 },
      { id: "old-current-tag", count: 0 },
    ]);
  });
});
