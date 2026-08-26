/**
 * Runtime contracts for Bottle creation and moderator patching. Patch
 * schemas preserve omitted fields so service code can distinguish them from null.
 */
import { BottleInputFields } from "@peated/server/schemas";
import { z } from "zod";

export const MAX_BOTTLE_SUGGESTED_TAGS = 5;

const BottleGroupFields = {
  name: BottleInputFields.name,
  statedAge: z.number().int().min(0).max(100).nullable().default(null),
  series: BottleInputFields.series,
  category: BottleInputFields.category,
  brand: BottleInputFields.brand,
  distillers: BottleInputFields.distillers,
  bottler: BottleInputFields.bottler,
  flavorProfile: BottleInputFields.flavorProfile,
} as const;

const BottleGroupFieldsSchema = z.object(BottleGroupFields).strict();

function validateGroupChoiceIds(
  input: Partial<z.infer<typeof BottleGroupFieldsSchema>>,
  ctx: z.RefinementCtx,
) {
  const validateChoiceId = (
    choice: number | { id?: number | null } | null | undefined,
    path: (string | number)[],
  ) => {
    const numericChoice = z.number().safeParse(choice);
    const objectChoice = numericChoice.success
      ? null
      : z
          .object({ id: z.number().nullish() })
          .nullable()
          .optional()
          .parse(choice);
    const id = numericChoice.success ? numericChoice.data : objectChoice?.id;
    if (id !== null && id !== undefined && (!Number.isInteger(id) || id <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ID must be a positive integer.",
        path: [...path, ...(numericChoice.success ? [] : ["id"])],
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

const ExactBottleInputFields = {
  edition: BottleInputFields.edition,
  statedAge: BottleGroupFields.statedAge,
  noAgeStatement: BottleInputFields.noAgeStatement,
  abv: BottleInputFields.abv,
  singleCask: BottleInputFields.singleCask,
  caskStrength: BottleInputFields.caskStrength,
  naturalColor: BottleInputFields.naturalColor,
  nonChillFiltered: BottleInputFields.nonChillFiltered,
  maltPhenolPpm: BottleInputFields.maltPhenolPpm,
  vintageYear: z
    .number()
    .int()
    .gte(1800)
    .lte(new Date().getFullYear())
    .nullable()
    .default(null),
  bottlingYear: z
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
  caskSize: BottleInputFields.caskSize,
  caskType: BottleInputFields.caskType,
  caskFill: BottleInputFields.caskFill,
  description: BottleInputFields.description,
  descriptionSrc: BottleInputFields.descriptionSrc,
  tastingNotes: BottleInputFields.tastingNotes,
} as const;

const BottleCreateFieldsSchema = z
  .object({
    ...BottleGroupFields,
    ...ExactBottleInputFields,
  })
  .strict();

function validateBottleInput(
  input: Partial<z.infer<typeof BottleCreateFieldsSchema>>,
  ctx: z.RefinementCtx,
) {
  validateGroupChoiceIds(input, ctx);
  if (
    input.statedAge !== null &&
    input.statedAge !== undefined &&
    input.noAgeStatement === true
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Choose an age or No age statement, not both.",
      path: ["noAgeStatement"],
    });
  }
}

/**
 * Flat Bottle creation is the only creation contract. The service owns which
 * fields are stored as BottleGroup authority and which fields stay exact.
 */
export const BottleCreateInputSchema =
  BottleCreateFieldsSchema.superRefine(validateBottleInput);

export type BottleCreateInput = z.infer<typeof BottleCreateInputSchema>;

const BottlePatchFieldsSchema = z
  .object({
    name: BottleGroupFields.name.optional(),
    series: BottleGroupFields.series.unwrap().removeDefault().optional(),
    category: BottleGroupFields.category.removeDefault().optional(),
    brand: BottleGroupFields.brand.optional(),
    distillers: BottleGroupFields.distillers
      .unwrap()
      .removeDefault()
      .optional(),
    bottler: BottleGroupFields.bottler.unwrap().removeDefault().optional(),
    flavorProfile: BottleGroupFields.flavorProfile.removeDefault().optional(),
    edition: ExactBottleInputFields.edition.removeDefault().optional(),
    statedAge: z.number().int().min(0).max(100).nullable().optional(),
    noAgeStatement: ExactBottleInputFields.noAgeStatement
      .removeDefault()
      .optional(),
    abv: ExactBottleInputFields.abv.unwrap().removeDefault().optional(),
    singleCask: ExactBottleInputFields.singleCask.removeDefault().optional(),
    caskStrength: ExactBottleInputFields.caskStrength
      .removeDefault()
      .optional(),
    naturalColor: ExactBottleInputFields.naturalColor
      .removeDefault()
      .optional(),
    nonChillFiltered: ExactBottleInputFields.nonChillFiltered
      .removeDefault()
      .optional(),
    maltPhenolPpm: ExactBottleInputFields.maltPhenolPpm
      .removeDefault()
      .optional(),
    vintageYear: z
      .number()
      .int()
      .gte(1800)
      .lte(new Date().getFullYear())
      .nullable()
      .optional(),
    bottlingYear: z
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
    caskSize: ExactBottleInputFields.caskSize.removeDefault().optional(),
    caskType: ExactBottleInputFields.caskType.removeDefault().optional(),
    caskFill: ExactBottleInputFields.caskFill.removeDefault().optional(),
    description: ExactBottleInputFields.description.removeDefault().optional(),
    descriptionSrc: ExactBottleInputFields.descriptionSrc
      .unwrap()
      .removeDefault()
      .optional(),
    image: BottleInputFields.image.optional(),
    tastingNotes: BottleInputFields.tastingNotes.optional(),
    suggestedTags: z
      .array(z.string().max(64))
      .max(MAX_BOTTLE_SUGGESTED_TAGS)
      .optional(),
  })
  .strict();

/**
 * Flat Bottle edits are the only public patch contract. The Bottle service
 * owns field storage and shared BottleGroup fan-out.
 */
export const BottlePatchSchema = BottlePatchFieldsSchema.omit({
  suggestedTags: true,
}).superRefine(validateBottleInput);

export type BottlePatch = z.infer<typeof BottlePatchSchema>;

/**
 * Internal update contract for system-owned exact content such as generated
 * tags. Public moderator input remains limited to user-editable fields.
 */
export const SystemBottlePatchSchema =
  BottlePatchFieldsSchema.superRefine(validateBottleInput);

export type SystemBottlePatch = z.infer<typeof SystemBottlePatchSchema>;
