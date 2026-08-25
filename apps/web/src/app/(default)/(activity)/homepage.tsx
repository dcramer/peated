"use client";

import Button from "@peated/web/components/button";
import { Suspense } from "react";
import HomepageBottleShelf, {
  HomepageBottleShelfSkeleton,
} from "./homepageBottleShelf";
import HomepageSearch from "./homepageSearch";
import HomepageTastings, { HomepageTastingsSkeleton } from "./homepageTastings";
import RecentReviews, { RecentReviewsSkeleton } from "./recentReviews";

export default function Homepage({
  isAuthenticated,
}: {
  isAuthenticated: boolean;
}) {
  return (
    <div className="-mt-4 space-y-0 px-3 pb-10 sm:space-y-12 sm:px-5 sm:pb-12 lg:mt-0 lg:space-y-12 lg:px-0 lg:pb-20">
      <div>
        <section className="-mx-3 overflow-hidden bg-slate-950 sm:relative sm:isolate sm:mx-0 sm:min-h-80">
          <div className="hidden overflow-hidden sm:absolute sm:inset-y-0 sm:right-0 sm:block sm:w-[64%]">
            <img
              src="/assets/homepage-onboarding-illustration.webp"
              alt=""
              className="h-full w-full object-cover object-center opacity-80"
            />
            <div
              className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/55 to-slate-950/15"
              aria-hidden="true"
            />
          </div>
          <div className="relative bg-slate-950 px-5 py-5 sm:flex sm:min-h-80 sm:max-w-2xl sm:flex-col sm:justify-center sm:bg-transparent sm:px-10 sm:py-10 lg:px-14">
            <h1 className="max-w-xl text-[2rem] font-semibold leading-[1.04] tracking-[-0.035em] text-white sm:text-5xl lg:text-6xl">
              Have a dram.
            </h1>
            <p className="mt-5 hidden max-w-lg text-lg leading-7 text-slate-300 sm:block">
              Peated brings together bottle and producer data, independent
              reviews, and community tastings from across the whisky world.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 sm:mt-7 sm:gap-3">
              <Button color="highlight" href="/bottles">
                Browse bottles
              </Button>
              <Button href={isAuthenticated ? "/addTasting" : "/register"}>
                {isAuthenticated ? "Record a tasting" : "Join Peated"}
              </Button>
            </div>
          </div>
        </section>

        <HomepageSearch />
      </div>

      <section
        aria-label="Recent reviews"
        className="-mx-3 pt-6 has-[.homepage-empty]:hidden sm:mx-0 sm:pt-0"
      >
        <Suspense fallback={<RecentReviewsSkeleton />}>
          <RecentReviews />
        </Suspense>
      </section>

      <section aria-labelledby="community-heading">
        <Suspense fallback={<HomepageTastingsSkeleton />}>
          <HomepageTastings />
        </Suspense>
      </section>

      <Suspense fallback={<HomepageBottleShelfSkeleton />}>
        <HomepageBottleShelf />
      </Suspense>
    </div>
  );
}
