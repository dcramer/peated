import type { Outputs } from "@peated/server/orpc/router";
import AdvancedRatingDisplay from "@peated/web/components/advancedRatingDisplay";
import BottleIdentity from "@peated/web/components/bottleIdentity";
import BottleRatingSummary from "@peated/web/components/bottleRatingSummary";
import PaginationButtons from "@peated/web/components/paginationButtons";
import { type ReactNode, Suspense } from "react";

type BottleGroupBottleList = Outputs["bottleGroups"]["bottles"];
type BottleGroup = Outputs["bottleGroups"]["details"];

export default function ReleaseFamilyView({
  bottleList,
  currentBottleId,
  group,
}: {
  bottleList: BottleGroupBottleList;
  currentBottleId: number;
  group: BottleGroup;
}) {
  return (
    <ReleaseFamilyContent
      bottleList={bottleList}
      currentBottleId={currentBottleId}
      group={group}
      pagination={
        <Suspense>
          <PaginationButtons
            rel={bottleList.rel}
            ariaLabel="Release pagination"
          />
        </Suspense>
      }
    />
  );
}

export function ReleaseFamilyContent({
  bottleList,
  currentBottleId,
  group,
  pagination,
}: {
  bottleList: BottleGroupBottleList;
  currentBottleId: number;
  group?: BottleGroup;
  pagination?: ReactNode;
}) {
  return (
    <div className="mt-6 px-3 lg:px-0">
      <section aria-labelledby="releases-heading">
        <h2 id="releases-heading" className="sr-only">
          Releases
        </h2>

        {group && group.avgScore !== null && group.totalScores > 0 ? (
          <div className="mb-6 rounded-lg border border-slate-700 bg-slate-900/50 p-4">
            <div className="text-muted text-sm">
              Community score across releases
            </div>
            <div className="mt-1 text-lg">
              <AdvancedRatingDisplay
                score={group.avgScore}
                count={group.totalScores}
                aggregate
              />
            </div>
          </div>
        ) : null}

        {bottleList.results.length ? (
          <ul
            role="list"
            className="divide-y divide-slate-800 border-y border-slate-800"
          >
            {bottleList.results.map((bottle) => (
              <li key={bottle.id} className="py-4">
                <div className="flex min-w-0 items-start gap-3">
                  {bottle.imageUrl ? (
                    <img
                      src={bottle.imageUrl}
                      alt=""
                      className="h-16 w-12 flex-none rounded bg-white object-contain p-1"
                    />
                  ) : null}
                  <div className="min-w-0 flex-auto">
                    <BottleIdentity
                      bottle={bottle}
                      mode="relative"
                      current={bottle.id === currentBottleId}
                    />
                  </div>
                  <div className="w-28 shrink-0 text-right sm:w-36">
                    {bottle.avgScore !== null && bottle.totalScores > 0 ? (
                      <AdvancedRatingDisplay
                        score={bottle.avgScore}
                        count={bottle.totalScores}
                        aggregate
                        showBand={false}
                        className="justify-end text-sm"
                      />
                    ) : null}
                    <BottleRatingSummary
                      avgRating={bottle.avgRating}
                      totalRatings={bottle.ratingStats.total}
                      className="mt-1 w-full"
                    />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted border-y border-slate-800 py-6">
            No releases found.
          </p>
        )}

        {pagination}
      </section>
    </div>
  );
}
