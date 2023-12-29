import { serializer } from ".";
import type { ExternalSite, User } from "../db/schema";

export const ExternalSiteSerializer = serializer({
  item: (
    item: ExternalSite,
    attrs: Record<string, any>,
    currentUser?: User,
  ) => {
    return {
      id: item.id,
      name: item.name,
      type: item.type,
      lastRunAt: item.lastRunAt,
    };
  },
});
