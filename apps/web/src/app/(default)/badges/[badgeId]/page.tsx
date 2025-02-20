import BadgeImage from "@peated/web/components/badgeImage";
import BetaNotice from "@peated/web/components/betaNotice";
import { redirectToAuth } from "@peated/web/lib/auth";
import { isLoggedIn } from "@peated/web/lib/auth.server";
import { getTrpcClient } from "@peated/web/lib/trpc/client.server";
import { Suspense } from "react";
import Leaderboard from "./leaderboard";

export async function generateMetadata(props: {
  params: Promise<{ badgeId: string }>;
}) {
  const params = await props.params;

  const { badgeId } = params;

  const trpcClient = await getTrpcClient();
  const badge = await trpcClient.badgeById.fetch(parseInt(badgeId, 10));

  return {
    title: `${badge.name} - Badge Details`,
  };
}

export default async function Page(props: {
  params: Promise<{ badgeId: string }>;
}) {
  const params = await props.params;

  const { badgeId } = params;

  if (!(await isLoggedIn())) {
    return redirectToAuth({ pathname: `/badges/${badgeId}` });
  }

  const trpcClient = await getTrpcClient();
  const [badge] = await Promise.all([
    trpcClient.badgeById.fetch(parseInt(badgeId, 10)),
  ]);

  return (
    <>
      <div className="my-4 flex w-full flex-wrap justify-center gap-x-3 gap-y-4 lg:flex-nowrap lg:justify-start">
        <div className="hidden lg:block">
          <BadgeImage badge={badge} />
        </div>

        <div className="flex flex-auto flex-col items-center justify-center truncate lg:w-auto lg:items-start">
          <h1 className="max-w-full truncate text-center text-2xl font-semibold lg:mx-0 lg:text-left">
            {badge.name}
          </h1>
          <div className="text-muted">Max Level: {badge.maxLevel}</div>
        </div>
      </div>
      <BetaNotice>This page is under construction.</BetaNotice>

      <Suspense>
        <Leaderboard badgeId={badge.id} />
      </Suspense>
    </>
  );
}
