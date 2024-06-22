"use client";

import { AtSymbolIcon } from "@heroicons/react/20/solid";
import type { FriendStatus } from "@peated/server/types";
import Layout from "@peated/web-next/components/layout";
import SimpleHeader from "@peated/web-next/components/simpleHeader";
import Spinner from "@peated/web-next/components/spinner";
import useAuthRequired from "@peated/web-next/hooks/useAuthRequired";
import { trpcClient } from "@peated/web-next/lib/trpc";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import ListItem from "@peated/web/components/listItem";
import PaginationButtons from "@peated/web/components/paginationButtons";
import UserAvatar from "@peated/web/components/userAvatar";
import Link from "next/link";
import { Suspense, useState } from "react";

export default function Page() {
  useAuthRequired();

  const [friendList] = trpcClient.friendList.useSuspenseQuery();

  return (
    <Layout>
      <SimpleHeader>Friends</SimpleHeader>
      <Suspense fallback={<Spinner />}>
        <Content friendList={friendList} />
      </Suspense>
    </Layout>
  );
}

function Content({ friendList }) {
  const [friendStatus, setFriendStatus] = useState<
    Record<string, FriendStatus>
  >(
    Object.fromEntries(
      friendList ? friendList.results.map((r) => [r.user.id, r.status]) : [],
    ),
  );

  const friendCreateMutation = trpcClient.friendCreate.useMutation({
    onSuccess: (status, toUserId) => {
      setFriendStatus((state) => ({
        ...state,
        [toUserId]: status,
      }));
    },
  });
  const friendDeleteMutation = trpcClient.friendDelete.useMutation({
    onSuccess: (status, toUserId) => {
      setFriendStatus((state) => ({
        ...state,
        [toUserId]: status,
      }));
    },
  });

  const actionLabel = (status: FriendStatus) => {
    switch (status) {
      case "friends":
        return "Remove Friend";
      case "pending":
        return "Request Sent";
      case "none":
      default:
        return "Add Friend";
    }
  };

  if (!friendList) return null;

  const { results, rel } = friendList;

  return (
    <>
      <ul className="divide-y divide-slate-800 sm:rounded">
        {results.length ? (
          results.map(({ user, ...friend }) => {
            return (
              <ListItem key={user.id}>
                <div className="flex flex-auto items-center space-x-4">
                  <UserAvatar size={48} user={user} />
                  <div className="flex-auto space-y-1 font-medium">
                    <Link
                      href={`/users/${user.username}`}
                      className="hover:underline"
                    >
                      {user.displayName}
                    </Link>
                    <div className="text-light flex items-center text-sm">
                      <AtSymbolIcon className="inline h-3 w-3" />
                      {user.username}
                    </div>
                  </div>
                  <div className="flex items-center gap-x-4">
                    <Button
                      color="primary"
                      onClick={() => {
                        if (friendStatus[user.id] === "friends") {
                          friendDeleteMutation.mutate(user.id);
                        } else {
                          friendCreateMutation.mutate(user.id);
                        }
                      }}
                    >
                      {actionLabel(friendStatus[user.id])}
                    </Button>
                  </div>
                </div>
              </ListItem>
            );
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
