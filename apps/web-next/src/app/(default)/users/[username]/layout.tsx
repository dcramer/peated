import { AtSymbolIcon } from "@heroicons/react/20/solid";
import Button from "@peated/web/components/button";
import Chip from "@peated/web/components/chip";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import UserAvatar from "@peated/web/components/userAvatar";
import UserTagDistribution from "@peated/web/components/userTagDistribution";
import { getCurrentUser, logout } from "@peated/web/lib/auth.server";
import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { getUser } from "../utils.server";
import FriendButton from "./friendButton";
import ModActions from "./modActions";

export default async function Layout({
  params,
  children,
}: {
  params: Record<string, any>;
  children: ReactNode;
}) {
  const user = await getUser(params.username);
  const currentUser = await getCurrentUser();

  const isPrivate =
    user.private &&
    currentUser &&
    user.id !== currentUser.id &&
    user.friendStatus !== "friends";

  return (
    <>
      <div className="my-8 flex min-w-full flex-wrap gap-y-4 sm:flex-nowrap">
        <div className="flex w-full justify-center sm:w-auto sm:justify-start">
          <UserAvatar user={user} size={150} />
        </div>
        <div className="flex w-full flex-col justify-center gap-y-4 px-4 sm:w-auto sm:flex-auto sm:gap-y-2">
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
                <FriendButton user={user} />
              ) : (
                <>
                  <Button href="/settings" color="primary">
                    Edit Profile
                  </Button>
                  <Button onClick={logout} color="primary">
                    Sign Out
                  </Button>
                </>
              )}

              <ModActions user={user} />
            </div>
          )}
        </div>
      </div>

      {isPrivate ? (
        <EmptyActivity>This users profile is private.</EmptyActivity>
      ) : (
        <>
          <Suspense
            fallback={
              <div
                className="mb-4 animate-pulse rounded bg-slate-800"
                style={{ height: 100 }}
              />
            }
          >
            <UserTagDistribution userId={user.id} />
          </Suspense>
          <Tabs fullWidth border>
            <TabItem as={Link} href={`/users/${user.username}`} controlled>
              Activity
            </TabItem>
            <TabItem
              as={Link}
              href={`/users/${user.username}/favorites`}
              controlled
            >
              Favorites
            </TabItem>
          </Tabs>
          {children}
        </>
      )}
    </>
  );
}
