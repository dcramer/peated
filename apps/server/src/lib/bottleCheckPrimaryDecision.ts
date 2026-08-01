import type { AnyDatabase } from "@peated/server/db";
import {
  storePriceMatchAttempts,
  type BottleCheck,
} from "@peated/server/db/schema";
import { eq } from "drizzle-orm";

type PrimaryDecisionCheck = Pick<
  BottleCheck,
  | "intent"
  | "sourceKind"
  | "sourceId"
  | "storePriceMatchAttemptId"
  | "storePriceMatchProposalId"
>;

const TERMINAL_STORE_PRICE_ATTEMPT_STATUSES = new Set(["approved", "ignored"]);

function requiresStorePricePrimaryDecision(check: PrimaryDecisionCheck) {
  return (
    check.intent === "resolve_reference" && check.sourceKind === "store_price"
  );
}

/** Locks the exact primary attempt before callers lock its Bottle check. */
export async function lockBottleCheckPrimaryDecisionAttempt(
  check: PrimaryDecisionCheck,
  database: AnyDatabase,
): Promise<void> {
  if (
    !requiresStorePricePrimaryDecision(check) ||
    check.storePriceMatchAttemptId === null
  ) {
    return;
  }

  await database
    .select({ id: storePriceMatchAttempts.id })
    .from(storePriceMatchAttempts)
    .where(eq(storePriceMatchAttempts.id, check.storePriceMatchAttemptId))
    .limit(1)
    .for("update");
}

/** Treats only the exact linked attempt's approved or ignored result as terminal. */
export async function isBottleCheckPrimaryDecisionTerminal(
  check: PrimaryDecisionCheck,
  database: AnyDatabase,
): Promise<boolean> {
  if (!requiresStorePricePrimaryDecision(check)) return true;
  if (
    check.storePriceMatchAttemptId === null ||
    check.storePriceMatchProposalId === null ||
    check.sourceId === null
  ) {
    return false;
  }

  const [attempt] = await database
    .select({
      finalStatus: storePriceMatchAttempts.finalStatus,
      priceId: storePriceMatchAttempts.priceId,
      proposalId: storePriceMatchAttempts.proposalId,
    })
    .from(storePriceMatchAttempts)
    .where(eq(storePriceMatchAttempts.id, check.storePriceMatchAttemptId))
    .limit(1);

  return (
    attempt !== undefined &&
    attempt.proposalId === check.storePriceMatchProposalId &&
    String(attempt.priceId) === check.sourceId &&
    attempt.finalStatus !== null &&
    TERMINAL_STORE_PRICE_ATTEMPT_STATUSES.has(attempt.finalStatus)
  );
}
