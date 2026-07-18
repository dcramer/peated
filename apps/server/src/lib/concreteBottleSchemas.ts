/**
 * Runtime contracts for concrete Bottle creation and moderator patching. Patch
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

const IndependentConcreteBottleCreateRouteFieldsSchema =
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
export const IndependentConcreteBottleCreateRouteInputSchema =
  IndependentConcreteBottleCreateRouteFieldsSchema.superRefine(
    validateStableChoiceIds,
  );

const ConcreteBottleSharedPatchSchema = z
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

const ConcreteBottleExactPatchSchema = z
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
  })
  .strict();

export const ConcreteBottleUpdateInputSchema = z
  .object({
    shared: ConcreteBottleSharedPatchSchema.optional(),
    exact: ConcreteBottleExactPatchSchema.optional(),
  })
  .strict();

export type ConcreteBottleUpdateInput = z.infer<
  typeof ConcreteBottleUpdateInputSchema
>;

/**
 * Runtime contract consumed by concrete Bottle creation adapters. Ordinary
 * callers use `independent`; source authority is reserved for migration,
 * measured compatibility, and system-controlled grouping.
 */
export const ConcreteBottleCreateInputSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("independent"),
      stable: StableBottleGroupInputSchema,
      exact: ExactBottleInputSchema,
    })
    .strict(),
  z
    .object({
      kind: z.literal("source_bottle"),
      sourceBottleId: z.number().int().positive(),
      exact: ExactBottleInputSchema,
    })
    .strict(),
]);

export type ConcreteBottleCreateInput = z.infer<
  typeof ConcreteBottleCreateInputSchema
>;
