import config from "@peated/server/config";
import { z } from "zod";
import { procedure } from "..";

export default procedure
  .route({ method: "GET", path: "/version" })
  .output(z.object({ version: z.string() }))
  .handler(async function () {
    return {
      version: config.VERSION,
    };
  });
