import { makeTRPCClient } from "@peated/server/lib/trpc";
import type { Bottle } from "@peated/server/types";
import config from "@peated/web/config";
import { useOutletContext } from "@remix-run/react";
import { captureException } from "@sentry/remix";
import { type SitemapFunction } from "remix-sitemap";
import BottleOverview from "../components/bottleOverview";

export const sitemap: SitemapFunction = async ({
  config: sitemapConfig,
  request,
}) => {
  const trpcClient = makeTRPCClient(config.API_SERVER, null, captureException);

  let cursor: number | null = 1;
  const output = [];
  while (cursor) {
    const { results, rel } = await trpcClient.bottleList.query({
      cursor,
    });

    output.push(
      ...results.map((bottle) => ({
        loc: `/bottles/${bottle.id}`,
        lastmod: bottle.createdAt, // not correct
      })),
    );

    cursor = rel?.nextCursor || null;
  }
  return output;
};

export default function BottleDetails() {
  const { bottle } = useOutletContext<{ bottle: Bottle }>();
  return <BottleOverview bottle={bottle} />;
}
