import {
  LegacyReleaseRepairBadRequestError,
  applyLegacyReleaseRepair,
} from "@peated/server/lib/applyLegacyReleaseRepair";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottles/{bottle}/apply-release-repair",
    summary: "Apply legacy release repair",
    description:
      "Split a legacy release-like bottle into a reusable parent bottle plus a child bottle release, creating the parent when needed. Requires moderator privileges",
    spec: (spec) => ({
      ...spec,
      operationId: "applyBottleReleaseRepair",
    }),
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
    }),
  )
  .output(
    z.object({
      legacyBottleId: z.number(),
      parentBottleId: z.number(),
      releaseId: z.number(),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    try {
      return await applyLegacyReleaseRepair({
        legacyBottleId: input.bottle,
        user: context.user,
      });
    } catch (err) {
      if (err instanceof LegacyReleaseRepairBadRequestError) {
        throw errors.BAD_REQUEST({
          message: err.message,
        });
      }

      throw err;
    }
  });
