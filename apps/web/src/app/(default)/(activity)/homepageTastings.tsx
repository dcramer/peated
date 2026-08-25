"use client";

import type { Outputs } from "@peated/server/orpc/router";
import ActivityList from "@peated/web/components/activityList";
import CarouselControls from "@peated/web/components/carouselControls";
import Link from "@peated/web/components/link";
import Markdown from "@peated/web/components/markdown";
import SimpleRatingDisplay from "@peated/web/components/simpleRatingDisplay";
import TimeSince from "@peated/web/components/timeSince";
import UserAvatar from "@peated/web/components/userAvatar";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import HomepageSectionHeading from "./homepageSectionHeading";

type Activity = Outputs["activity"]["list"]["results"][number];
type TastingSession = Extract<Activity, { type: "tasting_session" }>;

type TastingSlide = {
  id: number;
  session: TastingSession;
};

type HomepageTasting = TastingSlide["session"]["tastings"][number];

function CompactTastingCard({ tasting }: { tasting: HomepageTasting }) {
  const imageUrl = tasting.imageUrl ?? tasting.bottle.imageUrl;

  return (
    <article className="grid h-full min-h-0 grid-cols-[minmax(0,1fr)_7.5rem] overflow-hidden border border-slate-800 bg-slate-950/70">
      <div className="flex min-w-0 flex-col p-5">
        <div className="flex items-center gap-2.5 text-sm">
          <UserAvatar size={28} user={tasting.createdBy} />
          <Link
            href={`/users/${tasting.createdBy.username}`}
            className="min-w-0 truncate font-semibold text-white hover:underline"
          >
            {tasting.createdBy.username}
          </Link>
          <Link
            href={`/tastings/${tasting.id}`}
            className="text-muted ml-auto shrink-0 hover:text-white"
          >
            <TimeSince date={tasting.createdAt} />
          </Link>
        </div>

        <Link
          href={`/bottles/${tasting.bottle.id}`}
          className="mt-4 line-clamp-2 text-lg font-semibold leading-6 text-white hover:text-amber-300"
        >
          {tasting.bottle.fullName}
        </Link>

        {tasting.notes ? (
          <div className="prose prose-invert prose-p:my-0 mt-2 line-clamp-3 max-w-none text-sm leading-5 text-slate-300">
            <Markdown content={tasting.notes} noLinks />
          </div>
        ) : null}

        <div className="text-muted mt-auto flex min-h-5 items-end gap-3 pt-4 text-xs">
          {tasting.rating ? (
            <SimpleRatingDisplay
              value={tasting.rating}
              size="small"
              showLabel
            />
          ) : null}
          {tasting.tags.length ? (
            <span className="truncate">
              {tasting.tags.slice(0, 3).join(" · ")}
            </span>
          ) : null}
        </div>
      </div>

      <Link
        href={`/tastings/${tasting.id}`}
        className="flex min-h-0 items-center justify-center border-l border-slate-800 bg-slate-900/70 p-3"
        aria-label={`View ${tasting.createdBy.username}'s tasting of ${tasting.bottle.fullName}`}
      >
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            className={
              tasting.imageUrl
                ? "h-full w-full object-cover"
                : "h-full max-h-40 w-full object-contain"
            }
          />
        ) : (
          <span className="line-clamp-3 text-center text-xl font-black leading-none tracking-[-0.05em] text-slate-700">
            {tasting.bottle.brand.shortName || tasting.bottle.brand.name}
          </span>
        )}
      </Link>
    </article>
  );
}

function getTastingSlides(results: Activity[]) {
  return results
    .filter(
      (activity): activity is TastingSession =>
        activity.type === "tasting_session",
    )
    .flatMap((session) =>
      session.tastings.map(
        (tasting): TastingSlide => ({
          id: tasting.id,
          session: {
            ...session,
            id: `homepage_tasting:${tasting.id}`,
            startedAt: tasting.createdAt,
            lastActivityAt: tasting.createdAt,
            tastings: [tasting],
          },
        }),
      ),
    )
    .sort(
      (left, right) =>
        new Date(right.session.lastActivityAt).getTime() -
        new Date(left.session.lastActivityAt).getTime(),
    );
}

export function HomepageTastingsSkeleton() {
  return (
    <>
      <HomepageSectionHeading
        id="community-heading"
        title="What people are pouring"
        href="/tastings"
        linkLabel="All tastings"
        artwork="/assets/empty-tastings-illustration.webp"
      />
      <div className="-mx-3 sm:mx-0 lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(20rem,5fr)] lg:gap-5">
        <div className="h-72 animate-pulse bg-slate-800/70 lg:h-[30rem]" />
        <div className="hidden grid-rows-2 gap-4 lg:grid">
          <div className="animate-pulse bg-slate-800/70" />
          <div className="animate-pulse bg-slate-800/70" />
        </div>
      </div>
    </>
  );
}

export default function HomepageTastings() {
  const orpc = useORPC();
  const { data } = useSuspenseQuery(
    orpc.activity.list.queryOptions({
      input: { filter: "global", limit: 10 },
    }),
  );
  const slides = getTastingSlides(data.results);
  const [activeIndex, setActiveIndex] = useState(0);
  const touchStart = useRef<{ x: number; y: number } | null>(null);

  if (!slides.length) {
    return (
      <>
        <HomepageSectionHeading
          id="community-heading"
          title="What people are pouring"
          artwork="/assets/empty-tastings-illustration.webp"
        />
        <div className="relative -mx-3 min-h-64 overflow-hidden bg-slate-950 px-6 py-10 sm:mx-0 sm:px-10">
          <img
            src="/assets/empty-tastings-illustration.webp"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-slate-950/75" />
          <div className="relative max-w-sm">
            <h3 className="text-xl font-semibold">Start the conversation.</h3>
            <p className="text-muted mt-2 leading-6">
              Add a tasting note and help other drinkers find their next pour.
            </p>
            <Link
              href="/addTasting"
              className="text-highlight mt-5 inline-block font-semibold hover:underline"
            >
              Record a tasting
            </Link>
          </div>
        </div>
      </>
    );
  }

  const currentIndex = Math.min(activeIndex, slides.length - 1);
  const currentSlide = slides[currentIndex]!;
  const supportingSlides = [1, 2]
    .filter((offset) => offset < slides.length)
    .map((offset) => slides[(currentIndex + offset) % slides.length]!);
  const move = (direction: -1 | 1) => {
    setActiveIndex(
      (index) => (index + direction + slides.length) % slides.length,
    );
  };

  return (
    <>
      <HomepageSectionHeading
        id="community-heading"
        title="What people are pouring"
        href="/tastings"
        linkLabel="All tastings"
        artwork="/assets/empty-tastings-illustration.webp"
        actions={
          <CarouselControls
            currentIndex={currentIndex}
            total={slides.length}
            previousLabel="Previous tasting"
            nextLabel="Next tasting"
            onPrevious={() => move(-1)}
            onNext={() => move(1)}
          />
        }
      />
      <div
        className="-mx-3 touch-pan-y [--tasting-image-height:190px] sm:mx-0 sm:[--tasting-image-height:250px] lg:grid lg:grid-cols-[minmax(0,7fr)_minmax(20rem,5fr)] lg:gap-5 [&>div>ul>li]:border-x-0 sm:[&>div>ul>li]:border-x [&>div>ul]:mt-0"
        role="region"
        aria-roledescription="carousel"
        aria-label="Recent tastings"
        onTouchStart={(event) => {
          const touch = event.touches[0];
          if (touch)
            touchStart.current = { x: touch.clientX, y: touch.clientY };
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
        <div
          key={currentSlide.id}
          role="group"
          aria-roledescription="slide"
          aria-label={`${currentIndex + 1} of ${slides.length}`}
        >
          <ActivityList values={[currentSlide.session]} />
        </div>

        {supportingSlides.length ? (
          <div
            className={
              supportingSlides.length === 1
                ? "hidden min-h-0 grid-rows-1 gap-4 lg:grid"
                : "hidden min-h-0 grid-rows-2 gap-4 lg:grid"
            }
          >
            {supportingSlides.map((slide) => (
              <CompactTastingCard
                key={slide.id}
                tasting={slide.session.tastings[0]!}
              />
            ))}
          </div>
        ) : null}
      </div>
    </>
  );
}
