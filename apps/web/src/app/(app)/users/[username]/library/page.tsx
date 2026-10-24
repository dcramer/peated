import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { getQueryClient } from "@peated/web/lib/orpc/query";
import { getProfilePage } from "@peated/web/lib/profilePage.server";
import { noIndexFollowPageMetadata } from "@peated/web/lib/seoMetadata";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { getProfileLibraryInput, profileQueries } from "../profileQueries";
import { ProfileLibraryPageClient } from "./profileLibraryPageClient";

// Search engines should index the profile overview, not this list.
export const metadata: Metadata = noIndexFollowPageMetadata;

export default async function ProfileLibraryPage(props: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await props.params;
  const { client } = await createServerClient();
  const user = await getProfilePage(username);
  const libraryInput = getProfileLibraryInput(
    await props.searchParams,
    user.id,
  );
  const queryClient = getQueryClient();
  const orpc = createTanstackQueryUtils(client);
  await Promise.all([
    // The rail names a brand or producer picked from search; render it now.
    ...(libraryInput.entity === undefined
      ? []
      : [
          queryClient.prefetchQuery(
            orpc.entities.details.queryOptions({
              input: { entity: libraryInput.entity },
            }),
          ),
        ]),
    queryClient.prefetchQuery(profileQueries.library(orpc, libraryInput)),
    queryClient.prefetchQuery(profileQueries.libraryStats(orpc, user.id)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProfileLibraryPageClient />
    </HydrationBoundary>
  );
}
