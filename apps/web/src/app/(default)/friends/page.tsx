"use client";

import EmptyActivity from "@peated/web/components/emptyActivity";
import PaginationButtons from "@peated/web/components/paginationButtons";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useSuspenseQuery } from "@tanstack/react-query";
import FriendListItem from "./friendListItem";

export const fetchCache = "default-no-store";

export default function Page() {
  useAuthRequired();

  const orpc = useORPC();
  const { data: friendList } = useSuspenseQuery(
    orpc.friends.list.queryOptions({
      input: {},
    }),
  );

  const { results, rel } = friendList;

  return (
    <>
      <ul className="divide-y divide-slate-800 sm:rounded">
        {results.length ? (
          results.map((friend) => {
            return <FriendListItem key={friend.id} friend={friend} />;
          })
        ) : (
          <EmptyActivity>
            {
              "You could definitely use a few more friends. We're not judging or anything."
            }
          </EmptyActivity>
        )}
      </ul>
      <PaginationButtons rel={rel} />
    </>
  );
}
