import { toTitleCase } from "@peated/server/lib/strings";
import { CategoryEnum } from "@peated/server/schemas";
import type { PendingImageRouteState } from "@peated/web/lib/addBottle";
import { z } from "zod";

export type CreateBottleReturnAction =
  | "addBottle"
  | "library"
  | "tasting"
  | "view";

export const CreateBottlePrefillSchema = z.object({
  brandId: z.number().int().positive().nullish(),
  brandName: z.string().trim().min(1).nullish(),
  category: CategoryEnum.nullish(),
  distillerId: z.number().int().positive().nullish(),
  distillerName: z.string().trim().min(1).nullish(),
  statedAge: z.number().int().min(0).max(100).nullish(),
  abv: z.number().min(0).max(100).nullish(),
  edition: z.string().trim().min(1).nullish(),
  vintageYear: z.number().int().gte(1800).nullish(),
  releaseYear: z.number().int().gte(1800).nullish(),
});

export type CreateBottlePrefill = z.infer<typeof CreateBottlePrefillSchema>;

function parseNumberParam(
  value: string | null,
  {
    integer = false,
    min,
    max,
  }: { integer?: boolean; min: number; max: number },
) {
  const parsed = Number(value);
  if (!value?.trim() || !Number.isFinite(parsed)) return null;
  if (integer && !Number.isInteger(parsed)) return null;
  return parsed >= min && parsed <= max ? parsed : null;
}

export function parseCreateBottlePrefill(
  searchParams: Pick<URLSearchParams, "get">,
): CreateBottlePrefill {
  const currentYear = new Date().getFullYear();
  const category = CategoryEnum.safeParse(searchParams.get("category"));

  return CreateBottlePrefillSchema.parse({
    brandId: parseNumberParam(searchParams.get("brand"), {
      integer: true,
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
    }),
    brandName: searchParams.get("brandName")?.trim() || null,
    category: category.success ? category.data : null,
    distillerId: parseNumberParam(searchParams.get("distiller"), {
      integer: true,
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
    }),
    distillerName: searchParams.get("distillerName")?.trim() || null,
    statedAge: parseNumberParam(searchParams.get("statedAge"), {
      integer: true,
      min: 0,
      max: 100,
    }),
    abv: parseNumberParam(searchParams.get("abv"), {
      min: 0,
      max: 100,
    }),
    edition: searchParams.get("edition")?.trim() || null,
    vintageYear: parseNumberParam(searchParams.get("vintageYear"), {
      integer: true,
      min: 1800,
      max: currentYear,
    }),
    releaseYear: parseNumberParam(searchParams.get("releaseYear"), {
      integer: true,
      min: 1800,
      max: currentYear,
    }),
  });
}

/**
 * Builds the Create Bottle URL and owns the scan-prefill query string format.
 * Nullish prefill fields are omitted so manual creation stays editable.
 */
export function getCreateBottleHref({
  query,
  returnAction,
  prefill,
  pendingImage,
}: {
  query: string;
  returnAction?: CreateBottleReturnAction;
  prefill?: CreateBottlePrefill;
  pendingImage?: PendingImageRouteState | null;
}) {
  const parsedPrefill = prefill ?? {};
  const params = new URLSearchParams({
    name: toTitleCase(query),
  });
  if (returnAction) {
    params.set("returnAction", returnAction);
  }

  if (parsedPrefill.brandId) {
    params.set("brand", String(parsedPrefill.brandId));
  } else if (parsedPrefill.brandName) {
    params.set("brandName", parsedPrefill.brandName);
  }
  if (parsedPrefill.category) params.set("category", parsedPrefill.category);
  if (parsedPrefill.distillerId) {
    params.set("distiller", String(parsedPrefill.distillerId));
  } else if (parsedPrefill.distillerName) {
    params.set("distillerName", parsedPrefill.distillerName);
  }
  if (
    parsedPrefill.statedAge !== null &&
    parsedPrefill.statedAge !== undefined
  ) {
    params.set("statedAge", String(parsedPrefill.statedAge));
  }
  if (parsedPrefill.abv !== null && parsedPrefill.abv !== undefined) {
    params.set("abv", String(parsedPrefill.abv));
  }
  if (parsedPrefill.edition) params.set("edition", parsedPrefill.edition);
  if (
    parsedPrefill.vintageYear !== null &&
    parsedPrefill.vintageYear !== undefined
  ) {
    params.set("vintageYear", String(parsedPrefill.vintageYear));
  }
  if (
    parsedPrefill.releaseYear !== null &&
    parsedPrefill.releaseYear !== undefined
  ) {
    params.set("releaseYear", String(parsedPrefill.releaseYear));
  }
  if (pendingImage?.id) params.set("pendingImageId", pendingImage.id);
  if (pendingImage?.imageUrl) {
    params.set("pendingImageUrl", pendingImage.imageUrl);
  }
  return `/bottles/new?${params.toString()}`;
}
