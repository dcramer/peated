import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { cache } from "react";

import { BadgePage } from "./badgePage.stylex";

const getBadge = cache(async (badgeId: number) => {
  const { client } = await getServerClient();
  return await resolveOrNotFound(client.badges.details({ badge: badgeId }));
});

export async function generateMetadata(props: {
  params: Promise<{ badgeId: string }>;
}) {
  const { badgeId } = await props.params;
  const badge = await getBadge(Number(badgeId));
  return { title: badge.name };
}

export default async function BadgeDetailsPage(props: {
  params: Promise<{ badgeId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { badgeId } = await props.params;
  if (!(await isLoggedIn())) {
    redirectToAuth({ pathname: `/badges/${badgeId}` });
  }

  const input = getApiQueryParams(await props.searchParams, {
    numericFields: ["cursor", "limit"],
    overrides: { badge: Number(badgeId) },
  });
  const page = Number(input.cursor ?? 1) || 1;
  const { client } = await getServerClient();
  const [badge, awardList] = await Promise.all([
    getBadge(Number(badgeId)),
    client.badges.userList(input),
  ]);

  return <BadgePage awardList={awardList} badge={badge} page={page} />;
}
