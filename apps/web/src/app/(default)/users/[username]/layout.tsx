import Button from "@peated/web/components/button";
import Chip from "@peated/web/components/chip";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import UserAvatar from "@peated/web/components/userAvatar";
import UserLocationChart from "@peated/web/components/userLocationChart";
import UserTagDistribution from "@peated/web/components/userTagDistribution";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { getTrpcClient } from "@peated/web/lib/trpc/client.server";
import { type ReactNode } from "react";
import FriendButton from "./friendButton";
import LogoutButton from "./logoutButton";
import ModActions from "./modActions";
import { UserBadgeList } from "./userBadgeList";

export const fetchCache = "default-no-store";

export default async function Layout({
  params: { username },
  children,
}: {
  params: { username: string };
  children: ReactNode;
}) {
  const trpcClient = await getTrpcClient();
  const user = await trpcClient.userById.fetch(username);

  const currentUser = await getCurrentUser();

  const isPrivate =
    user.private &&
    currentUser &&
    user.id !== currentUser.id &&
    user.friendStatus !== "friends";

  return (
    <>
      <div className="mb-4 flex min-w-full flex-wrap gap-y-4 sm:flex-nowrap lg:mb-8">
        <div className="flex w-full justify-center sm:w-auto sm:justify-start">
          <UserAvatar user={user} size={150} />
        </div>
        <div className="flex w-full flex-col justify-center gap-y-4 px-4 sm:w-auto sm:flex-auto sm:gap-y-2">
          <h3 className="self-center text-4xl font-semibold leading-normal text-white sm:self-start">
            {user.username}
          </h3>
          <div className="text-muted flex flex-col items-center gap-x-2 gap-y-2 self-center sm:flex-row sm:self-start">
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
              <span className="text-muted text-sm">Tastings</span>
            </div>
            <div className="mb-4 px-3 text-center">
              <span className="block text-xl font-bold uppercase tracking-wide text-white">
                {user.stats.bottles.toLocaleString()}
              </span>
              <span className="text-muted text-sm">Bottles</span>
            </div>
            <div className="mb-4 px-3 text-center">
              <span className="block text-xl font-bold uppercase tracking-wide text-white">
                {user.stats.collected.toLocaleString()}
              </span>
              <span className="text-muted text-sm">Collected</span>
            </div>
            <div className="mb-4 pl-3 text-center">
              <span className="block text-xl font-bold uppercase tracking-wide text-white">
                {user.stats.contributions.toLocaleString()}
              </span>
              <span className="text-muted text-sm">Contributions</span>
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
                  <LogoutButton />
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
          <div className="mb-4 px-3 sm:px-0 lg:mb-8">
            <UserBadgeList userId={user.id} />
          </div>
          <div className="grid-cols mb-4 hidden grid-cols-1 gap-4 px-3 sm:grid-cols-2 sm:px-0 lg:grid">
            <UserLocationChart userId={user.id} />
            <UserTagDistribution userId={user.id} />
          </div>
          <div className="hidden lg:block">
            <Tabs fullWidth border>
              <TabItem as={Link} href={`/users/${user.username}`} controlled>
                Activity
              </TabItem>
              <TabItem
                as={Link}
                href={`/users/${user.username}/favorites`}
                controlled
                desktopOnly
              >
                Favorites
              </TabItem>
            </Tabs>
          </div>
          {children}
        </>
      )}
    </>
  );
}
