import { AtSymbolIcon } from "@heroicons/react/20/solid";
import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/button";
import EmptyActivity from "../components/emptyActivity";
import ListItem from "../components/listItem";
import UserAvatar from "../components/userAvatar";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import type { FollowRequest, FollowStatus, Paginated } from "../types";

export default function Followers() {
  const {
    data: { results: followerList },
  } = useSuspenseQuery(
    ["followers"],
    (): Promise<Paginated<FollowRequest>> => api.get("/followers"),
  );

  const [theirFollowStatus, setTheirFollowStatus] = useState<
    Record<string, FollowStatus>
  >(Object.fromEntries(followerList.map((r) => [r.id, r.status])));

  const [myFollowStatus, setMyFollowStatus] = useState<
    Record<string, FollowStatus>
  >(Object.fromEntries(followerList.map((r) => [r.user.id, r.followsBack])));

  const acceptRequest = async (id: string) => {
    const data = await api.put(`/followers/${id}`, {
      data: { action: "accept" },
    });
    setTheirFollowStatus((state) => ({
      ...state,
      [id]: data.status,
    }));
  };

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
        return "Follow Back";
    }
  };

  return (
    <ul role="list" className="divide-y divide-slate-800 sm:rounded">
      {followerList.length ? (
        followerList.map(({ user, ...follow }) => {
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
                  <div className="text-light flex items-center text-sm">
                    <AtSymbolIcon className="inline h-3 w-3" />
                    {user.username}
                  </div>
                </div>
                <div className="flex items-center gap-x-4">
                  <Button
                    color="primary"
                    onClick={() => {
                      if (theirFollowStatus[follow.id] === "pending") {
                        acceptRequest(follow.id);
                      } else {
                        followUser(user.id, myFollowStatus[user.id] === "none");
                      }
                    }}
                  >
                    {theirFollowStatus[follow.id] === "pending"
                      ? "Accept"
                      : followLabel(myFollowStatus[user.id])}
                  </Button>
                </div>
              </div>
            </ListItem>
          );
        })
      ) : (
        <EmptyActivity>There's no requests pending.</EmptyActivity>
      )}
    </ul>
  );
}
