"use client";

import BadgeImage from "@peated/web/components/badgeImage";
import Link from "@peated/web/components/link";
import { trpc } from "@peated/web/lib/trpc/client";

export function UserBadgeList({ userId }: { userId: number }) {
  const [awardList] = trpc.userBadgeList.useSuspenseQuery({
    user: userId,
  });

  if (!awardList.results) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {awardList.results.map((award) => {
        return (
          <li
            key={award.id}
            title={award.badge.name}
            className="group relative flex flex-col items-center gap-y-1 rounded p-1 text-sm hover:bg-slate-800"
          >
            <Link
              href={`/badges/${award.badge.id}`}
              className="absolute inset-0"
            />
            <BadgeImage badge={award.badge} />
            <div className="text-muted text-xs">Level {award.level}</div>
          </li>
        );
      })}
    </ul>
  );
}
