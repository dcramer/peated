import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { getQueryClient } from "@peated/web/lib/orpc/query";
import { getProfilePage } from "@peated/web/lib/profilePage.server";
import { noIndexFollowPageMetadata } from "@peated/web/lib/seoMetadata";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";

import {
  getProfileActivityRouteState,
  profileQueries,
} from "../profileQueries";
import { ProfileActivityPageClient } from "./profileActivityPageClient.stylex";

// Search engines should index the profile overview, not this list.
export const metadata: Metadata = noIndexFollowPageMetadata;

export default async function ProfileActivityPage(props: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await props.params;
  const { client } = await createServerClient();
  const user = await getProfilePage(username);
  const { cursor } = getProfileActivityRouteState(await props.searchParams);
  const queryClient = getQueryClient();
  const orpc = createTanstackQueryUtils(client);
  await queryClient.prefetchInfiniteQuery(
    profileQueries.activity(orpc, user.id, cursor),
  );

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProfileActivityPageClient />
    </HydrationBoundary>
  );
}
