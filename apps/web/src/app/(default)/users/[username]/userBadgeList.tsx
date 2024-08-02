"use client";

import BadgeImage from "@peated/web/components/badgeImage";
import Link from "@peated/web/components/link";
import classNames from "@peated/web/lib/classNames";
import { trpc } from "@peated/web/lib/trpc/client";

export function UserBadgeList({ userId }: { userId: number }) {
  const [awardList] = trpc.userBadgeList.useSuspenseQuery({
    user: userId,
  });

  if (!awardList.results) return null;

  return (
    <ul className="scrollbar-none flex justify-center gap-2 overflow-x-scroll lg:justify-start">
      {awardList.results.map((award) => {
        return (
          <li
            key={award.id}
            title={award.badge.name}
            className={classNames(
              "group relative flex flex-shrink-0 flex-col items-center gap-y-1 rounded p-1 text-sm hover:bg-slate-800",
              award.level === 0 ? "grayscale" : "",
            )}
          >
            <Link
              href={`/badges/${award.badge.id}`}
              className="absolute inset-0"
            />
            <BadgeImage badge={award.badge} level={award.level} />
            <div className="text-muted text-xs">
              {award.level > 0 ? <>Level {award.level}</> : <em>Discovered</em>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
