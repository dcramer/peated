import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";

import Layout from "~/components/layout";
import { redirectToAuth } from "~/lib/auth.server";

import { AtSymbolIcon } from "@heroicons/react/20/solid";
import { json } from "@remix-run/node";
import { Link } from "@remix-run/react";
import {
  QueryClient,
  dehydrate,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";

import type { FriendStatus } from "@peated/shared/types";
import type { SitemapFunction } from "remix-sitemap";
import Button from "~/components/button";
import EmptyActivity from "~/components/emptyActivity";
import ListItem from "~/components/listItem";
import LoadingIndicator from "~/components/loadingIndicator";
import SimpleHeader from "~/components/simpleHeader";
import UserAvatar from "~/components/userAvatar";
import useApi from "~/hooks/useApi";
import { fetchFriends } from "~/queries/friends";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function loader({ context }: LoaderFunctionArgs) {
  if (!context.user) return redirectToAuth({ request });

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(["friends"], () => fetchFriends(context.api));

  return json({ dehydratedState: dehydrate(queryClient) });
}

export const meta: MetaFunction = () => {
  return [
    {
      title: "Friends",
    },
  ];
};

export default function Friends() {
  const api = useApi();

  const { data, isLoading } = useQuery(["friends"], () => fetchFriends(api), {
    staleTime: 5 * 60 * 1000,
  });

  const [friendStatus, setFriendStatus] = useState<
    Record<string, FriendStatus>
  >(
    Object.fromEntries(
      data ? data.results.map((r) => [r.user.id, r.status]) : [],
    ),
  );

  const queryClient = useQueryClient();
  const toggleFriendship = useMutation({
    mutationFn: async ({
      toUserId,
      active,
    }: {
      toUserId: number;
      active: boolean;
    }) => {
      const result = await api[active ? "post" : "delete"](
        `/friends/${toUserId}`,
      );
      return [toUserId, result.status];
    },
    onSuccess: ([toUserId, status]) => {
      queryClient.invalidateQueries(["friends"]);

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

  if (isLoading) return <LoadingIndicator />;

  if (!data) return <div>Error</div>;

  const { results, rel } = data;

  return (
    <Layout>
      <SimpleHeader>Friends</SimpleHeader>
      <ul className="divide-y divide-slate-800 sm:rounded">
        {results.length ? (
          results.map(({ user, ...friend }) => {
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
                        toggleFriendship.mutate({
                          toUserId: user.id,
                          active: friendStatus[user.id] === "none",
                        });
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
            You could definitely use a few more friends. We're not judging or
            anything.
          </EmptyActivity>
        )}
      </ul>
      {rel && (
        <nav
          className="flex items-center justify-between py-3"
          aria-label="Pagination"
        >
          <div className="flex flex-1 justify-between gap-x-2 sm:justify-end">
            <Button
              to={rel.prevPage ? `?page=${rel.prevPage}` : undefined}
              disabled={!rel.prevPage}
            >
              Previous
            </Button>
            <Button
              to={rel.nextPage ? `?page=${rel.nextPage}` : undefined}
              disabled={!rel.nextPage}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </Layout>
  );
}
