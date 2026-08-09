/**
 * Runtime contracts for Bottle creation and moderator patching. Patch
 * schemas preserve omitted fields so service code can distinguish them from null.
 */
import { BottleInputSchema } from "@peated/server/schemas";
import { z } from "zod";

const StableBottleGroupFieldsSchema = BottleInputSchema.pick({
  name: true,
  statedAge: true,
  series: true,
  category: true,
  brand: true,
  distillers: true,
  bottler: true,
  flavorProfile: true,
})
  .extend({
    statedAge: z.number().int().min(0).max(100).nullable().default(null),
  })
  .strict();

function validateStableChoiceIds(
  input: Partial<z.infer<typeof StableBottleGroupFieldsSchema>>,
  ctx: z.RefinementCtx,
) {
  const validateChoiceId = (
    choice: number | { id?: number | null } | null | undefined,
    path: (string | number)[],
  ) => {
    const id = typeof choice === "number" ? choice : choice?.id;
    if (id !== null && id !== undefined && (!Number.isInteger(id) || id <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ID must be a positive integer.",
        path: [...path, ...(typeof choice === "number" ? [] : ["id"])],
      });
    }
  };

  validateChoiceId(input.brand, ["brand"]);
  validateChoiceId(input.bottler, ["bottler"]);
  validateChoiceId(input.series, ["series"]);
  input.distillers?.forEach((distiller, index) =>
    validateChoiceId(distiller, ["distillers", index]),
  );
}

const StableBottleGroupInputSchema = StableBottleGroupFieldsSchema.superRefine(
  validateStableChoiceIds,
);

const ExactBottleInputSchema = BottleInputSchema.pick({
  edition: true,
  statedAge: true,
  abv: true,
  singleCask: true,
  caskStrength: true,
  vintageYear: true,
  releaseYear: true,
  caskSize: true,
  caskType: true,
  caskFill: true,
  description: true,
  descriptionSrc: true,
  tastingNotes: true,
})
  .extend({
    statedAge: z.number().int().min(0).max(100).nullable().default(null),
    vintageYear: z
      .number()
      .int()
      .gte(1800)
      .lte(new Date().getFullYear())
      .nullable()
      .default(null),
    releaseYear: z
      .number()
      .int()
      .gte(1800)
      .lte(new Date().getFullYear())
      .nullable()
      .default(null),
  })
  .strict();

const IndependentBottleCreateRouteFieldsSchema =
  StableBottleGroupFieldsSchema.extend({
    edition: ExactBottleInputSchema.shape.edition,
    abv: ExactBottleInputSchema.shape.abv,
    singleCask: ExactBottleInputSchema.shape.singleCask,
    caskStrength: ExactBottleInputSchema.shape.caskStrength,
    vintageYear: ExactBottleInputSchema.shape.vintageYear,
    releaseYear: ExactBottleInputSchema.shape.releaseYear,
    caskSize: ExactBottleInputSchema.shape.caskSize,
    caskType: ExactBottleInputSchema.shape.caskType,
    caskFill: ExactBottleInputSchema.shape.caskFill,
    description: ExactBottleInputSchema.shape.description,
    descriptionSrc: ExactBottleInputSchema.shape.descriptionSrc,
    tastingNotes: ExactBottleInputSchema.shape.tastingNotes,
  }).strict();

/**
 * Public independent creation reuses stable/exact validation without exposing
 * group authority or image-upload fields; uploads use a separate route.
 */
export const IndependentBottleCreateRouteInputSchema =
  IndependentBottleCreateRouteFieldsSchema.superRefine(validateStableChoiceIds);

const BottleSharedPatchSchema = z
  .object({
    name: StableBottleGroupFieldsSchema.shape.name.optional(),
    statedAge: z.number().int().min(0).max(100).nullable().optional(),
    series: StableBottleGroupFieldsSchema.shape.series
      .unwrap()
      .removeDefault()
      .optional(),
    category: StableBottleGroupFieldsSchema.shape.category
      .removeDefault()
      .optional(),
    brand: StableBottleGroupFieldsSchema.shape.brand.optional(),
    distillers: StableBottleGroupFieldsSchema.shape.distillers
      .unwrap()
      .removeDefault()
      .optional(),
    bottler: StableBottleGroupFieldsSchema.shape.bottler
      .unwrap()
      .removeDefault()
      .optional(),
    flavorProfile: StableBottleGroupFieldsSchema.shape.flavorProfile
      .removeDefault()
      .optional(),
  })
  .strict()
  .superRefine(validateStableChoiceIds);

const BottleExactPatchSchema = z
  .object({
    edition: ExactBottleInputSchema.shape.edition.removeDefault().optional(),
    statedAge: z.number().int().min(0).max(100).nullable().optional(),
    abv: ExactBottleInputSchema.shape.abv.unwrap().removeDefault().optional(),
    singleCask: ExactBottleInputSchema.shape.singleCask
      .removeDefault()
      .optional(),
    caskStrength: ExactBottleInputSchema.shape.caskStrength
      .removeDefault()
      .optional(),
    vintageYear: z
      .number()
      .int()
      .gte(1800)
      .lte(new Date().getFullYear())
      .nullable()
      .optional(),
    releaseYear: z
      .number()
      .int()
      .gte(1800)
      .lte(new Date().getFullYear())
      .nullable()
      .optional(),
    caskSize: ExactBottleInputSchema.shape.caskSize.removeDefault().optional(),
    caskType: ExactBottleInputSchema.shape.caskType.removeDefault().optional(),
    caskFill: ExactBottleInputSchema.shape.caskFill.removeDefault().optional(),
    description: ExactBottleInputSchema.shape.description
      .removeDefault()
      .optional(),
    descriptionSrc: ExactBottleInputSchema.shape.descriptionSrc
      .unwrap()
      .removeDefault()
      .optional(),
    image: BottleInputSchema.shape.image.optional(),
    tastingNotes: BottleInputSchema.shape.tastingNotes.optional(),
    suggestedTags: z.array(z.string().max(64)).max(5).optional(),
  })
  .strict();

const ModeratorBottleExactPatchSchema = BottleExactPatchSchema.omit({
  suggestedTags: true,
});

export const BottleUpdateInputSchema = z
  .object({
    shared: BottleSharedPatchSchema.optional(),
    exact: ModeratorBottleExactPatchSchema.optional(),
  })
  .strict();

export type BottleUpdateInput = z.infer<typeof BottleUpdateInputSchema>;

/**
 * Internal update contract for system-owned exact content such as generated
 * tags. Public moderator input remains limited to user-editable fields.
 */
export const SystemBottleUpdateInputSchema = z
  .object({
    shared: BottleSharedPatchSchema.optional(),
    exact: BottleExactPatchSchema.optional(),
  })
  .strict();

export type SystemBottleUpdateInput = z.infer<
  typeof SystemBottleUpdateInputSchema
>;

/** Runtime contract for independently complete singleton Bottle creation. */
export const BottleCreateInputSchema = z
  .object({
    stable: StableBottleGroupInputSchema,
    exact: ExactBottleInputSchema,
  })
  .strict();

export type BottleCreateInput = z.infer<typeof BottleCreateInputSchema>;
