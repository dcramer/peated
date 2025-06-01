"use client";

import Link from "@peated/web/components/link";
import UserAvatar from "@peated/web/components/userAvatar";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";

export default function Leaderboard({ badgeId }: { badgeId: number }) {
  const orpc = useORPC();
  const { data: awardList } = useSuspenseQuery(
    orpc.badges.userList.queryOptions({
      input: { badge: badgeId },
    })
  );

  return (
    <ul className="flex flex-col gap-y-2">
      {awardList.results.map((award, index) => {
        const { user } = award;
        return (
          <li
            key={user.id}
            className="group relative flex w-full items-center gap-x-4 rounded px-3 py-1 hover:bg-slate-800"
          >
            <Link
              href={`/users/${user.username}`}
              className="absolute inset-0"
            />
            <div className="font-mono text-2xl text-muted">#{index + 1}</div>
            <UserAvatar user={user} size={36} />
            <div className="flex flex-col">
              <strong>{user.username}</strong>
              <div className="text-muted text-sm">Level {award.level}</div>
            </div>
            <div className="flex-grow text-right text-muted">
              <div className="inline-flex flex-col items-center">
                <div>{award.xp}</div>
                <div className="text-muted text-sm">Points</div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
