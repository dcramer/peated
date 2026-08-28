import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";

import { ProfileActivityPageClient } from "./profileActivityPageClient.stylex";

export default async function ProfileActivityPage(props: {
  params: Promise<{ username: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { username } = await props.params;
  const { client } = await createServerClient();
  const user = await resolveOrNotFound(
    client.users.details({ user: username }),
  );
  const activityInput = getApiQueryParams(await props.searchParams, {
    overrides: { limit: 10, user: user.id },
  });
  const activityList = await client.users.activity.list(activityInput);

  return <ProfileActivityPageClient initialActivityList={activityList} />;
}
