"use client";

import { formatCategoryName } from "@peated/server/lib/format";
import Link from "@peated/web/components/link";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import HomepageSectionHeading from "./homepageSectionHeading";

const tastingCountFormatter = new Intl.NumberFormat("en-US");

export function HomepageBottleShelfSkeleton() {
  return (
    <section>
      <HomepageSectionHeading
        title="Popular bottles"
        href="/bottles"
        linkLabel="Browse all bottles"
        artwork="/assets/empty-library-illustration.webp"
      />
      <div className="scrollbar-none grid auto-cols-[10.5rem] grid-flow-col gap-3 overflow-hidden sm:grid-flow-row sm:grid-cols-3 sm:gap-4 lg:grid-cols-5">
        {[0, 1, 2, 3, 4].map((value) => (
          <div key={value} className="h-80 animate-pulse bg-slate-800/70" />
        ))}
      </div>
    </section>
  );
}

export default function HomepageBottleShelf() {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.bottles.list.queryOptions({
      input: { limit: 5, sort: "-tastings" },
    }),
  );

  if (!data.results.length) return null;

  return (
    <section aria-labelledby="popular-bottles-heading">
      <div id="popular-bottles-heading">
        <HomepageSectionHeading
          title="Popular bottles"
          href="/bottles"
          linkLabel="Browse all bottles"
          artwork="/assets/empty-library-illustration.webp"
        />
      </div>
      <ul className="scrollbar-none -mr-3 grid snap-x snap-mandatory auto-cols-[10.5rem] grid-flow-col gap-3 overflow-x-auto overscroll-x-contain pr-3 pt-4 sm:mr-0 sm:grid-flow-row sm:grid-cols-3 sm:gap-4 sm:overflow-visible sm:pr-0 sm:pt-5 lg:grid-cols-5">
        {data.results.map((bottle) => (
          <li key={bottle.id} className="min-w-0 snap-start">
            <Link
              href={`/bottles/${bottle.id}`}
              className="group flex h-full flex-col bg-slate-900/70 transition-colors hover:bg-slate-900"
            >
              <div className="relative flex h-44 items-end justify-center overflow-hidden border-b border-slate-700/60 bg-slate-800/70 px-4 pt-4 sm:h-48 sm:px-5 sm:pt-5">
                {bottle.imageUrl ? (
                  <img
                    src={bottle.imageUrl}
                    alt=""
                    className="h-full w-full object-contain drop-shadow-xl transition-transform duration-300 group-hover:-translate-y-1"
                  />
                ) : (
                  <span className="mb-7 line-clamp-2 max-w-full px-2 text-center text-2xl font-black leading-none tracking-[-0.05em] text-slate-700 transition-colors group-hover:text-amber-400/20 sm:mb-8 sm:px-3 sm:text-4xl">
                    {bottle.brand.shortName || bottle.brand.name}
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-3 sm:p-4">
                <p className="text-muted text-[0.6875rem] font-semibold uppercase tracking-[0.12em] sm:text-xs">
                  {bottle.category
                    ? formatCategoryName(bottle.category)
                    : bottle.brand.name}
                </p>
                <h3 className="mt-1 line-clamp-2 text-sm font-semibold leading-5 text-white group-hover:text-amber-300 sm:text-base sm:leading-6">
                  {bottle.fullName}
                </h3>
                {bottle.totalTastings > 0 ? (
                  <p className="text-muted mt-auto pt-3 text-xs tabular-nums">
                    {tastingCountFormatter.format(bottle.totalTastings)}{" "}
                    {bottle.totalTastings === 1 ? "tasting" : "tastings"}
                  </p>
                ) : null}
              </div>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        href="/bottles"
        className="text-highlight mt-5 inline-block text-sm font-semibold hover:underline sm:hidden"
      >
        Browse all bottles
      </Link>
    </section>
  );
}
