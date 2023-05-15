import type { LoaderFunction } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import { useState } from "react";
import { Link } from "react-router-dom";
import Button from "../components/button";
import Layout from "../components/layout";
import ListItem from "../components/listItem";
import TimeSince from "../components/timeSince";
import UserAvatar from "../components/userAvatar";
import api from "../lib/api";
import type { FollowRequest, FollowStatus } from "../types";

const EmptyActivity = () => {
  return (
    <div className="m-4 mx-auto flex flex-col items-center rounded-lg border border-dashed border-gray-300 p-12">
      <span className="block font-light text-gray-400">
        You could definitely use a few more friends. We're not judging or
        anything.
      </span>
    </div>
  );
};

type LoaderData = {
  requestList: FollowRequest[];
};

// TODO: when this executes the apiClient has not configured
// its token yet as react-dom (thus context) seemingly has
// not rendered.. so this errors out
export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  const { results: requestList } = await api.get(`/users/me/followers`);

  return { requestList };
};

export default function Friends() {
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
    <Layout gutter noMobileGutter>
      <ul role="list" className="divide-y divide-gray-100">
        {requestList.length ? (
          requestList.map(({ user, ...follow }) => {
            return (
              <ListItem key={user.id}>
                <div className="mb-4 flex flex-1  items-center space-x-4">
                  <span className="w-48-px h-48-px overflow-hidden rounded bg-gray-100">
                    <UserAvatar size={48} user={user} />
                  </span>
                  <div className="text-peated flex-1 space-y-1 font-medium">
                    <Link to={`/users/${user.id}`} className="hover:underline">
                      {user.displayName}
                    </Link>
                    <TimeSince
                      className="block text-sm font-light text-gray-500 dark:text-gray-400"
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
                          followUser(
                            user.id,
                            myFollowStatus[user.id] === "none",
                          );
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
          <EmptyActivity />
        )}
      </ul>
    </Layout>
  );
}
