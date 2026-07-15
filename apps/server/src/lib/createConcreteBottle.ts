/**
 * Owns parsed input, transaction, and post-commit dispatch for concrete Bottle
 * creation. Independent creates are singletons; reuse requires a trusted source
 * Bottle.
 */
import type { CatalogVerificationCreationSource } from "@peated/catalog-verifier";
import { db } from "@peated/server/db";
import type { User } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  ConcreteBottleCreateInputSchema,
  type ConcreteBottleCreateInput,
} from "@peated/server/lib/concreteBottleSchemas";
import {
  createConcreteBottleInTransaction,
  finalizeCreatedBottle,
  type ConcreteBottleCreateResult,
} from "@peated/server/lib/createBottle";
import type { Context } from "@peated/server/orpc/context";

export { ConcreteBottleCreateInputSchema } from "@peated/server/lib/concreteBottleSchemas";
export type { ConcreteBottleCreateInput } from "@peated/server/lib/concreteBottleSchemas";

export {
  createConcreteBottleInTransaction,
  TrustedSourceBottleError,
} from "@peated/server/lib/createBottle";
export type {
  ConcreteBottleCreateResult,
  LikelyBottleGroupSuggestion,
  TrustedSourceBottleErrorCode,
} from "@peated/server/lib/createBottle";

export type CreateConcreteBottleResult = Pick<
  ConcreteBottleCreateResult,
  "bottle" | "group" | "genericTarget" | "exactTarget" | "likelyGroups"
>;

/** Parses untrusted input once and owns transaction plus post-commit dispatch. */
export async function createConcreteBottle({
  creationSource = "manual_entry",
  input: rawInput,
  context,
}: {
  creationSource?: CatalogVerificationCreationSource;
  input: unknown;
  context: Context & { user: User };
}): Promise<CreateConcreteBottleResult> {
  const input = ConcreteBottleCreateInputSchema.parse(rawInput);
  const actor = await getUserActor(context.user);
  const result = await db.transaction(async (tx) =>
    createConcreteBottleInTransaction(tx, {
      creationSource,
      createdByActorId: actor.id,
      input,
      context,
    }),
  );

  await finalizeCreatedBottle(result, { creationSource });
  return {
    bottle: result.bottle,
    group: result.group,
    genericTarget: result.genericTarget,
    exactTarget: result.exactTarget,
    likelyGroups: result.likelyGroups,
  };
}
