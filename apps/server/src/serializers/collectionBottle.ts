import { and, eq, inArray } from "drizzle-orm";
import { type z } from "zod";
import { serializer } from ".";
import config from "../config";
import { db } from "../db";
import { type CollectionBottle, tastings, type User } from "../db/schema";
import { loadCatalogTargetReadsWithParity } from "../lib/catalogTargetReadParity";
import { CatalogTargetIntegrityMismatchError } from "../lib/catalogTargets";
import { absoluteUrl } from "../lib/urls";
import { type CollectionBottleSchema } from "../schemas";
import type { CatalogTargetV1 } from "../schemas/catalogIdentity";

type CollectionBottleAttrs = {
  target: CatalogTargetV1;
  hasTasted: boolean;
};

export const CollectionBottleSerializer = serializer({
  name: "collectionBottle",
  attrs: async (
    itemList: CollectionBottle[],
    currentUser?: User,
  ): Promise<Record<number, CollectionBottleAttrs>> => {
    const { targets } = await loadCatalogTargetReadsWithParity(
      itemList.map((item) => ({
        consumerTable: "collection_bottle",
        rowLocator: { id: item.id },
        targetId: item.targetId,
        legacy: { bottleId: item.bottleId, releaseId: item.releaseId },
      })),
      {
        actor: null,
        permissions: { canReadCatalogIdentity: true },
        caller: "CollectionBottleSerializer",
        operation: "serialize",
      },
    );
    const targetIds = targets.flatMap((target) =>
      target ? [target.targetId] : [],
    );
    const tastedTargetIds = new Set(
      currentUser && targetIds.length
        ? (
            await db
              .selectDistinct({ targetId: tastings.targetId })
              .from(tastings)
              .where(
                and(
                  eq(tastings.createdById, currentUser.id),
                  inArray(tastings.targetId, targetIds),
                ),
              )
          ).flatMap(({ targetId }) => (targetId === null ? [] : [targetId]))
        : [],
    );
    return Object.fromEntries(
      itemList.map((item, index) => {
        const target = targets[index];
        if (!target) {
          if (item.targetId === null && item.bottleId === null) {
            throw new Error(
              `collection membership ${item.id} has no catalog identity`,
            );
          }
          throw new CatalogTargetIntegrityMismatchError(
            item.targetId !== null
              ? { targetId: item.targetId }
              : { bottleId: item.bottleId! },
            `collection membership ${item.id} has no durable CatalogTarget`,
          );
        }
        return [
          item.id,
          {
            target,
            hasTasted: tastedTargetIds.has(target.targetId),
          },
        ];
      }),
    );
  },
  item: (
    item: CollectionBottle,
    attrs: CollectionBottleAttrs,
    _currentUser?: User,
  ): z.infer<typeof CollectionBottleSchema> => {
    return {
      id: item.id,
      imageUrl: item.imageUrl
        ? absoluteUrl(config.API_SERVER, item.imageUrl)
        : null,
      status: item.status,
      target: attrs.target,
      hasTasted: attrs.hasTasted,
    };
  },
});
