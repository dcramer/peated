import { identifyTastingDraft } from "@peated/server/lib/tastingDraftIdentification";
import type { JobPayload } from "@peated/server/worker/types";
import { z } from "zod";

export const IdentifyTastingDraftJobArgsSchema = z
  .object({ draftId: z.string().uuid() })
  .strict();

/** Identifies the Bottle in a tasting draft's photo. */
export default async (input: JobPayload) => {
  const { draftId } = IdentifyTastingDraftJobArgsSchema.parse(input);
  await identifyTastingDraft(draftId);
};
