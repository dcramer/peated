import type { User } from "@peated/server/db/schema";
import { getUserActor } from "@peated/server/lib/actors";
import {
  loadCatalogTarget,
  loadCatalogTargetByBottleId,
} from "@peated/server/lib/catalogTargets";
import type { Context } from "@peated/server/orpc/context";
import type { ExactCatalogTargetV1 } from "@peated/server/schemas";

type ExpectedExactCatalogGraph = {
  bottleId: number;
  groupId: number;
  targetId?: number;
};

/** Reloads one exact target and verifies it still identifies the expected graph. */
export default async function loadExactTarget(
  expected: ExpectedExactCatalogGraph,
  context: Context & { user: User },
): Promise<ExactCatalogTargetV1> {
  const serializerContext = {
    actor: await getUserActor(context.user),
    permissions: { canReadCatalogIdentity: true },
  };
  const target =
    expected.targetId === undefined
      ? await loadCatalogTargetByBottleId(expected.bottleId, serializerContext)
      : await loadCatalogTarget(expected.targetId, serializerContext);

  if (
    target.kind !== "bottle" ||
    (expected.targetId !== undefined &&
      target.targetId !== expected.targetId) ||
    target.bottle.id !== expected.bottleId ||
    target.group.id !== expected.groupId
  ) {
    throw new Error("Exact Bottle target does not match its catalog graph.");
  }

  return target;
}
