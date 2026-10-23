import { ImagePhotoSuitabilitySchema } from "@peated/bottle-classifier/contract";
import { BottleClassificationDecisionSchema } from "@peated/bottle-classifier/internal/types";
import {
  TASTING_DRAFT_BOTTLE_HINT_MAX_LENGTH,
  TASTING_DRAFT_IDENTIFICATION_STATUS_LIST,
} from "@peated/server/db/schema";
import { z } from "zod";
import { BottleSchema } from "./bottles";
import {
  PhotoIdentificationProposedBottleSchema,
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

/**
 * The identification result saved on a draft. It is server-written JSON, so
 * every read checks it. Only results the member can act on are kept: a
 * confirmable match or an auto-creatable Bottle proposal. Everything else is
 * `no_match`. See docs/features/tasting-drafts.md.
 */
export const PersistedTastingDraftIdentificationSchema = z.discriminatedUnion(
  "action",
  [
    z
      .object({
        action: z.literal("match"),
        bottleId: z.number().int().positive(),
      })
      .strict(),
    z
      .object({
        action: z.literal("create_bottle"),
        decision: BottleClassificationDecisionSchema.refine(
          (decision) => decision.action === "create_bottle",
          { message: "Expected a create_bottle decision." },
        ),
        photoSuitability: ImagePhotoSuitabilitySchema,
      })
      .strict(),
    z.object({ action: z.literal("no_match") }).strict(),
  ],
);

export type PersistedTastingDraftIdentification = z.infer<
  typeof PersistedTastingDraftIdentificationSchema
>;

const TastingDraftIdentificationStatusEnum = z
  .enum(TASTING_DRAFT_IDENTIFICATION_STATUS_LIST)
  .describe(
    "`none`: no photo. `pending`: the Bottle is being identified from the photo. `done`: see `result`. `failed`: identification broke and is not tried again; search for the Bottle instead",
  );

const TastingDraftIdentificationSchema = z.object({
  status: TastingDraftIdentificationStatusEnum,
  result: z
    .discriminatedUnion("action", [
      z.object({
        action: z.literal("match"),
        bottle: BottleSchema,
      }),
      z.object({
        action: z.literal("create_bottle"),
        proposedBottle: PhotoIdentificationProposedBottleSchema,
      }),
      z.object({ action: z.literal("no_match") }),
    ])
    .nullable()
    .describe(
      "Set when `status` is `done`. `match` suggests an existing Bottle for the member to confirm. `create_bottle` proposes a new Bottle; confirm it with `POST /tasting-drafts/{draft}/create-bottle`. `no_match` means search for the Bottle",
    ),
});

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
  identification: TastingDraftIdentificationSchema.describe(
    "Bottle identified from the draft's photo. It never sets `bottle`",
  ),
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
