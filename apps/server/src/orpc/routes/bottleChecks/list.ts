import {
  ListActionableBottleChecksInputSchema,
  listActionableBottleChecks,
} from "@peated/server/lib/bottleChecks";
import { procedure } from "@peated/server/orpc";
import { requireMod } from "@peated/server/orpc/middleware";
import { BottleCheckResponseSchema } from "@peated/server/schemas/bottleChecks";
import { serializeBottleCheck } from "@peated/server/serializers/bottleCheck";
import { z } from "zod";

export default procedure
  .use(requireMod)
  .route({
    method: "GET",
    path: "/bottle-checks",
    summary: "List actionable Bottle checks",
    spec: (spec) => ({ ...spec, operationId: "listBottleChecks" }),
  })
  .input(ListActionableBottleChecksInputSchema)
  .output(
    z
      .object({
        results: z.array(BottleCheckResponseSchema),
        rel: z
          .object({
            nextCursor: z.number().nullable(),
            prevCursor: z.number().nullable(),
          })
          .strict(),
      })
      .strict(),
  )
  .handler(async ({ input }) => {
    const result = await listActionableBottleChecks(input);
    return {
      ...result,
      results: result.results.map(serializeBottleCheck),
    };
  });
