import { Menu } from "@headlessui/react";
import { AtSymbolIcon, EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import type { LoaderArgs, V2_MetaFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useSubmit } from "@remix-run/react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import invariant from "tiny-invariant";
import Button from "~/components/button";
import Chip from "~/components/chip";
import { DistributionChart } from "~/components/distributionChart";
import EmptyActivity from "~/components/emptyActivity";
import Layout from "~/components/layout";
import QueryBoundary from "~/components/queryBoundary";
import Tabs from "~/components/tabs";
import UserAvatar from "~/components/userAvatar";
import useApi from "~/hooks/useApi";
import useAuth from "~/hooks/useAuth";
import { fetchUserTags, getUser } from "~/queries/users";

const UserTagDistribution = ({ userId }: { userId: number }) => {
  const api = useApi();
  const { data } = useQuery(["users", userId, "tags"], () =>
    fetchUserTags(api, userId),
  );

  if (!data) return null;

  const { results, totalCount } = data;

  if (!results.length) return null;

  return (
    <DistributionChart
      items={results.map((t) => ({
        name: t.tag,
        count: t.count,
        tag: t.tag,
      }))}
      totalCount={totalCount}
      to={(item) => `/bottles?tag=${encodeURIComponent(item.name)}`}
    />
  );
};

export async function loader({ params, context }: LoaderArgs) {
  invariant(params.username);

  const user = await getUser(context.api, params.username);

  return json({ user });
}

export const meta: V2_MetaFunction = ({ data: { user } }) => {
  return [
    {
      title: `@${user.username}`,
      "og:type": "profile",
      "og:profile:username": user.username,
    },
  ];
};

export default function Profile() {
  const api = useApi();
  const { user: currentUser } = useAuth();
  const submit = useSubmit();
  const data = useLoaderData<typeof loader>();

  const [user, setUser] = useState(data.user);
  const [friendStatus, setFriendStatus] = useState(user.friendStatus);

  const friendUser = async (follow: boolean) => {
    const data = await api[follow ? "post" : "delete"](`/friends/${user.id}`);
    setFriendStatus(data.status);
  };

  const isPrivate =
    user.private &&
    currentUser &&
    user.id !== currentUser.id &&
    friendStatus !== "friends";

  return (
    <Layout>
      <div className="my-8 flex min-w-full flex-wrap gap-y-4 sm:flex-nowrap">
        <div className="flex w-full justify-center sm:w-auto sm:justify-start">
          <UserAvatar user={user} size={150} />
        </div>
        <div className="flex w-full flex-col justify-center gap-y-4 px-4 sm:w-auto sm:flex-1 sm:gap-y-2">
          <h3 className="self-center text-4xl font-semibold leading-normal text-white sm:self-start">
            {user.displayName}
          </h3>
          <div className="text-light flex flex-col items-center gap-x-2 gap-y-2 self-center sm:flex-row sm:self-start">
            <div>
              <AtSymbolIcon className="inline h-3 w-3" />
              {user.username}
            </div>
            <div>
              {user.admin ? (
                <Chip size="small" color="highlight">
                  Admin
                </Chip>
              ) : user.mod ? (
                <Chip size="small" color="highlight">
                  Moderator
                </Chip>
              ) : null}
            </div>
          </div>
          <div className="flex justify-center sm:justify-start">
            <div className="mr-4 pr-3 text-center">
              <span className="block text-xl font-bold uppercase tracking-wide text-white">
                {user.stats.tastings.toLocaleString()}
              </span>
              <span className="text-light text-sm">Tastings</span>
            </div>
            <div className="mb-4 px-3 text-center">
              <span className="block text-xl font-bold uppercase tracking-wide text-white">
                {user.stats.bottles.toLocaleString()}
              </span>
              <span className="text-light text-sm">Bottles</span>
            </div>
            <div className="mb-4 px-3 text-center">
              <span className="block text-xl font-bold uppercase tracking-wide text-white">
                {user.stats.collected.toLocaleString()}
              </span>
              <span className="text-light text-sm">Collected</span>
            </div>
            <div className="mb-4 pl-3 text-center">
              <span className="block text-xl font-bold uppercase tracking-wide text-white">
                {user.stats.contributions.toLocaleString()}
              </span>
              <span className="text-light text-sm">Contributions</span>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col items-center justify-center sm:w-auto sm:items-end">
          {currentUser && (
            <div className="flex gap-x-2">
              {user.id !== currentUser.id ? (
                <>
                  <Button
                    color="primary"
                    onClick={() => friendUser(friendStatus === "none")}
                  >
                    {friendStatus === "none"
                      ? "Add Friend"
                      : friendStatus === "pending"
                      ? "Request Pending"
                      : "Remove Friend"}
                  </Button>
                </>
              ) : (
                <>
                  <Button to="/settings" color="primary">
                    Edit Profile
                  </Button>
                  <Button
                    onClick={() => {
                      submit(null, { method: "POST", action: "/logout" });
                    }}
                    color="primary"
                  >
                    Sign Out
                  </Button>
                </>
              )}
              {currentUser.admin && (
                <Menu as="div" className="menu">
                  <Menu.Button as={Button}>
                    <EllipsisVerticalIcon className="h-5 w-5" />
                  </Menu.Button>
                  <Menu.Items className="absolute right-0 z-10 mt-2 w-64 origin-top-right">
                    <Menu.Item
                      as="button"
                      onClick={async () => {
                        const data = await api.put(`/users/${user.id}`, {
                          data: {
                            mod: !user.mod,
                          },
                        });
                        setUser((state) => ({ ...state, ...data }));
                      }}
                    >
                      {user.mod
                        ? "Remove Moderator Role"
                        : "Add Moderator Role"}
                    </Menu.Item>
                  </Menu.Items>
                </Menu>
              )}
            </div>
          )}
        </div>
      </div>

      {isPrivate ? (
        <EmptyActivity>This users profile is private.</EmptyActivity>
      ) : (
        <>
          <QueryBoundary
            loading={
              <div
                className="mb-4 animate-pulse rounded bg-slate-800"
                style={{ height: 100 }}
              />
            }
            fallback={() => null}
          >
            <UserTagDistribution userId={user.id} />
          </QueryBoundary>
          <Tabs fullWidth border>
            <Tabs.Item as={Link} to={`/users/${user.username}`} controlled>
              Activity
            </Tabs.Item>
            <Tabs.Item
              as={Link}
              to={`/users/${user.username}/favorites`}
              controlled
            >
              Favorites
            </Tabs.Item>
          </Tabs>
          <QueryBoundary>
            <Outlet context={{ user }} />
          </QueryBoundary>
        </>
      )}
    </Layout>
  );
}
