import { getExternalSiteConfig } from "@peated/server/lib/externalSiteConfig";
import { ExternalSiteNotFoundError } from "@peated/server/lib/externalSites";
import { procedure } from "@peated/server/orpc";
import { requireAdmin } from "@peated/server/orpc/middleware";
import { ExternalSiteTypeEnum } from "@peated/server/schemas";
import { z } from "zod";

export default procedure
  .use(requireAdmin)
  .route({
    method: "GET",
    path: "/external-sites/{site}/config/{key}",
    summary: "Get external site config",
    description:
      "Retrieve a configuration value for an external site. Returns default if not set. Requires admin privileges",
    operationId: "getExternalSiteConfig",
  })
  .input(
    z.object({
      site: ExternalSiteTypeEnum,
      key: z.string(),
      default: z.any().default(null),
    }),
  )
  .output(z.any())
  .handler(async function ({ input, errors }) {
    try {
      return await getExternalSiteConfig({
        site: input.site,
        key: input.key,
        defaultValue: input.default,
      });
    } catch (error) {
      if (error instanceof ExternalSiteNotFoundError) {
        throw errors.NOT_FOUND({ message: "Site not found.", cause: error });
      }
      throw error;
    }
  });
