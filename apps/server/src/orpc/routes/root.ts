import config from "@peated/server/config";
import { procedure } from "@peated/server/orpc";
import { z } from "zod";

export default procedure
  .route({
    method: "GET",
    path: "/",
    summary: "API root",
    description: "Get basic API information including version",
  })
  .output(
    z.object({
      version: z.string(),
    })
  )
  .handler(async () => ({
    version: config.VERSION,
  }));
