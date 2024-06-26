"use client";

import EmptyActivity from "@peated/web/components/emptyActivity";
import PaginationButtons from "@peated/web/components/paginationButtons";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc";
import FriendListItem from "./friendListItem";

export default function Page() {
  useAuthRequired();

  const [friendList] = trpc.friendList.useSuspenseQuery();

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
