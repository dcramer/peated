import { getApiQueryParams } from "@peated/web/lib/apiQueryParams";
import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { getServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { cache, Suspense } from "react";

import {
  BadgeLeaderboard,
  BadgeLeaderboardLoading,
  BadgePageFrame,
} from "./badgePage.stylex";

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
  const badge = await getBadge(Number(badgeId));

  return (
    <BadgePageFrame badge={badge}>
      <Suspense
        key={String(input.cursor ?? 1)}
        fallback={<BadgeLeaderboardLoading />}
      >
        <BadgeResults badge={badge} input={input} />
      </Suspense>
    </BadgePageFrame>
  );
}

async function BadgeResults({
  badge,
  input,
}: {
  badge: Awaited<ReturnType<typeof getBadge>>;
  input: ReturnType<typeof getApiQueryParams>;
}) {
  const { client } = await getServerClient();
  const awardList = await client.badges.userList(input);
  const page = Number(input.cursor ?? 1) || 1;

  return <BadgeLeaderboard awardList={awardList} badge={badge} page={page} />;
}
