import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { getProfilePage } from "@peated/web/lib/profilePage.server";

import { ProfileTastingsPageClient } from "./profileTastingsPageClient.stylex";

export const fetchCache = "default-no-store";

export default async function ProfilePageRoute(props: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await props.params;
  const { client } = await createServerClient();
  const user = await getProfilePage(username);
  const tastingInput = getApiQueryParams(await props.searchParams, {
    defaults: { cursor: 1 },
    numericFields: ["cursor"],
    overrides: { limit: 10, user: user.id },
  });
  const [regionList, tastingList] = await Promise.all([
    client.users.regionList({ user: user.id }),
    client.tastings.list(tastingInput),
  ]);

  return (
    <ProfileTastingsPageClient
      initialRegionList={regionList}
      initialTastingList={tastingList}
    />
  );
}
