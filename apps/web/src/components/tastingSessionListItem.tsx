"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/20/solid";
import type { ActivityTastingSessionEntry } from "@peated/server/types";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { profileActivityQueryKeys } from "../lib/activityQueryKeys";
import { useORPC } from "../lib/orpc/context";
import Link from "./link";
import TastingListItem, { TastingContent } from "./tastingListItem";
import TimeSince from "./timeSince";
import UserAvatar from "./userAvatar";

const carouselButtonClassName =
  "inline-flex h-10 w-10 items-center justify-center border border-slate-700 bg-slate-900 text-white transition-colors hover:bg-slate-800 focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated disabled:cursor-default disabled:text-slate-600";

export default function TastingSessionListItem({
  session,
}: {
  session: ActivityTastingSessionEntry;
}) {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const [activeIndex, setActiveIndex] = useState(0);
  const [deletedTastingIds, setDeletedTastingIds] = useState<number[]>([]);
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  const visibleTastings = session.tastings.filter(
    (tasting) => !deletedTastingIds.includes(tasting.id),
  );

  const refreshActivity = () => {
    void Promise.all([
      queryClient.invalidateQueries({
        // Every activity filter can contain this tasting.
        // oxlint-disable-next-line @tanstack/query/prefer-query-options
        queryKey: orpc.activity.list.key({ type: "query" }),
      }),
      queryClient.invalidateQueries({ queryKey: profileActivityQueryKeys.all }),
    ]);
  };

  const deleteTasting = (tastingId: number) => {
    const remainingCount = visibleTastings.length - 1;
    setDeletedTastingIds((ids) => [...ids, tastingId]);
    setActiveIndex((index) => Math.min(index, Math.max(remainingCount - 1, 0)));
    refreshActivity();
  };

  if (!visibleTastings.length) return null;

  if (visibleTastings.length === 1) {
    return (
      <TastingListItem
        tasting={visibleTastings[0]!}
        onDelete={(tasting) => deleteTasting(tasting.id)}
        onToast={refreshActivity}
      />
    );
  }

  const currentIndex = Math.min(activeIndex, visibleTastings.length - 1);
  const activeTasting = visibleTastings[currentIndex]!;
  const latestVisibleTasting = visibleTastings[0]!;
  const showPrevious = currentIndex > 0;
  const showNext = currentIndex < visibleTastings.length - 1;

  const move = (direction: -1 | 1) => {
    setActiveIndex((index) =>
      Math.max(0, Math.min(index + direction, visibleTastings.length - 1)),
    );
  };

  return (
    <li className="-mt-1 overflow-hidden border border-slate-800 bg-gradient-to-r from-slate-950 to-slate-900">
      <section
        aria-label={`${session.createdBy.username}'s tasting session`}
        aria-roledescription="carousel"
      >
        <div className="flex items-center gap-x-3 border-b border-slate-800 px-3 py-3 lg:px-5">
          <UserAvatar size={32} user={session.createdBy} />
          <div className="min-w-0 flex-1">
            <Link
              href={`/users/${session.createdBy.username}`}
              className="block truncate text-sm font-semibold text-white hover:underline"
            >
              {session.createdBy.username}
            </Link>
            <div className="text-muted flex items-center gap-x-1 text-xs">
              <span>
                {visibleTastings.length.toLocaleString()} tasting
                {visibleTastings.length === 1 ? "" : "s"}
              </span>
              <span aria-hidden="true">·</span>
              <TimeSince date={latestVisibleTasting.createdAt} />
            </div>
          </div>

          <div
            className="flex shrink-0 items-center"
            role="group"
            aria-label="Choose tasting"
          >
            <button
              type="button"
              className={`${carouselButtonClassName} rounded-l-full`}
              aria-label="Previous tasting"
              disabled={!showPrevious}
              onClick={() => move(-1)}
            >
              <ChevronLeftIcon className="h-5 w-5" aria-hidden="true" />
            </button>
            <div
              className="flex h-10 min-w-12 items-center justify-center border-y border-slate-700 bg-slate-900 px-2 text-xs font-semibold tabular-nums text-white"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="sr-only">
                Showing {activeTasting.bottle.fullName}, tasting
              </span>{" "}
              {currentIndex + 1}/{visibleTastings.length}
            </div>
            <button
              type="button"
              className={`${carouselButtonClassName} rounded-r-full`}
              aria-label="Next tasting"
              disabled={!showNext}
              onClick={() => move(1)}
            >
              <ChevronRightIcon className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div
          data-testid="tasting-session-slides"
          className="touch-pan-y"
          onTouchStart={(event) => {
            const touch = event.touches[0];
            if (touch) {
              touchStart.current = { x: touch.clientX, y: touch.clientY };
            }
          }}
          onTouchEnd={(event) => {
            const start = touchStart.current;
            const touch = event.changedTouches[0];
            touchStart.current = null;
            if (!start || !touch) return;

            const deltaX = touch.clientX - start.x;
            const deltaY = touch.clientY - start.y;
            if (Math.abs(deltaX) < 50 || Math.abs(deltaX) <= Math.abs(deltaY)) {
              return;
            }
            move(deltaX < 0 ? 1 : -1);
          }}
          onTouchCancel={() => {
            touchStart.current = null;
          }}
        >
          {visibleTastings.map((tasting, index) => (
            <article
              key={tasting.id}
              hidden={index !== currentIndex}
              role="group"
              aria-roledescription="slide"
              aria-label={`Tasting ${index + 1} of ${visibleTastings.length}`}
              className={
                index === currentIndex
                  ? "flex flex-col gap-y-4 pt-3 lg:pt-4"
                  : "hidden"
              }
            >
              <TastingContent
                tasting={tasting}
                onDelete={(deletedTasting) => deleteTasting(deletedTasting.id)}
                onToast={refreshActivity}
              />
            </article>
          ))}
        </div>
      </section>
    </li>
  );
}
