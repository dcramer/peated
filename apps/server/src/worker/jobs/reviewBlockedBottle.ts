import {
  BlockedBottleAuditInputSchema,
  runBlockedBottleAudit,
} from "@peated/server/agents/bottleClassifier/auditBottle";
import type { JobPayload } from "../types";

export type ReviewBlockedBottleServices = {
  runAudit: NonNullable<Parameters<typeof runBlockedBottleAudit>[1]>;
};

/** Starts one Bottle Review for a Bottle that a reference run blocked. */
export async function reviewBlockedBottle(
  input: JobPayload,
  services?: ReviewBlockedBottleServices,
) {
  await runBlockedBottleAudit(
    BlockedBottleAuditInputSchema.parse(input),
    services?.runAudit,
  );
}

export default async function reviewBlockedBottleJob(input: JobPayload) {
  return await reviewBlockedBottle(input);
}
