"use client";

import { AtSymbolIcon } from "@heroicons/react/20/solid";
import type { FriendStatus } from "@peated/server/types";
import Button from "@peated/web/components/button";
import EmptyActivity from "@peated/web/components/emptyActivity";
import ListItem from "@peated/web/components/listItem";
import PaginationButtons from "@peated/web/components/paginationButtons";
import UserAvatar from "@peated/web/components/userAvatar";
import useAuthRequired from "@peated/web/hooks/useAuthRequired";
import { trpc } from "@peated/web/lib/trpc";
import Link from "next/link";
import { useState } from "react";

export default function Content({ friendList }: { friendList: any }) {
  useAuthRequired();

  const [friendStatus, setFriendStatus] = useState<
    Record<string, FriendStatus>
  >(
    Object.fromEntries(
      friendList ? friendList.results.map((r) => [r.user.id, r.status]) : [],
    ),
  );

  const friendCreateMutation = trpc.friendCreate.useMutation({
    onSuccess: (status, toUserId) => {
      setFriendStatus((state) => ({
        ...state,
        [toUserId]: status,
      }));
    },
  });
  const friendDeleteMutation = trpc.friendDelete.useMutation({
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
              <ListItem as="li" key={user.id}>
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
