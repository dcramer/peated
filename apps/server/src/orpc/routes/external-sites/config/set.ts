import { setExternalSiteConfig } from "@peated/server/lib/externalSiteConfig";
import { ExternalSiteNotFoundError } from "@peated/server/lib/externalSites";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { ExternalSiteKeySchema } from "@peated/server/schemas";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "PUT",
    path: "/external-sites/{site}/config/{key}",
    summary: "Set external site config",
    description:
      "Set or update a configuration value for an external site. Requires admin privileges",
    operationId: "setExternalSiteConfig",
  })
  .input(
    z.object({
      site: ExternalSiteKeySchema,
      key: z.string(),
      value: z.any(),
    }),
  )
  .output(z.object({}))
  .handler(async function ({ input, errors }) {
    try {
      await setExternalSiteConfig(input);
    } catch (error) {
      if (error instanceof ExternalSiteNotFoundError) {
        throw errors.NOT_FOUND({ message: "Site not found.", cause: error });
      }
      throw error;
    }

    return {};
  });
