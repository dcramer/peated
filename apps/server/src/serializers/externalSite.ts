import type { z } from "zod";
import { serializer } from ".";
import type { ExternalSite, User } from "../db/schema";
import type { ExternalSiteSchema } from "../schemas";

export const ExternalSiteSerializer = serializer({
  name: "externalSite",
  item: (
    item: ExternalSite,
    attrs: Record<string, any>,
    currentUser?: User
  ): z.infer<typeof ExternalSiteSchema> => {
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      lastRunAt: item.lastRunAt?.toISOString() ?? null,
      nextRunAt: item.nextRunAt?.toISOString() ?? null,
      runEvery: item.runEvery,
    };
  },
});
