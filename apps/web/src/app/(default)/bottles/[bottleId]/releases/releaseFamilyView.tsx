import { formatCategoryName } from "@peated/server/lib/format";
import type { Outputs } from "@peated/server/orpc/router";
import BottleExactMetadata from "@peated/web/components/bottleExactMetadata";
import Link from "@peated/web/components/link";
import Markdown from "@peated/web/components/markdown";
import PaginationButtons from "@peated/web/components/paginationButtons";
import SimpleRatingStats from "@peated/web/components/simpleRatingStats";
import { Suspense } from "react";

type BottleGroupPresentation = Outputs["bottleGroups"]["details"]["group"];
type BottleGroupBottleList = Outputs["bottleGroups"]["bottles"];

export default function ReleaseFamilyView({
  group,
  bottleList,
}: {
  group: BottleGroupPresentation;
  bottleList: BottleGroupBottleList;
}) {
  return (
    <div className="px-3 lg:px-0">
      <header className="my-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0">
          <p className="text-highlight text-sm font-semibold uppercase tracking-wide">
            Similar bottles
          </p>
          <h1 className="mt-1 break-words text-3xl font-semibold leading-tight sm:text-4xl">
            {group.fullName}
          </h1>
          <p className="text-muted mt-3 max-w-2xl">
            Explore related releases of this bottle. Each has its own details,
            tastings, and Library entry.
          </p>
          <div className="text-muted mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {group.category ? (
              <span>{formatCategoryName(group.category)}</span>
            ) : null}
            {group.statedAge !== null ? (
              <span>{group.statedAge} years</span>
            ) : null}
          </div>
        </div>

        {group.imageUrl ? (
          <div className="flex justify-center rounded border border-slate-800 bg-white p-3 lg:justify-self-end">
            <img
              src={group.imageUrl}
              alt={group.fullName}
              className="max-h-64 max-w-full object-contain"
            />
          </div>
        ) : null}
      </header>

      <section aria-labelledby="group-statistics-heading" className="my-8">
        <h2 id="group-statistics-heading" className="sr-only">
          Similar bottle statistics
        </h2>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-muted text-sm">Tastings</dt>
            <dd className="mt-1 text-3xl font-semibold">
              {group.totalTastings.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-sm">Similar bottles</dt>
            <dd className="mt-1 text-3xl font-semibold">
              {group.totalBottles.toLocaleString()}
            </dd>
          </div>
          <div>
            <dt className="text-muted text-sm">Ratings</dt>
            <dd className="mt-1 text-3xl font-semibold">
              {group.ratingStats.total.toLocaleString()}
            </dd>
          </div>
        </dl>
      </section>

      {(group.description || group.ratingStats.total > 0) && (
        <div
          className={
            group.description && group.ratingStats.total > 0
              ? "my-8 grid gap-8 lg:grid-cols-2"
              : "my-8"
          }
        >
          {group.description ? (
            <section aria-labelledby="about-release-family-heading">
              <h2
                id="about-release-family-heading"
                className="text-highlight mb-3 text-lg font-bold"
              >
                About these bottles
              </h2>
              <div className="prose prose-invert max-w-none">
                <Markdown content={group.description} />
              </div>
            </section>
          ) : null}
          {group.ratingStats.total > 0 ? (
            <section aria-labelledby="aggregate-ratings-heading">
              <h2
                id="aggregate-ratings-heading"
                className="text-highlight mb-3 text-lg font-bold"
              >
                Combined ratings
              </h2>
              <SimpleRatingStats stats={group.ratingStats} />
            </section>
          ) : null}
        </div>
      )}

      <section aria-labelledby="related-releases-heading" className="my-8">
        <div className="mb-4">
          <h2
            id="related-releases-heading"
            className="text-highlight text-lg font-bold"
          >
            Other releases
          </h2>
          <p className="text-muted mt-1 text-sm">
            Choose a bottle to see its details, tastings, and prices.
          </p>
        </div>

        {bottleList.results.length ? (
          <ul
            role="list"
            className="divide-y divide-slate-800 border-y border-slate-800"
          >
            {bottleList.results.map(({ targetId, bottle }) => (
              <li key={targetId} className="py-4">
                <div className="flex min-w-0 items-start gap-4">
                  {bottle.imageUrl ? (
                    <img
                      src={bottle.imageUrl}
                      alt=""
                      className="h-16 w-12 flex-none rounded bg-white object-contain p-1"
                    />
                  ) : null}
                  <div className="min-w-0 flex-auto">
                    <Link
                      href={`/bottles/${bottle.id}`}
                      className="break-words font-semibold hover:underline"
                    >
                      {bottle.fullName}
                    </Link>
                    <BottleExactMetadata bottle={bottle} />
                  </div>
                  <div className="text-muted hidden flex-none text-right text-sm sm:block">
                    {bottle.totalTastings.toLocaleString()}{" "}
                    {bottle.totalTastings === 1 ? "tasting" : "tastings"}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted border-y border-slate-800 py-6">
            No other releases found.
          </p>
        )}

        <Suspense>
          <PaginationButtons
            rel={bottleList.rel}
            ariaLabel="Other release pagination"
          />
        </Suspense>
      </section>
    </div>
  );
}
