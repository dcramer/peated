import { processDueAccountDeletions } from "@peated/server/lib/accountDeletion";
import { logInfo } from "@peated/server/lib/log";

/** Runs account deletions whose 24-hour grace period has ended. */
export default async function processAccountDeletionsJob() {
  const deleted = await processDueAccountDeletions();
  if (deleted) {
    logInfo("Deleted {count} accounts", { extra: { count: deleted } });
  }
}
