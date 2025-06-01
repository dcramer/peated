import Button from "@peated/web/components/button";
import Chip from "@peated/web/components/chip";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import UserAvatar from "@peated/web/components/userAvatar";
import UserFlavorDistributionChart from "@peated/web/components/userFlavorDistributionChart";
import UserLocationChart from "@peated/web/components/userLocationChart";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import type { ReactNode } from "react";
import type { ProfilePage, WithContext } from "schema-dts";
import FriendButton from "./friendButton";
import LogoutButton from "./logoutButton";
import ModActions from "./modActions";
import { UserBadgeList } from "./userBadgeList";

export const fetchCache = "default-no-store";

export async function generateMetadata({
  params: { username },
}: {
  params: { username: string };
}) {
  const { client } = await createServerClient();
  const user = await client.users.details({ user: username });

  return {
    title: `@${user.username}`,
    openGraph: {
      type: "profile",
      profile: {
        username: user.username,
      },
    },
  };
}

export default async function Layout({
  params: { username },
  children,
}: {
  params: { username: string };
  children: ReactNode;
}) {
  const { client } = await createServerClient();
  const user = await client.users.details({
    user: username,
  });

  const currentUser = await getCurrentUser();

  const isPrivate =
    user.private &&
    currentUser &&
    user.id !== currentUser.id &&
    user.friendStatus !== "friends";

  const jsonLd: WithContext<ProfilePage> = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    mainEntity: {
      "@type": "Person",
      name: user.username,
      image: user.pictureUrl ?? undefined,
      identifier: `${user.id}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mb-4 flex min-w-full flex-wrap gap-y-4 lg:mb-8 lg:flex-nowrap">
        <div className="flex w-full justify-center lg:w-auto lg:justify-start">
          <UserAvatar user={user} size={150} />
        </div>
        <div className="flex w-full flex-col justify-center gap-y-4 px-4 lg:w-auto lg:flex-auto lg:gap-y-2">
          <h3 className="self-center text-4xl font-semibold leading-normal text-white lg:self-start">
            {user.username}
          </h3>
          <div className="text-muted flex flex-col items-center gap-x-2 gap-y-2 self-center lg:flex-row lg:self-start">
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
          <div className="flex justify-center lg:justify-start">
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
        <div className="flex w-full flex-col items-center justify-center lg:w-auto lg:items-end">
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
          <div className="mb-4 px-3 lg:mb-8 lg:px-0">
            <UserBadgeList userId={user.id} />
          </div>
          <div className="grid-cols mb-4 hidden grid-cols-1 gap-4 px-3 lg:grid lg:grid-cols-2 lg:px-0">
            <UserLocationChart userId={user.id} />
            <UserFlavorDistributionChart userId={user.id} />
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
