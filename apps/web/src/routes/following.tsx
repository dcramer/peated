import { AtSymbolIcon } from "@heroicons/react/20/solid";
import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/button";
import EmptyActivity from "../components/emptyActivity";
import ListItem from "../components/listItem";
import UserAvatar from "../components/userAvatar";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import type { FollowStatus, Friend, Paginated } from "../types";

export default function Following() {
  const {
    data: { results: followingList },
  } = useSuspenseQuery(
    ["following"],
    (): Promise<Paginated<Friend>> => api.get("/following", {}),
  );

  const [myFollowStatus, setMyFollowStatus] = useState<
    Record<string, FollowStatus>
  >(Object.fromEntries(followingList.map((r) => [r.user.id, r.status])));

  const followUser = async (toUserId: string, follow: boolean) => {
    const data = await api[follow ? "post" : "delete"](
      `/users/${toUserId}/follow`,
    );
    setMyFollowStatus((state) => ({
      ...state,
      [toUserId]: data.status,
    }));
  };

  const followLabel = (status: FollowStatus) => {
    switch (status) {
      case "following":
        return "Unfollow";
      case "pending":
        return "Request Sent";
      case "none":
      default:
        return "Follow";
    }
  };

  return (
    <ul role="list" className="divide-y divide-slate-800 sm:rounded">
      {followingList.length ? (
        followingList.map(({ user, ...follow }) => {
          return (
            <ListItem key={user.id}>
              <div className="flex flex-1 items-center space-x-4">
                <UserAvatar size={48} user={user} />
                <div className="flex-1 space-y-1 font-medium">
                  <Link
                    to={`/users/${user.username}`}
                    className="hover:underline"
                  >
                    {user.displayName}
                  </Link>
                  <div className="text-light flex items-center">
                    <AtSymbolIcon className=" mr-[1px] inline h-4 w-4" />
                    {user.username}
                  </div>
                </div>
                <div className="flex items-center gap-x-4">
                  <Button
                    color="primary"
                    onClick={() => {
                      followUser(user.id, myFollowStatus[user.id] === "none");
                    }}
                  >
                    {followLabel(myFollowStatus[user.id])}
                  </Button>
                </div>
              </div>
            </ListItem>
          );
        })
      ) : (
        <EmptyActivity>
          You could definitely use a few more friends. We're not judging or
          anything.
        </EmptyActivity>
      )}
    </ul>
  );
}
