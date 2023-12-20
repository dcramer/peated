import type { Bottle } from "@peated/server/types";
import RobotImage from "@peated/web/assets/robot.png";
import { Fragment } from "react";
import BottleTagDistribution from "./bottleTagDistribution.client";
import { ClientOnly } from "./clientOnly";
import Markdown from "./markdown";
import QueryBoundary from "./queryBoundary";

export default function BottleOverview({ bottle }: { bottle: Bottle }) {
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
