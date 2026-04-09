import {
  DirtyParentAgeRepairBadRequestError,
  applyDirtyParentAgeRepair,
} from "@peated/server/lib/applyDirtyParentAgeRepair";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "POST",
    path: "/bottles/{bottle}/apply-age-repair",
    summary: "Apply dirty parent age repair",
    description:
      "Move a dirty parent bottle age into a child bottle release and clear the parent age. Requires moderator privileges.",
    spec: (spec) => ({
      ...spec,
      operationId: "applyBottleAgeRepair",
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
      return await applyDirtyParentAgeRepair({
        bottleId: input.bottle,
        user: context.user,
      });
    } catch (err) {
      if (err instanceof DirtyParentAgeRepairBadRequestError) {
        throw errors.BAD_REQUEST({
          message: err.message,
        });
      }

      throw err;
    }
  });
