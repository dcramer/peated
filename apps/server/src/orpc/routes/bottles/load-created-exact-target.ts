import type { User } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import { loadCatalogTarget } from "@peated/server/lib/catalogTargets";
import type { CreateConcreteBottleResult } from "@peated/server/lib/createConcreteBottle";
import type { Context } from "@peated/server/orpc/context";
import type { ExactCatalogTargetV1 } from "@peated/server/schemas";

/** Ensures a create adapter cannot return an exact target from another graph. */
export default async function loadCreatedExactTarget(
  result: CreateConcreteBottleResult,
  context: Context & { user: User },
): Promise<ExactCatalogTargetV1> {
  const target = await loadCatalogTarget(result.exactTarget.id, {
    actor: await getUserActor(context.user),
    permissions: { canReadCatalogIdentity: true },
  });

  if (
    target.kind !== "bottle" ||
    target.targetId !== result.exactTarget.id ||
    target.bottle.id !== result.bottle.id ||
    target.group.id !== result.group.id
  ) {
    throw new Error("Created Bottle target does not match its catalog graph.");
  }

  return target;
}
