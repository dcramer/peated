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
import type { FollowRequest, FollowStatus } from "../types";

type LoaderData = {
  requestList: FollowRequest[];
};

// TODO: when this executes the apiClient has not configured
// its token yet as react-dom (thus context) seemingly has
// not rendered.. so this errors out
export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  const { results: requestList } = await api.get(`/users/me/followers`, {
    query: { status: "pending" },
  });

  return { requestList };
};

export default function FriendRequests() {
  const { requestList } = useLoaderData() as LoaderData;

  const [theirFollowStatus, setTheirFollowStatus] = useState<
    Record<string, FollowStatus>
  >(Object.fromEntries(requestList.map((r) => [r.id, r.status])));

  const [myFollowStatus, setMyFollowStatus] = useState<
    Record<string, FollowStatus>
  >(Object.fromEntries(requestList.map((r) => [r.user.id, r.followsBack])));

  const acceptRequest = async (id: string) => {
    const data = await api.put(`/users/me/followers/${id}`, {
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
      {requestList.length ? (
        requestList.map(({ user, ...follow }) => {
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
