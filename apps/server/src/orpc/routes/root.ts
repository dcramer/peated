import { implement } from "@orpc/server";
import sentryMiddleware from "@peated/orpc/server/middleware";
import config from "@peated/server/config";
import type { Context } from "@peated/server/orpc/context";
import rootContract from "@peated/server/orpc/contracts/root";

export default implement(rootContract)
  .$context<Context>()
  .use(sentryMiddleware())
  .handler(async function () {
    return {
      version: config.VERSION,
    };
  });
