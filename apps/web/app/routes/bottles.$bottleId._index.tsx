import { makeTRPCClient } from "@peated/server/lib/trpc";
import type { Bottle } from "@peated/server/types";
import RobotImage from "@peated/web/assets/robot.png";
import { ClientOnly } from "@peated/web/components/clientOnly";
import { DistributionChart } from "@peated/web/components/distributionChart";
import Markdown from "@peated/web/components/markdown";
import QueryBoundary from "@peated/web/components/queryBoundary";
import config from "@peated/web/config";
import { trpc } from "@peated/web/lib/trpc";
import { useOutletContext } from "@remix-run/react";
import { captureException } from "@sentry/remix";
import { Fragment } from "react";
import { type SitemapFunction } from "remix-sitemap";

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

const BottleTagDistribution = ({ bottleId }: { bottleId: number }) => {
  const { data } = trpc.bottleTagList.useQuery({
    bottle: bottleId,
  });

  if (!data) return null;

  const { results, totalCount } = data;

  if (!results.length) return null;

  return (
    <DistributionChart
      items={results.map((t) => ({
        name: t.tag,
        count: t.count,
        tag: t.tag,
      }))}
      totalCount={totalCount}
      to={(item) => `/bottles?tag=${encodeURIComponent(item.name)}`}
    />
  );
};

export default function BottleDetails() {
  const { bottle } = useOutletContext<{ bottle: Bottle }>();

  return (
    <>
      <div className="my-6 px-3 md:px-0">
        <ClientOnly
          fallback={
            <div
              className="animate-pulse bg-slate-800"
              style={{ height: 200 }}
            />
          }
        >
          {() => (
            <QueryBoundary
              fallback={
                <div
                  className="animate-pulse bg-slate-800"
                  style={{ height: 200 }}
                />
              }
              loading={<Fragment />}
            >
              <BottleTagDistribution bottleId={bottle.id} />
            </QueryBoundary>
          )}
        </ClientOnly>
      </div>

      {(bottle.description || bottle.tastingNotes) && (
        <div className="my-6 px-3 md:px-0">
          {bottle.description && (
            <div className="flex space-x-4">
              <div className="prose prose-invert -mt-5 max-w-none flex-auto">
                <Markdown content={bottle.description} />
              </div>
              <img src={RobotImage} className="hidden h-40 w-40 sm:block" />
            </div>
          )}
          {bottle.tastingNotes && (
            <>
              <h3 className="text-highlight text-lg font-bold">
                Tasting Notes
              </h3>
              <div className="prose prose-invert max-w-none flex-auto">
                <dl>
                  <dt>Nose</dt>
                  <dd>{bottle.tastingNotes.nose}</dd>
                  <dt>Palate</dt>
                  <dd>{bottle.tastingNotes.palate}</dd>
                  <dt>Finish</dt>
                  <dd>{bottle.tastingNotes.finish}</dd>
                </dl>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
