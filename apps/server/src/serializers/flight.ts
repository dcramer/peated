import { and, asc, eq, inArray } from "drizzle-orm";
import { type z } from "zod";
import { serialize, serializer } from ".";
import { db } from "../db";
import type { Flight, User } from "../db/schema";
import {
  collectionBottles,
  entities,
  flightBottles,
  tastings,
} from "../db/schema";
import { loadCatalogTargetReadsWithParity } from "../lib/catalogTargetReadParity";
import { CatalogTargetIntegrityMismatchError } from "../lib/catalogTargets";
import { getReservedCollection } from "../lib/db";
import { type FlightDetailsSchema, type FlightSchema } from "../schemas";
import type { CatalogTargetV1 } from "../schemas/catalogIdentity";
import type { EntitySchema } from "../schemas/entities";
import { EntitySerializer } from "./entity";

type FlightTarget = z.infer<typeof FlightDetailsSchema>["targets"][number];

type FlightAttrs = { targets: FlightTarget[] };

function targetLabel(target: CatalogTargetV1): string {
  return target.kind === "bottle"
    ? target.bottle.fullName
    : target.group.fullName;
}

function flightProjection(item: Flight): z.infer<typeof FlightSchema> {
  return {
    id: item.publicId,
    name: item.name,
    description: item.description,
    public: item.public,
    createdAt: item.createdAt.toISOString(),
  };
}

export const FlightSerializer = serializer({
  name: "flight",
  item: (item: Flight): z.infer<typeof FlightSchema> => flightProjection(item),
});

export const FlightDetailsSerializer = serializer({
  name: "flightDetails",
  attrs: async (
    itemList: Flight[],
    currentUser?: User | null,
  ): Promise<Record<number, FlightAttrs>> => {
    const flightIds = itemList.map(({ id }) => id);
    const memberships = await db
      .select()
      .from(flightBottles)
      .where(inArray(flightBottles.flightId, flightIds))
      .orderBy(asc(flightBottles.flightId), asc(flightBottles.bottleId));
    const { targets } = await loadCatalogTargetReadsWithParity(
      memberships.map((membership) => ({
        consumerTable: "flight_bottle",
        rowLocator: {
          flightId: membership.flightId,
          bottleId: membership.bottleId,
          releaseId: membership.releaseId,
          targetId: membership.targetId,
        },
        targetId: membership.targetId,
        legacy: {
          bottleId: membership.bottleId,
          releaseId: membership.releaseId,
        },
      })),
      {
        actor: null,
        permissions: { canReadCatalogIdentity: true },
        caller: "FlightDetailsSerializer",
        operation: "serialize",
      },
    );

    const targetIds = targets.flatMap((target) =>
      target ? [target.targetId] : [],
    );
    const distillerIds = [
      ...new Set(
        targets.flatMap((target) => {
          if (!target) return [];
          return target.kind === "bottle"
            ? target.bottle.distillerIds
            : target.group.distillerIds;
        }),
      ),
    ];
    const distillerRows = distillerIds.length
      ? await db
          .select()
          .from(entities)
          .where(inArray(entities.id, distillerIds))
      : [];
    const distillersById: Record<
      number,
      z.infer<typeof EntitySchema>
    > = Object.fromEntries(
      (
        await serialize(EntitySerializer, distillerRows, currentUser, [
          "description",
        ])
      ).map((entity, index) => [distillerRows[index].id, entity]),
    );

    const tastedRows =
      currentUser && targetIds.length
        ? await db
            .selectDistinct({
              flightId: tastings.flightId,
              targetId: tastings.targetId,
            })
            .from(tastings)
            .where(
              and(
                inArray(tastings.flightId, flightIds),
                inArray(tastings.targetId, targetIds),
                eq(tastings.createdById, currentUser.id),
              ),
            )
        : [];
    const tastedKeys = new Set(
      tastedRows.flatMap(({ flightId, targetId }) =>
        flightId && targetId ? [`${flightId}:${targetId}`] : [],
      ),
    );

    const library = currentUser
      ? await getReservedCollection(db, currentUser.id, "library")
      : null;
    const libraryTargetIds = new Set(
      library && targetIds.length
        ? (
            await db
              .selectDistinct({ targetId: collectionBottles.targetId })
              .from(collectionBottles)
              .where(
                and(
                  eq(collectionBottles.collectionId, library.id),
                  inArray(collectionBottles.targetId, targetIds),
                ),
              )
          ).flatMap(({ targetId }) => (targetId ? [targetId] : []))
        : [],
    );

    const targetsByFlightId = new Map<number, FlightTarget[]>();
    memberships.forEach((membership, index) => {
      const target = targets[index];
      if (!target) {
        if (membership.targetId === null && membership.bottleId === null) {
          throw new Error(
            `flight membership ${membership.flightId} has no catalog identity`,
          );
        }
        throw new CatalogTargetIntegrityMismatchError(
          membership.targetId !== null
            ? { targetId: membership.targetId }
            : { bottleId: membership.bottleId! },
          `flight membership (${membership.flightId}, ${membership.bottleId}, ${membership.releaseId ?? "null"}) has no durable CatalogTarget`,
        );
      }
      const flightTargets = targetsByFlightId.get(membership.flightId) ?? [];
      const ownerDistillerIds =
        target.kind === "bottle"
          ? target.bottle.distillerIds
          : target.group.distillerIds;
      flightTargets.push({
        target,
        distillers: ownerDistillerIds.flatMap((id) =>
          distillersById[id] ? [distillersById[id]] : [],
        ),
        hasTasted: tastedKeys.has(`${membership.flightId}:${target.targetId}`),
        isLibrary: libraryTargetIds.has(target.targetId),
      });
      targetsByFlightId.set(membership.flightId, flightTargets);
    });

    return Object.fromEntries(
      itemList.map(({ id }) => [
        id,
        {
          targets: (targetsByFlightId.get(id) ?? []).sort(
            (left, right) =>
              targetLabel(left.target).localeCompare(
                targetLabel(right.target),
              ) || left.target.targetId - right.target.targetId,
          ),
        },
      ]),
    );
  },
  item: (
    item: Flight,
    attrs: FlightAttrs,
  ): z.infer<typeof FlightDetailsSchema> => {
    return {
      ...flightProjection(item),
      targets: attrs.targets,
    };
  },
});
