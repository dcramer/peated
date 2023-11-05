import { useOutletContext } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import { Fragment } from "react";

import type { Bottle } from "@peated/shared/types";
import RobotImage from "~/assets/robot.png";
import { ClientOnly } from "~/components/clientOnly";
import { DistributionChart } from "~/components/distributionChart";
import Markdown from "~/components/markdown";
import QueryBoundary from "~/components/queryBoundary";
import useApi from "~/hooks/useApi";
import { fetchBottleTags } from "~/queries/bottles";

const BottleTagDistribution = ({ bottleId }: { bottleId: number }) => {
  const api = useApi();

  const { data } = useQuery(["bottles", bottleId, "tags"], () =>
    fetchBottleTags(api, bottleId),
  );

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
      <div className="my-6">
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

      {bottle.description && (
        <div className="my-6">
          <div className="flex space-x-4">
            <div className="prose prose-invert -mt-5 max-w-none flex-1">
              <Markdown content={bottle.description} />
            </div>
            <img src={RobotImage} className="hidden h-40 w-40 sm:block" />
          </div>
          {bottle.tastingNotes && (
            <>
              <h3 className="text-highlight text-lg font-bold">
                Tasting Notes
              </h3>
              <div className="prose prose-invert max-w-none flex-1">
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
