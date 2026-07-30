"use client";

import type { Outputs } from "@peated/server/orpc/router";
import BadgeImage from "@peated/web/components/badgeImage";
import Link from "@peated/web/components/link";
import classNames from "@peated/web/lib/classNames";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";

type BadgeAward = Outputs["users"]["badgeList"]["results"][number];

const INITIAL_BADGE_COUNT = 8;

export function UserBadgeAwards({ awards }: { awards: BadgeAward[] }) {
  const [showAll, setShowAll] = useState(false);
  const earnedAwards = awards.filter((award) => award.level > 0);

  if (!earnedAwards.length) return null;

  const visibleAwards = showAll
    ? earnedAwards
    : earnedAwards.slice(0, INITIAL_BADGE_COUNT);
  const hiddenCount = earnedAwards.length - INITIAL_BADGE_COUNT;

  return (
    <section aria-labelledby="achievements-heading">
      <div className="mb-3 flex items-start justify-between gap-4">
        <div>
          <h2
            id="achievements-heading"
            className="text-lg font-semibold text-white"
          >
            Achievements
          </h2>
          <p className="text-muted mt-1 text-sm">
            Milestones earned through their tastings.
          </p>
        </div>
        {hiddenCount > 0 ? (
          <button
            type="button"
            className={classNames(
              "text-muted hover:text-highlight mt-1 shrink-0 text-sm",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400",
            )}
            onClick={() => setShowAll((value) => !value)}
            aria-expanded={showAll}
          >
            {showAll ? "Show fewer" : `Show all ${earnedAwards.length}`}
          </button>
        ) : null}
      </div>
      <ul className="scrollbar-none grid auto-cols-[6.5rem] grid-flow-col gap-2 overflow-x-auto pb-1 lg:grid-flow-row lg:grid-cols-[repeat(auto-fill,minmax(6.5rem,1fr))] lg:overflow-visible">
        {visibleAwards.map((award) => (
          <li key={award.id}>
            <Link
              href={`/badges/${award.badge.id}`}
              className="group flex h-full flex-col items-center rounded border border-slate-800 bg-slate-950/50 p-2 text-center transition hover:border-slate-700 hover:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
              aria-label={`${award.badge.name}, level ${award.level.toLocaleString()}`}
            >
              <BadgeImage badge={award.badge} level={award.level} />
              <span className="mt-2 line-clamp-2 min-h-8 text-xs leading-4 text-slate-200">
                {award.badge.name}
              </span>
              <span className="text-muted mt-1 text-[11px]">
                Level {award.level}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function UserBadgeList({ userId }: { userId: number }) {
  const orpc = useORPC();
  const { data: awardList } = useSuspenseQuery(
    orpc.users.badgeList.queryOptions({
      input: {
        user: userId,
      },
    }),
  );

  return <UserBadgeAwards awards={awardList.results} />;
}
