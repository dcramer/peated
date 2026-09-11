import { BottleExtractedDetailsSchema } from "@peated/bottle-classifier/contract";
import { BottleCreateInputSchema } from "@peated/server/lib/bottleSchemas";
import type { BottleInputSchema } from "@peated/server/schemas";
import { z } from "zod";

type FlatBottleInput = z.input<typeof BottleInputSchema>;
const NamedChoiceSchema = z.object({ name: z.string() });

/**
 * Translates the retained flat Bottle input into the strict Bottle create
 * route contract without carrying legacy response or image fields forward.
 */
export function buildBottleCreateInput(input: FlatBottleInput) {
  return BottleCreateInputSchema.parse({
    name: input.name,
    statedAge: input.statedAge,
    series: input.series,
    category: input.category,
    brand: input.brand,
    distillers: input.distillers,
    bottler: input.bottler,
    flavorProfile: input.flavorProfile,
    edition: input.edition,
    abv: input.abv,
    singleCask: input.singleCask,
    caskStrength: input.caskStrength,
    vintageYear: input.vintageYear,
    bottlingYear: input.bottlingYear,
    releaseYear: input.releaseYear,
    releaseMonth: input.releaseMonth,
    releaseDay: input.releaseDay,
    maturation: input.maturation,
    caskNumber: input.caskNumber,
    outturn: input.outturn,
    description: input.description,
    descriptionSrc: input.descriptionSrc,
    tastingNotes: input.tastingNotes,
  });
}

function getChoiceName(
  choice: number | { name: string } | null | undefined,
): string | null {
  return NamedChoiceSchema.safeParse(choice).data?.name ?? null;
}

/** Keeps trusted scraper Bottle facts with the listing that supplied them. */
export function buildBottleSourceIdentity(input: FlatBottleInput) {
  return BottleExtractedDetailsSchema.parse({
    brand: getChoiceName(input.brand),
    bottler: getChoiceName(input.bottler),
    expression: input.name,
    series: getChoiceName(input.series),
    distillery: (input.distillers ?? [])
      .map(getChoiceName)
      .filter((name): name is string => name !== null),
    category: input.category,
    stated_age: input.statedAge,
    abv: input.abv,
    release_year: input.releaseYear,
    release_month: input.releaseMonth,
    release_day: input.releaseDay,
    vintage_year: input.vintageYear,
    cask_strength: input.caskStrength,
    single_cask: input.singleCask,
    maturation: input.maturation,
    cask_number: input.caskNumber,
    outturn: input.outturn,
    edition: input.edition,
  });
}
