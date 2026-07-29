import { TastingContentInputSchema } from "@peated/server/schemas";
import type { SuggestedTag, Tag } from "@peated/server/types";
import type { z } from "zod";

export const TastingFormFieldsSchema = TastingContentInputSchema.pick({
  rating: true,
  notes: true,
  tags: true,
  color: true,
  servingStyle: true,
  friends: true,
}).strict();

export type TastingFormFields = z.infer<typeof TastingFormFieldsSchema>;
export type TastingFormImage = HTMLCanvasElement | File | null | undefined;
export type TastingEditFormSubmitData = TastingFormFields & {
  image: TastingFormImage;
};
export type TastingCreateFormSubmitData = TastingEditFormSubmitData & {
  bottle: number;
};

export function buildTastingCreateFormSubmission({
  fields,
  image,
  bottleId,
}: {
  fields: TastingFormFields;
  image: TastingFormImage;
  bottleId: number;
}): TastingCreateFormSubmitData {
  return {
    ...fields,
    bottle: bottleId,
    image,
  };
}

export function buildTastingEditFormSubmission({
  fields,
  image,
}: {
  fields: TastingFormFields;
  image: TastingFormImage;
}): TastingEditFormSubmitData {
  return { ...fields, image };
}

export type TastingTagSuggestion = SuggestedTag | string;

export type TastingTagOptionData = {
  id: string;
  count: number;
  tag?: Tag;
};

/** Deduplicates suggestions while keeping every currently saved tag editable. */
export function buildTastingTagOptions(
  suggestions: TastingTagSuggestion[],
  currentTagNames: string[],
): TastingTagOptionData[] {
  const options = new Map<string, TastingTagOptionData>();

  for (const suggestion of suggestions) {
    const tag = typeof suggestion === "string" ? undefined : suggestion.tag;
    const id =
      typeof suggestion === "string" ? suggestion : suggestion.tag.name;
    const existing = options.get(id);
    options.set(id, {
      id,
      count:
        typeof suggestion === "string"
          ? (existing?.count ?? 0)
          : suggestion.count,
      tag: tag ?? existing?.tag,
    });
  }

  for (const id of currentTagNames) {
    if (!options.has(id)) {
      options.set(id, { id, count: 0 });
    }
  }

  return [...options.values()];
}
