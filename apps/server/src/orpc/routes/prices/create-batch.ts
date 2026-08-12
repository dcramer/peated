import { getUserActor } from "@peated/server/lib/actors";
import {
  CreateStorePricesInputSchema,
  createStorePrices,
} from "@peated/server/lib/createStorePrices";
import { ExternalSiteNotFoundError } from "@peated/server/lib/externalSites";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "POST",
    path: "/external-sites/{site}/prices",
    summary: "Create batch prices",
    description:
      "Bulk create or update store prices for an external site with automatic bottle matching and alias creation. Requires admin privileges",
    operationId: "createPricesBatch",
  })
  .input(CreateStorePricesInputSchema)
  .output(z.object({}))
  .handler(async function ({ input, context, errors }) {
    try {
      const actor = await getUserActor(context.user);
      await createStorePrices(input, actor.id);
    } catch (error) {
      if (error instanceof ExternalSiteNotFoundError) {
        throw errors.NOT_FOUND({ message: "Site not found.", cause: error });
      }
      throw error;
    }

    return {};
  });
