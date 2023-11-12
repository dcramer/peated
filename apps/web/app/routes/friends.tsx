import { AtSymbolIcon } from "@heroicons/react/20/solid";
import type { FriendStatus } from "@peated/server/types";
import type { LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import { useState } from "react";
import type { SitemapFunction } from "remix-sitemap";
import Button from "~/components/button";
import EmptyActivity from "~/components/emptyActivity";
import Layout from "~/components/layout";
import ListItem from "~/components/listItem";
import SimpleHeader from "~/components/simpleHeader";
import UserAvatar from "~/components/userAvatar";
import { redirectToAuth } from "~/lib/auth.server";
import { trpc } from "~/lib/trpc";

export const sitemap: SitemapFunction = () => ({
  exclude: true,
});

export async function loader({
  request,
  context: { user, trpc },
}: LoaderFunctionArgs) {
  if (!user) return redirectToAuth({ request });

  return json({
    friendList: await trpc.friendList.query(),
  });
}

export const meta: MetaFunction = () => {
  return [
    {
      title: "Friends",
    },
  ];
};

export default function Friends() {
  const { friendList } = useLoaderData<typeof loader>();

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

  if (!friendList) return <div>Error</div>;

  const { results, rel } = friendList;

  return (
    <Layout>
      <SimpleHeader>Friends</SimpleHeader>
      <ul className="divide-y divide-slate-800 sm:rounded">
        {results.length ? (
          results.map(({ user, ...friend }) => {
            return (
              <ListItem key={user.id}>
                <div className="flex flex-auto items-center space-x-4">
                  <UserAvatar size={48} user={user} />
                  <div className="flex-auto space-y-1 font-medium">
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
          <div className="flex flex-auto justify-between gap-x-2 sm:justify-end">
            <Button
              to={rel.prevCursor ? `?cursor=${rel.prevCursor}` : undefined}
              disabled={!rel.prevCursor}
            >
              Previous
            </Button>
            <Button
              to={rel.nextCursor ? `?cursor=${rel.nextCursor}` : undefined}
              disabled={!rel.nextCursor}
            >
              Next
            </Button>
          </div>
        </nav>
      )}
    </Layout>
  );
}
