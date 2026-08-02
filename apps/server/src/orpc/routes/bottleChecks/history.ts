import config from "@peated/server/config";
import { getBottleCheckHistory } from "@peated/server/lib/bottleChecks";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleCheckResponseSchema } from "@peated/server/schemas/bottleChecks";
import { serializeBottleCheck } from "@peated/server/serializers/bottleCheck";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/bottles/{bottle}/checks",
    summary: "List Bottle audit history",
    spec: (spec) => ({ ...spec, operationId: "listBottleCheckHistory" }),
  })
  .input(z.object({ bottle: z.coerce.number().int().positive() }).strict())
  .output(
    z
      .object({
        results: z.array(BottleCheckResponseSchema),
      })
      .strict(),
  )
  .handler(async ({ input, errors }) => {
    if (!config.BOTTLE_CHECK_MODERATOR_VISIBILITY) {
      throw errors.NOT_FOUND();
    }

    const results = await getBottleCheckHistory({
      intent: "audit_bottle",
      bottleId: input.bottle,
    });
    return { results: results.map(serializeBottleCheck) };
  });
