import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { getQueryClient } from "@peated/web/lib/orpc/query";
import { getProfilePage } from "@peated/web/lib/profilePage.server";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";

import { getProfileTastingCursor, profileQueries } from "../profileQueries";
import { ProfileTastingsPageClient } from "./profileTastingsPageClient.stylex";

export const fetchCache = "default-no-store";

export default async function ProfilePageRoute(props: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await props.params;
  const { client } = await createServerClient();
  const user = await getProfilePage(username);
  const cursor = getProfileTastingCursor(await props.searchParams);
  const queryClient = getQueryClient();
  const orpc = createTanstackQueryUtils(client);
  await Promise.all([
    queryClient.prefetchQuery(profileQueries.regions(orpc, user.id)),
    queryClient.prefetchQuery(profileQueries.tastings(orpc, user.id, cursor)),
  ]);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ProfileTastingsPageClient />
    </HydrationBoundary>
  );
}
