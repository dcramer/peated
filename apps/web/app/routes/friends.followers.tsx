import { AtSymbolIcon } from "@heroicons/react/20/solid";
import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { QueryClient, dehydrate, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import Button from "~/components/button";
import EmptyActivity from "~/components/emptyActivity";
import ListItem from "~/components/listItem";
import UserAvatar from "~/components/userAvatar";
import useApi from "~/hooks/useApi";
import type { FollowRequest, FollowStatus, Friend, Paginated } from "~/types";

export async function loader({ context }: LoaderArgs) {
  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(
    ["following"],
    (): Promise<Paginated<Friend>> => context.api.get("/followers"),
  );

  return json({ dehydratedState: dehydrate(queryClient) });
}

export const meta: V2_MetaFunction = () => {
  return [
    {
      title: "Followers",
    },
  ];
};

export default function Followers() {
  const api = useApi();

  const { data: followerList } = useQuery(
    ["followers"],
    (): Promise<Paginated<FollowRequest>> => api.get("/followers"),
    {
      staleTime: 5 * 60 * 1000,
    },
  );

  const [theirFollowStatus, setTheirFollowStatus] = useState<
    Record<string, FollowStatus>
  >(
    Object.fromEntries(
      followerList ? followerList.results.map((r) => [r.id, r.status]) : [],
    ),
  );

  const [myFollowStatus, setMyFollowStatus] = useState<
    Record<string, FollowStatus>
  >(
    Object.fromEntries(
      followerList
        ? followerList.results.map((r) => [r.user.id, r.followsBack])
        : [],
    ),
  );

  const acceptRequest = async (id: number) => {
    const data = await api.put(`/followers/${id}`, {
      data: { action: "accept" },
    });
    setTheirFollowStatus((state) => ({
      ...state,
      [id]: data.status,
    }));
  };

  const followUser = async (toUserId: number, follow: boolean) => {
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
    <ul className="divide-y divide-slate-800 sm:rounded">
      {followerList && followerList.results.length ? (
        followerList.results.map(({ user, ...follow }) => {
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
