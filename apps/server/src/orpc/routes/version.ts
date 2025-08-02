import config from "@peated/server/config";
import { procedure } from "@peated/server/orpc";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/version",
    summary: "Get API version",
    description: "Retrieve the current API version",
    spec: (spec) => ({
      ...spec,
      operationId: "getVersion",
    }),
  })
  .output(z.object({ version: z.string() }))
  .handler(async function () {
    return {
      version: config.VERSION,
    };
  });
