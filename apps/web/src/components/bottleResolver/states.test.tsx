import type { Bottle } from "@peated/server/types";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import type { PhotoIdentification } from "./helpers";
import { PhotoMatchCreateState } from "./states";

function makeBottle(overrides: Partial<Bottle> = {}): Bottle {
  return {
    id: 42,
    fullName: "Springbank 12-year-old Cask Strength Batch 24",
    name: "12-year-old Cask Strength Batch 24",
    group: {
      id: 7,
      name: "12-year-old Cask Strength",
      fullName: "Springbank 12-year-old Cask Strength",
      statedAge: 12,
    },
    brand: { id: 1, name: "Springbank" },
    series: null,
    edition: "Batch 24",
    category: "single_malt",
    statedAge: 12,
    abv: 57.2,
    vintageYear: null,
    releaseYear: 2023,
    singleCask: false,
    caskStrength: true,
    caskFill: null,
    caskType: null,
    caskSize: null,
    ...overrides,
  } as Bottle;
}

const result = {
  imageEvidence: { fieldCandidates: {} },
} as unknown as PhotoIdentification;

function renderMatchedBottle(bottle: Bottle) {
  return renderToStaticMarkup(
    <PhotoMatchCreateState
      result={result}
      previewUrl={null}
      matchedBottle={bottle}
      createProposalLabel={null}
      hasCreateDecision={false}
      proposedName={null}
      createPending={false}
      createActionLabel="Create"
      resolvingAction={null}
      hasLibraryEntry={false}
      pendingImage={null}
      loadingExactLibraryStatus={false}
      onLoadBottle={vi.fn()}
      onAcceptCreateProposal={vi.fn()}
    />,
  );
}

describe("PhotoMatchCreateState", () => {
  it("shows the matched bottle release year alongside its edition", () => {
    const html = renderMatchedBottle(makeBottle());

    expect(html).toContain("Batch 24");
    expect(html).toContain("2023 release");
  });

  it("does not repeat a release year already expressed by the edition", () => {
    const html = renderMatchedBottle(makeBottle({ edition: "2023 Release" }));

    expect(html.match(/2023 release/gi)).toHaveLength(1);
  });
});
