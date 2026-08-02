import type { OAuthClient, User } from "@peated/server/db/schema";
import type { OAuthClientSchema } from "@peated/server/schemas";
import type { z } from "zod";
import { serializer } from ".";

export const OAuthClientSerializer = serializer({
  name: "oauthClient",
  item: (
    item: OAuthClient,
    _attrs: Record<string, never>,
    _currentUser?: User | null,
  ): z.infer<typeof OAuthClientSchema> => ({
    id: item.id,
    clientId: item.clientId,
    name: item.name,
    redirectUris: item.redirectUris,
    active: item.active,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }),
});
