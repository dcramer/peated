import config from "@peated/server/config";
import { procedure } from "@peated/server/orpc";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/version",
    summary: "Get API version",
    spec: {
      operationId: "getApiVersion",
    },
    description: "Retrieve the current API version",
  })
  .output(z.object({ version: z.string() }))
  .handler(async function () {
    return {
      version: config.VERSION,
    };
  });
