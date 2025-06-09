import BadgeImage from "@peated/web/components/badgeImage";
import Leaderboard from "@peated/web/components/badges/leaderboard";
import BetaNotice from "@peated/web/components/betaNotice";
import useAuth from "@peated/web/hooks/useAuth";
import { redirectToAuth } from "@peated/web/lib/auth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";
import { DefaultLayout } from "../../layouts";

export const Route = createFileRoute("/_default/badges/$badgeId")({
  component: Page,
});

function Page() {
  const { badgeId } = Route.useParams();
  const { user } = useAuth();
  const orpc = useORPC();
  const { data: badge } = useSuspenseQuery(
    orpc.badges.details.queryOptions({
      input: {
        badge: Number.parseInt(badgeId, 10),
      },
    })
  );

  if (!user) {
    return redirectToAuth({ pathname: `/badges/${badgeId}` });
  }

  return (
    <DefaultLayout>
      <div className="my-4 flex w-full flex-wrap justify-center gap-x-3 gap-y-4 lg:flex-nowrap lg:justify-start">
        <div className="hidden lg:block">
          <BadgeImage badge={badge} />
        </div>

        <div className="flex flex-auto flex-col items-center justify-center truncate lg:w-auto lg:items-start">
          <h1 className="max-w-full truncate text-center font-semibold text-2xl lg:mx-0 lg:text-left">
            {badge.name}
          </h1>
          <div className="text-muted">Max Level: {badge.maxLevel}</div>
        </div>
      </div>
      <BetaNotice>This page is under construction.</BetaNotice>

      <Suspense>
        <Leaderboard badgeId={badge.id} />
      </Suspense>
    </DefaultLayout>
  );
}
