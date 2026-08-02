import config from "@peated/server/config";
import { procedure } from "@peated/server/orpc";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/",
    summary: "API root",
    description: "Get basic API information including version",
    spec: (spec) => ({
      ...spec,
      operationId: "getRoot",
    }),
  })
  .output(
    z.object({
      version: z.string(),
      capabilities: z.object({
        bottleAudits: z.boolean(),
        bottleCheckExecution: z.boolean(),
        bottleChecks: z.boolean(),
      }),
    }),
  )
  .handler(async function () {
    return {
      version: config.VERSION,
      capabilities: {
        bottleAudits:
          config.BOTTLE_CHECK_MODERATOR_VISIBILITY &&
          config.BOTTLE_CHECK_SHADOW_GENERATION,
        bottleCheckExecution: config.BOTTLE_CHECK_EXECUTION,
        bottleChecks: config.BOTTLE_CHECK_MODERATOR_VISIBILITY,
      },
    };
  });
