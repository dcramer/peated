import {
  DirtyParentReleaseRepairBadRequestError,
  applyDirtyParentReleaseRepair,
} from "@peated/server/lib/applyDirtyParentReleaseRepair";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottles/{bottle}/apply-dirty-parent-release-repair",
    summary: "Apply dirty parent release repair",
    description:
      "Clear bottle-level release traits from a dirty parent bottle, create or reuse the matching child release beneath it, and move bottle-scoped rows onto that release. Requires moderator privileges.",
    spec: (spec) => ({
      ...spec,
      operationId: "applyBottleDirtyParentReleaseRepair",
    }),
  })
  .input(
    z.object({
      bottle: z.coerce.number(),
    }),
  )
  .output(
    z.object({
      bottleId: z.number(),
      releaseId: z.number(),
    }),
  )
  .handler(async function ({ input, context, errors }) {
    try {
      return await applyDirtyParentReleaseRepair({
        bottleId: input.bottle,
        user: context.user,
      });
    } catch (err) {
      if (err instanceof DirtyParentReleaseRepairBadRequestError) {
        throw errors.BAD_REQUEST({
          message: err.message,
        });
      }

      throw err;
    }
  });
