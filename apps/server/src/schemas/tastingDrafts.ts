import { TASTING_DRAFT_BOTTLE_HINT_MAX_LENGTH } from "@peated/server/db/schema";
import { z } from "zod";
import { BottleSchema } from "./bottles";
import {
  TastedAtInputSchema,
  TastingContentInputSchema,
  TastingSchema,
} from "./tastings";

const TASTING_DETAIL_FIELDS = {
  notes: true,
  ratingBand: true,
  tags: true,
  color: true,
  servingStyle: true,
  friends: true,
} as const;

const TastingDraftIdSchema = z
  .string()
  .uuid()
  .describe(
    "Draft ID, a UUID chosen by the client. Publishing uses it as the tasting's `idempotencyKey`",
  );

const BottleHintSchema = z
  .string()
  .trim()
  .max(TASTING_DRAFT_BOTTLE_HINT_MAX_LENGTH)
  .nullable()
  .default(null)
  .describe(
    "What the member wrote about the bottle before choosing one. It is not kept on the posted tasting",
  );

export const TastingDraftSchema = TastingSchema.pick(
  TASTING_DETAIL_FIELDS,
).extend({
  id: TastingDraftIdSchema,
  tastedAt: z.string().datetime().describe("When the member had the dram"),
  bottleHint: BottleHintSchema,
  bottle: BottleSchema.nullable().describe(
    "Bottle chosen for the draft. Publishing requires one",
  ),
  imageUrl: z.string().nullable().describe("URL of the draft's photo"),
  createdAt: z.string().datetime().describe("When the draft was first saved"),
  updatedAt: z.string().datetime().describe("When the draft was last saved"),
});

export const TastingDraftInputSchema = TastingContentInputSchema.pick(
  TASTING_DETAIL_FIELDS,
)
  .extend({
    draft: TastingDraftIdSchema,
    tastedAt: TastedAtInputSchema.describe("When the member had the dram"),
    bottleHint: BottleHintSchema,
    bottle: z
      .number()
      .int()
      .positive()
      .nullable()
      .default(null)
      .describe("Bottle chosen for the draft, if the member has picked one"),
    pendingImageId: z
      .string()
      .trim()
      .min(1)
      .nullish()
      .describe(
        "Pending upload with purpose `photo_tasting_entry` to use as the draft's photo. Omit it to keep the current photo, or send `null` to remove it",
      ),
  })
  .strict();

export const TastingDraftIdInputSchema = z.object({
  draft: TastingDraftIdSchema,
});
