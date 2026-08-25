"use client";

import { ArrowTopRightOnSquareIcon } from "@heroicons/react/20/solid";
import type { Outputs } from "@peated/server/orpc/router";
import CarouselControls from "@peated/web/components/carouselControls";
import Link from "@peated/web/components/link";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";

type Review = Outputs["reviews"]["recent"]["results"][number];
type ReviewGroup = { bottle: NonNullable<Review["bottle"]>; reviews: Review[] };

const publicationDateFormatter = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeZone: "UTC",
});

function groupByBottle(reviews: Review[]) {
  const groups = new Map<number, ReviewGroup>();
  for (const review of reviews) {
    if (!review.bottle || !review.site) continue;
    const group = groups.get(review.bottle.id);
    if (group) {
      group.reviews.push(review);
    } else {
      groups.set(review.bottle.id, {
        bottle: review.bottle,
        reviews: [review],
      });
    }
  }
  return Array.from(groups.values()).slice(0, 6);
}

function ReviewDetails({ review }: { review: Review }) {
  const site = review.site!;
  return (
    <div className="border-t border-slate-700/70 pt-3 first:border-0 first:pt-0">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">
            {site.name}
          </p>
          {review.reviewerName || review.article.publishedAt ? (
            <p className="text-muted mt-1 text-xs">
              {review.reviewerName ? review.reviewerName : null}
              {review.reviewerName && review.article.publishedAt ? " · " : null}
              {review.article.publishedAt ? (
                <time dateTime={review.article.publishedAt}>
                  {publicationDateFormatter.format(
                    new Date(review.article.publishedAt),
                  )}
                </time>
              ) : null}
            </p>
          ) : null}
        </div>
        {review.nativeScore ? (
          <span className="text-highlight shrink-0 text-lg font-semibold tabular-nums">
            {review.nativeScore.display}
          </span>
        ) : null}
      </div>
      {review.summary ? (
        <p className="mt-3 line-clamp-2 max-w-3xl text-sm leading-6 text-slate-300 sm:line-clamp-3">
          {review.summary}
        </p>
      ) : null}
      <a
        href={review.url}
        className="text-highlight mt-3 inline-flex items-center gap-1 text-sm font-semibold hover:underline"
      >
        Read on {site.name}
        <ArrowTopRightOnSquareIcon className="h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  );
}

export function RecentReviewsSkeleton() {
  return (
    <div className="h-[23rem] animate-pulse border-b border-slate-700/50 bg-slate-800/20 sm:h-80" />
  );
}

export default function RecentReviews() {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.reviews.recent.queryOptions({ input: { limit: 24 } }),
  );
  const groups = groupByBottle(data.results);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  if (!groups.length) return <span className="homepage-empty hidden" />;

  const currentIndex = Math.min(activeIndex, groups.length - 1);
  const group = groups[currentIndex]!;
  const move = (direction: -1 | 1) => {
    setActiveIndex(
      (index) => (index + direction + groups.length) % groups.length,
    );
  };

  return (
    <div
      className="relative overflow-hidden border-b border-slate-700/50"
      role="region"
      aria-roledescription="carousel"
      aria-label="Review carousel"
      onTouchStart={(event) => {
        const touch = event.touches[0];
        if (touch) touchStart.current = { x: touch.clientX, y: touch.clientY };
      }}
      onTouchEnd={(event) => {
        const start = touchStart.current;
        const touch = event.changedTouches[0];
        touchStart.current = null;
        if (!start || !touch) return;
        const deltaX = touch.clientX - start.x;
        const deltaY = touch.clientY - start.y;
        if (Math.abs(deltaX) >= 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
          move(deltaX < 0 ? 1 : -1);
        }
      }}
      onTouchCancel={() => {
        touchStart.current = null;
      }}
    >
      <div className="absolute right-3 top-0 z-10 sm:right-0">
        <CarouselControls
          currentIndex={currentIndex}
          total={groups.length}
          previousLabel="Previous review"
          nextLabel="Next review"
          onPrevious={() => move(-1)}
          onNext={() => move(1)}
        />
      </div>
      <article
        className="sm:min-h-72"
        role="group"
        aria-roledescription="slide"
        aria-label={`${currentIndex + 1} of ${groups.length}`}
      >
        <div className="flex min-w-0 flex-col justify-between px-3 pb-5 sm:min-h-72 sm:px-0 sm:pb-8 lg:pb-10">
          <div className="pr-32 sm:pr-0">
            <Link
              href={`/bottles/${group.bottle.id}`}
              className="block max-w-3xl text-2xl font-semibold leading-tight tracking-tight text-white hover:text-amber-300 sm:text-3xl lg:text-4xl"
            >
              {group.bottle.fullName}
            </Link>
          </div>
          <div className="mt-6 space-y-4 sm:mt-8">
            {group.reviews.slice(0, 2).map((review, index) => (
              <div
                key={review.id}
                className={index === 1 ? "hidden sm:block" : ""}
              >
                <ReviewDetails review={review} />
              </div>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
