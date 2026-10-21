import { isORPCClientError } from "@peated/orpc/client/errors";
import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import type { Inputs, Outputs } from "@peated/server/orpc/router";
import type { Bottle } from "@peated/server/types";
import { z } from "zod";

export type TastingDraft = Outputs["tastingDrafts"]["details"];
type TastingDraftSaveInput = Inputs["tastingDrafts"]["upsert"];
type ClientErrorCandidate = Parameters<typeof isORPCClientError>[0];

/**
 * What the draft's photo says about its Bottle. Identification only suggests;
 * the member always confirms. See docs/features/tasting-drafts.md.
 */
type TastingDraftSuggestion =
  | { kind: "identifying" }
  | { kind: "match"; bottle: Bottle }
  | { kind: "proposal"; name: string }
  | { kind: "unknown" }
  | { kind: "none" };

export function getTastingDraftHref(draft: { id: string }) {
  return `/drafts/${draft.id}`;
}

/**
 * Opens a draft's confirm step for a Bottle. The member still presses
 * **Use this bottle**; this never saves the Bottle on the draft.
 */
export function getTastingDraftBottleHref(
  draft: { id: string },
  bottleId: number,
) {
  return `${getTastingDraftHref(draft)}?bottle=${bottleId}`;
}

/** Reads a draft ID from a URL. Draft IDs are UUIDs. */
export function parseTastingDraftId(value: string | null) {
  const parsed = z.string().uuid().safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function getTastingDraftSuggestion(
  draft: Pick<TastingDraft, "identification">,
): TastingDraftSuggestion {
  const { status, result } = draft.identification;
  if (status === "none") return { kind: "none" };
  if (status === "pending") return { kind: "identifying" };
  if (status === "done" && result?.action === "match") {
    return { kind: "match", bottle: result.bottle };
  }
  if (status === "done" && result?.action === "create_bottle") {
    return {
      kind: "proposal",
      name: formatBottleDisplayName(result.proposedBottle),
    };
  }
  // `failed` is final, and `no_match` asks for a search.
  return { kind: "unknown" };
}

type TastingDraftDescription = {
  name: string | null;
  status: string;
};

/**
 * The name and status line an inbox row shows for a draft. `name` is null
 * when the draft has neither a Bottle nor a hint; the row then shows the date.
 */
export function describeTastingDraft(
  draft: Pick<TastingDraft, "bottle" | "bottleHint" | "identification">,
): TastingDraftDescription {
  if (draft.bottle) {
    return {
      name: formatBottleDisplayName(draft.bottle),
      status: "Bottle chosen",
    };
  }

  const name = draft.bottleHint || null;
  const suggestion = getTastingDraftSuggestion(draft);
  switch (suggestion.kind) {
    case "identifying":
      return { name, status: "Identifying the bottle" };
    case "match":
      return {
        name,
        status: `Looks like ${formatBottleDisplayName(suggestion.bottle)}`,
      };
    case "proposal":
      return { name, status: `New to Peated: ${suggestion.name}` };
    case "unknown":
      return { name, status: "Couldn't tell from the photo" };
    case "none":
      return { name, status: "Needs a bottle" };
  }
}

/**
 * Builds a full save from the draft. A save replaces every field, so changes
 * apply on top of what the draft already has. Leaving out `pendingImageId`
 * keeps the current photo.
 */
export function buildTastingDraftSaveInput(
  draft: TastingDraft,
  changes: Partial<Omit<TastingDraftSaveInput, "draft">> = {},
): TastingDraftSaveInput {
  return {
    draft: draft.id,
    tastedAt: draft.tastedAt,
    bottleHint: draft.bottleHint,
    bottle: draft.bottle?.id ?? null,
    notes: draft.notes,
    ratingBand: draft.ratingBand,
    tags: draft.tags,
    servingStyle: draft.servingStyle,
    color: draft.color,
    friends: draft.friends.map((friend) => friend.id),
    ...changes,
  };
}

/**
 * Decides what a save does with the draft's photo. A photo already sent with
 * an earlier save is kept rather than uploaded again.
 */
export function getTastingDraftPhotoChange<TImage>(
  image: TImage | null | undefined,
  lastSavedImage: TImage | null | undefined,
): "keep" | "remove" | "replace" {
  if (image === undefined || image === lastSavedImage) return "keep";
  return image === null ? "remove" : "replace";
}

/**
 * Saves the draft's details, then posts it. Posting is safe to repeat: if an
 * earlier post went through but its response was lost, the save reports the
 * draft as posted and publishing again returns that tasting.
 */
export async function postTastingDraft<TResult>({
  publish,
  save,
}: {
  publish: () => Promise<TResult>;
  save: () => Promise<void>;
}): Promise<TResult> {
  try {
    await save();
  } catch (error) {
    // A save of a posted draft returns CONFLICT with the tasting's ID.
    if (getConflictId(error, "tasting") === null) throw error;
  }
  return await publish();
}

/**
 * Returns the existing Bottle's ID when creating a proposed Bottle fails
 * because Peated already has it.
 */
export function getExistingBottleConflictId(
  error: ClientErrorCandidate,
): number | null {
  return getConflictId(error, "bottle");
}

const ConflictDataSchema = z.object({
  bottle: z.number().int().optional(),
  tasting: z.number().int().optional(),
});

function getConflictId(
  error: ClientErrorCandidate,
  field: "bottle" | "tasting",
) {
  if (!isORPCClientError(error) || error.code !== "CONFLICT") return null;
  const data = ConflictDataSchema.safeParse(error.data);
  return data.success ? (data.data[field] ?? null) : null;
}
