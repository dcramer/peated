import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { getQueryClient } from "@peated/web/lib/orpc/query";
import { getProfilePage } from "@peated/web/lib/profilePage.server";
import { noIndexFollowPageMetadata } from "@peated/web/lib/seoMetadata";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import { getProfileTastingInput, profileQueries } from "../profileQueries";
import { ProfileTastingsPageClient } from "./profileTastingsPageClient";

export const fetchCache = "default-no-store";

// Search engines should index the profile overview, not this list.
export const metadata: Metadata = noIndexFollowPageMetadata;

export default async function ProfilePageRoute(props: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await props.params;
  const { client } = await createServerClient();
  const user = await getProfilePage(username);
  const tastingInput = getProfileTastingInput(
    await props.searchParams,
    user.id,
  );
  const queryClient = getQueryClient();
  const orpc = createTanstackQueryUtils(client);
  await Promise.all([
    queryClient.prefetchQuery(profileQueries.regions(orpc, user.id)),
    queryClient.prefetchQuery(profileQueries.tastingStats(orpc, user.id)),
    queryClient.prefetchQuery(profileQueries.tastings(orpc, tastingInput)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProfileTastingsPageClient />
    </HydrationBoundary>
  );
}
