import type { LoaderFunction } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/button";
import EmptyActivity from "../components/emptyActivity";
import ListItem from "../components/listItem";
import TimeSince from "../components/timeSince";
import UserAvatar from "../components/userAvatar";
import api from "../lib/api";
import type { FollowStatus, Friend } from "../types";

type LoaderData = {
  friendList: Friend[];
};

// TODO: when this executes the apiClient has not configured
// its token yet as react-dom (thus context) seemingly has
// not rendered.. so this errors out
export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  const { results: friendList } = await api.get(`/friends`);

  return { friendList };
};

export default function FriendList() {
  const { friendList } = useLoaderData() as LoaderData;

  const [myFollowStatus, setMyFollowStatus] = useState<
    Record<string, FollowStatus>
  >(Object.fromEntries(friendList.map((r) => [r.user.id, r.status])));

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
      {friendList.length ? (
        friendList.map(({ user, ...follow }) => {
          return (
            <ListItem key={user.id}>
              <div className="flex flex-1 items-center space-x-4">
                <UserAvatar size={48} user={user} />
                <div className="flex-1 space-y-1 font-medium">
                  <Link to={`/users/${user.id}`} className="hover:underline">
                    {user.displayName}
                  </Link>
                  <TimeSince
                    className="text-peated-light block text-sm font-light"
                    date={follow.createdAt}
                  />
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
