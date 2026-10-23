import type { MockOutputs } from "../contract";
import { mockBottle, mockBottles } from "./bottles";
import { mockEntity } from "./entities";

type TastingDraft = MockOutputs["tastingDrafts"]["list"]["results"][number];

function bottleById(id: number) {
  const bottle = mockBottles.find((item) => item.id === id);
  if (!bottle) throw new Error(`Missing mock Bottle ${id}`);
  return bottle;
}

const draftDefaults = {
  bottleHint: null,
  bottle: null,
  imageUrl: null,
  identification: { status: "none", result: null },
  notes: null,
  ratingBand: null,
  tags: [],
  servingStyle: null,
  color: null,
  friends: [],
} satisfies Partial<TastingDraft>;

/**
 * One draft for each inbox state: a chosen Bottle, a suggested match, a new
 * Bottle proposal, identification in progress, and no Bottle or hint. Drafts
 * are synthetic samples, ordered most recently saved first.
 */
export const mockTastingDrafts: TastingDraft[] = [
  {
    ...draftDefaults,
    id: "6f1c2a4e-3b7d-4c8e-9a1f-2d3e4f5a6b01",
    tastedAt: "2026-10-22T20:30:00.000Z",
    bottle: bottleById(9309),
    notes: "Brine and vanilla.",
    ratingBand: "outstanding",
    tags: ["peat", "brine"],
    createdAt: "2026-10-22T20:35:00.000Z",
    updatedAt: "2026-10-22T21:05:00.000Z",
  },
  {
    ...draftDefaults,
    id: "6f1c2a4e-3b7d-4c8e-9a1f-2d3e4f5a6b02",
    tastedAt: "2026-10-22T19:45:00.000Z",
    bottle: mockBottle,
    createdAt: "2026-10-22T19:50:00.000Z",
    updatedAt: "2026-10-22T20:50:00.000Z",
  },
  {
    ...draftDefaults,
    id: "6f1c2a4e-3b7d-4c8e-9a1f-2d3e4f5a6b03",
    tastedAt: "2026-10-21T21:00:00.000Z",
    bottleHint: "the peppery one from Skye",
    identification: {
      status: "done",
      result: { action: "match", bottle: bottleById(9312) },
    },
    createdAt: "2026-10-21T21:05:00.000Z",
    updatedAt: "2026-10-21T21:06:00.000Z",
  },
  {
    ...draftDefaults,
    id: "6f1c2a4e-3b7d-4c8e-9a1f-2d3e4f5a6b04",
    tastedAt: "2026-10-20T20:00:00.000Z",
    bottleHint: "Lagavulin with the purple label",
    identification: {
      status: "done",
      result: {
        action: "create_bottle",
        proposedBottle: {
          name: "Distillers Edition",
          brand: { id: mockEntity.id, name: mockEntity.name },
          series: null,
          category: "single_malt",
          edition: null,
          statedAge: null,
          abv: null,
          caskStrength: null,
          singleCask: null,
          maturation: null,
          caskNumber: null,
          outturn: null,
          vintageYear: null,
          releaseYear: null,
          distillers: [],
          bottler: null,
        },
      },
    },
    createdAt: "2026-10-20T20:05:00.000Z",
    updatedAt: "2026-10-20T20:06:00.000Z",
  },
  {
    ...draftDefaults,
    id: "6f1c2a4e-3b7d-4c8e-9a1f-2d3e4f5a6b05",
    tastedAt: "2026-10-19T22:00:00.000Z",
    bottleHint: "bar pour, label in Japanese",
    identification: { status: "pending", result: null },
    createdAt: "2026-10-19T22:05:00.000Z",
    updatedAt: "2026-10-19T22:05:00.000Z",
  },
  {
    ...draftDefaults,
    id: "6f1c2a4e-3b7d-4c8e-9a1f-2d3e4f5a6b06",
    tastedAt: "2026-10-18T20:00:00.000Z",
    createdAt: "2026-10-18T20:05:00.000Z",
    updatedAt: "2026-10-18T20:05:00.000Z",
  },
];
