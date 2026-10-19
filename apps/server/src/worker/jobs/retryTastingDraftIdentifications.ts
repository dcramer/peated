import { logInfo } from "@peated/server/lib/log";
import { retryStaleTastingDraftIdentifications } from "@peated/server/lib/tastingDraftIdentification";

/** Queues tasting drafts whose identification was lost, or marks them failed. */
export default async function retryTastingDraftIdentificationsJob() {
  const { queued, failed } = await retryStaleTastingDraftIdentifications();
  if (queued || failed) {
    logInfo("Retried {queued} tasting draft identifications, {failed} failed", {
      extra: { queued, failed },
    });
  }
}
