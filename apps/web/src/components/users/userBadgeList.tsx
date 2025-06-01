"use client";

import BadgeImage from "@peated/web/components/badgeImage";
import { Link } from "@tanstack/react-router";
import classNames from "@peated/web/lib/classNames";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export function UserBadgeList({ userId }: { userId: number }) {
  const orpc = useORPC();
  const { data: awardList } = useSuspenseQuery(
    orpc.users.badgeList.queryOptions({
      input: {
        user: userId,
      },
    })
  );

  if (!awardList.results) return null;

  return (
    <div className="flex justify-center lg:justify-start">
      <ul className="scrollbar-none flex gap-2 overflow-x-scroll lg:flex-wrap lg:overflow-x-auto">
        {awardList.results.map((award) => {
          return (
            <li
              key={award.id}
              title={award.badge.name}
              className={classNames(
                "group relative flex flex-shrink-0 flex-col items-center gap-y-1 rounded p-1 text-sm hover:bg-slate-800",
                award.level === 0 ? "grayscale" : ""
              )}
            >
              <Link
                to="/badges/$badgeId"
                params={{ badgeId: String(award.badge.id) }}
                className="absolute inset-0"
              />
              <BadgeImage badge={award.badge} level={award.level} />
              <div className="text-muted text-xs">
                {award.level > 0 ? (
                  <>Level {award.level}</>
                ) : (
                  <em>Discovered</em>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
