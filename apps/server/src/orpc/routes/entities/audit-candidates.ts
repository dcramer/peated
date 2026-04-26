import {
  EntityClassificationReferenceSchema,
  EntityTypeEnum,
} from "@peated/entity-classifier";
import { getEntityAuditCandidates } from "@peated/server/lib/entityAuditCandidates";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/entities/audit-candidates",
    summary: "List suspected invalid or repairable entities",
    description:
      "Retrieve moderator-facing entity audit candidates for generic brand rows, suffix collisions, and bottle evidence that points at a stronger existing brand.",
    spec: (spec) => ({
      ...spec,
      operationId: "listEntityAuditCandidates",
    }),
  })
  .input(
    z.object({
      query: z.coerce.string().default(""),
      cursor: z.coerce.number().gte(1).default(1),
      limit: z.coerce.number().gte(1).lte(100).default(25),
      type: EntityTypeEnum.nullable().default("brand"),
    }),
  )
  .output(
    z.object({
      results: z.array(EntityClassificationReferenceSchema),
      rel: z.object({
        nextCursor: z.number().nullable(),
        prevCursor: z.number().nullable(),
      }),
    }),
  )
  .handler(async function ({ input }) {
    return await getEntityAuditCandidates(input);
  });
