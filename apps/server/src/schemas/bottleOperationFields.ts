import { z } from "zod";

export const BottleOperationFieldPathSchema = z.enum([
  "shared.name",
  "shared.statedAge",
  "shared.seriesId",
  "shared.category",
  "shared.brand",
  "shared.distillers",
  "shared.bottler",
  "exact.edition",
  "exact.statedAge",
  "exact.abv",
  "exact.singleCask",
  "exact.caskStrength",
  "exact.vintageYear",
  "exact.bottlingYear",
  "exact.releaseYear",
  "exact.caskSize",
  "exact.caskType",
  "exact.caskFill",
  "name",
  "shortName",
  "roles",
  "website",
  "country",
  "region",
  "yearEstablished",
]);

export type BottleOperationFieldPath = z.infer<
  typeof BottleOperationFieldPathSchema
>;
