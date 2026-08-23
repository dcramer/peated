import type { Outputs } from "@peated/server/orpc/router";
import BottleIdentity from "@peated/web/components/bottleIdentity";
import BottleRatingSummary from "@peated/web/components/bottleRatingSummary";
import PaginationButtons from "@peated/web/components/paginationButtons";
import { type ReactNode, Suspense } from "react";

type BottleGroupBottleList = Outputs["bottleGroups"]["bottles"];

export default function ReleaseFamilyView({
  bottleList,
  currentBottleId,
}: {
  bottleList: BottleGroupBottleList;
  currentBottleId: number;
}) {
  return (
    <ReleaseFamilyContent
      bottleList={bottleList}
      currentBottleId={currentBottleId}
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
  pagination,
}: {
  bottleList: BottleGroupBottleList;
  currentBottleId: number;
  pagination?: ReactNode;
}) {
  return (
    <div className="mt-6 px-3 lg:px-0">
      <section aria-labelledby="releases-heading">
        <h2 id="releases-heading" className="sr-only">
          Releases
        </h2>

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
                  <BottleRatingSummary
                    avgRating={bottle.avgRating}
                    totalRatings={bottle.ratingStats.total}
                    className="w-20 sm:w-24"
                  />
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
