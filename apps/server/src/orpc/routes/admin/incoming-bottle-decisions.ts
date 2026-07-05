import { db } from "@peated/server/db";
import {
  actors,
  bottleReleases,
  bottles,
  externalSites,
  incomingBottleDecisionLogs,
} from "@peated/server/db/schema";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { z } from "zod";

const IncomingBottleDecisionSourceKindSchema = z.enum([
  "review",
  "store_price",
]);
const IncomingBottleDecisionActorTypeSchema = z.enum(["system", "user"]);
const IncomingBottleDecisionTypeSchema = z.enum([
  "match_existing",
  "create_bottle",
  "create_release",
  "create_bottle_and_release",
]);

const IncomingBottleDecisionListInputSchema = z
  .object({
    cursor: z.coerce.number().gte(1).default(1),
    limit: z.coerce.number().gte(1).lte(100).default(50),
    sourceKind: IncomingBottleDecisionSourceKindSchema.optional(),
    actor: IncomingBottleDecisionActorTypeSchema.optional(),
  })
  .default({
    cursor: 1,
    limit: 50,
  });

const IncomingBottleDecisionListResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.number(),
      sourceKind: IncomingBottleDecisionSourceKindSchema,
      sourceId: z.number(),
      proposalId: z.number().nullable(),
      externalSite: z.object({
        id: z.number(),
        name: z.string(),
        type: z.string(),
      }),
      name: z.string(),
      url: z.string().nullable(),
      decision: IncomingBottleDecisionTypeSchema,
      actor: z.object({
        id: z.number(),
        type: z.enum(["system", "user"]),
        key: z.string(),
        displayName: z.string(),
      }),
      bottle: z.object({
        id: z.number(),
        fullName: z.string(),
      }),
      release: z
        .object({
          id: z.number(),
          fullName: z.string(),
        })
        .nullable(),
      createdBottle: z.boolean(),
      createdRelease: z.boolean(),
      confidence: z.number().nullable(),
      model: z.string().nullable(),
      rationale: z.string().nullable(),
      metadata: z.record(z.string(), z.unknown()),
      createdAt: z.string().datetime(),
    }),
  ),
  rel: z.object({
    nextCursor: z.number().nullable(),
    prevCursor: z.number().nullable(),
  }),
});

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/admin/incoming-bottle-decisions",
    summary: "List incoming bottle decisions",
    description:
      "Retrieve applied incoming listing bottle decisions for admin review. Requires admin privileges",
    operationId: "listIncomingBottleDecisions",
  })
  .input(IncomingBottleDecisionListInputSchema)
  .output(IncomingBottleDecisionListResponseSchema)
  .handler(async function ({ input }) {
    const offset = (input.cursor - 1) * input.limit;
    const where: SQL<unknown>[] = [];

    if (input.sourceKind) {
      where.push(eq(incomingBottleDecisionLogs.sourceKind, input.sourceKind));
    }
    if (input.actor) {
      where.push(eq(actors.type, input.actor));
    }

    const rows = await db
      .select({
        log: incomingBottleDecisionLogs,
        externalSite: externalSites,
        bottle: {
          id: bottles.id,
          fullName: bottles.fullName,
        },
        release: {
          id: bottleReleases.id,
          fullName: bottleReleases.fullName,
        },
        actor: {
          id: actors.id,
          type: actors.type,
          key: actors.key,
          displayName: actors.displayName,
        },
      })
      .from(incomingBottleDecisionLogs)
      .innerJoin(
        externalSites,
        eq(externalSites.id, incomingBottleDecisionLogs.externalSiteId),
      )
      .innerJoin(bottles, eq(bottles.id, incomingBottleDecisionLogs.bottleId))
      .leftJoin(
        bottleReleases,
        eq(bottleReleases.id, incomingBottleDecisionLogs.releaseId),
      )
      .innerJoin(actors, eq(actors.id, incomingBottleDecisionLogs.actorId))
      .where(where.length ? and(...where) : undefined)
      .orderBy(
        desc(incomingBottleDecisionLogs.createdAt),
        desc(incomingBottleDecisionLogs.id),
      )
      .limit(input.limit + 1)
      .offset(offset);

    const hasNextPage = rows.length > input.limit;

    return {
      results: rows.slice(0, input.limit).map((row) => ({
        id: row.log.id,
        sourceKind: row.log.sourceKind,
        sourceId: row.log.sourceId,
        proposalId: row.log.proposalId,
        externalSite: {
          id: row.externalSite.id,
          name: row.externalSite.name,
          type: row.externalSite.type,
        },
        name: row.log.name,
        url: row.log.url,
        decision: row.log.decision,
        actor: row.actor,
        bottle: row.bottle,
        release: row.release?.id
          ? {
              id: row.release.id,
              fullName: row.release.fullName!,
            }
          : null,
        createdBottle: row.log.createdBottle,
        createdRelease: row.log.createdRelease,
        confidence: row.log.confidence,
        model: row.log.model,
        rationale: row.log.rationale,
        metadata: row.log.metadata,
        createdAt: row.log.createdAt.toISOString(),
      })),
      rel: {
        nextCursor: hasNextPage ? input.cursor + 1 : null,
        prevCursor: input.cursor > 1 ? input.cursor - 1 : null,
      },
    };
  });
