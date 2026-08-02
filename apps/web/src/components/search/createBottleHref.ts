import { toTitleCase } from "@peated/server/lib/strings";
import {
  CaskFillEnum,
  CaskSizeEnum,
  CaskTypeEnum,
  CategoryEnum,
} from "@peated/server/schemas";
import type { PendingImageRouteState } from "@peated/web/lib/addBottle";
import { z } from "zod";

export type CreateBottleReturnAction =
  | "addBottle"
  | "library"
  | "tasting"
  | "view";

const CreateBottleEntityChoiceSchema = z.object({
  id: z.number().int().positive().nullable(),
  name: z.string().trim().min(1),
});

export const CreateBottlePrefillSchema = z.object({
  brandId: z.number().int().positive().nullish(),
  brandName: z.string().trim().min(1).nullish(),
  category: CategoryEnum.nullish(),
  distillerId: z.number().int().positive().nullish(),
  distillerName: z.string().trim().min(1).nullish(),
  distillers: z.array(CreateBottleEntityChoiceSchema).optional(),
  bottlerId: z.number().int().positive().nullish(),
  bottlerName: z.string().trim().min(1).nullish(),
  seriesId: z.number().int().positive().nullish(),
  seriesName: z.string().trim().min(1).nullish(),
  statedAge: z.number().int().min(0).max(100).nullish(),
  abv: z.number().min(0).max(100).nullish(),
  edition: z.string().trim().min(1).nullish(),
  vintageYear: z.number().int().gte(1800).nullish(),
  releaseYear: z.number().int().gte(1800).nullish(),
  caskStrength: z.boolean().nullish(),
  singleCask: z.boolean().nullish(),
  caskType: CaskTypeEnum.nullish(),
  caskSize: CaskSizeEnum.nullish(),
  caskFill: CaskFillEnum.nullish(),
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

function parseBooleanParam(value: string | null) {
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
}

function parseEntityChoices(searchParams: Pick<URLSearchParams, "getAll">) {
  const ids = searchParams.getAll("distiller");
  const names = searchParams.getAll("distillerName");

  return names.flatMap((name, index) => {
    const trimmedName = name.trim();
    if (!trimmedName) return [];
    return [
      {
        id: parseNumberParam(ids[index] ?? null, {
          integer: true,
          min: 1,
          max: Number.MAX_SAFE_INTEGER,
        }),
        name: trimmedName,
      },
    ];
  });
}

export function parseCreateBottlePrefill(
  searchParams: Pick<URLSearchParams, "get" | "getAll">,
): CreateBottlePrefill {
  const currentYear = new Date().getFullYear();
  const category = CategoryEnum.safeParse(searchParams.get("category"));
  const caskType = CaskTypeEnum.safeParse(searchParams.get("caskType"));
  const caskSize = CaskSizeEnum.safeParse(searchParams.get("caskSize"));
  const caskFill = CaskFillEnum.safeParse(searchParams.get("caskFill"));

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
    distillers: parseEntityChoices(searchParams),
    bottlerId: parseNumberParam(searchParams.get("bottler"), {
      integer: true,
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
    }),
    bottlerName: searchParams.get("bottlerName")?.trim() || null,
    seriesId: parseNumberParam(searchParams.get("series"), {
      integer: true,
      min: 1,
      max: Number.MAX_SAFE_INTEGER,
    }),
    seriesName: searchParams.get("seriesName")?.trim() || null,
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
    caskStrength: parseBooleanParam(searchParams.get("caskStrength")),
    singleCask: parseBooleanParam(searchParams.get("singleCask")),
    caskType: caskType.success ? caskType.data : null,
    caskSize: caskSize.success ? caskSize.data : null,
    caskFill: caskFill.success ? caskFill.data : null,
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
  }
  if (parsedPrefill.brandName) {
    params.set("brandName", parsedPrefill.brandName);
  }
  if (parsedPrefill.category) params.set("category", parsedPrefill.category);
  const distillers = parsedPrefill.distillers ?? [];
  if (distillers.length === 0) {
    if (parsedPrefill.distillerId) {
      params.set("distiller", String(parsedPrefill.distillerId));
    }
    if (parsedPrefill.distillerName) {
      params.set("distillerName", parsedPrefill.distillerName);
    }
  }
  for (const distiller of distillers) {
    params.append("distiller", distiller.id ? String(distiller.id) : "");
    params.append("distillerName", distiller.name);
  }
  if (parsedPrefill.bottlerId) {
    params.set("bottler", String(parsedPrefill.bottlerId));
  }
  if (parsedPrefill.bottlerName) {
    params.set("bottlerName", parsedPrefill.bottlerName);
  }
  if (parsedPrefill.seriesId) {
    params.set("series", String(parsedPrefill.seriesId));
  }
  if (parsedPrefill.seriesName) {
    params.set("seriesName", parsedPrefill.seriesName);
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
  if (parsedPrefill.caskStrength != null) {
    params.set("caskStrength", String(parsedPrefill.caskStrength));
  }
  if (parsedPrefill.singleCask != null) {
    params.set("singleCask", String(parsedPrefill.singleCask));
  }
  if (parsedPrefill.caskType) params.set("caskType", parsedPrefill.caskType);
  if (parsedPrefill.caskSize) params.set("caskSize", parsedPrefill.caskSize);
  if (parsedPrefill.caskFill) params.set("caskFill", parsedPrefill.caskFill);
  if (pendingImage?.id) params.set("pendingImageId", pendingImage.id);
  if (pendingImage?.imageUrl) {
    params.set("pendingImageUrl", pendingImage.imageUrl);
  }
  return `/bottles/new?${params.toString()}`;
}
