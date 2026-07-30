import Button from "@peated/web/components/button";
import Chip from "@peated/web/components/chip";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Link from "@peated/web/components/link";
import Tabs, { TabItem } from "@peated/web/components/tabs";
import UserAvatar from "@peated/web/components/userAvatar";
import { getCurrentUser } from "@peated/web/lib/auth.server";
import { createServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import { type ReactNode } from "react";
import type { ProfilePage, WithContext } from "schema-dts";
import FriendButton from "./friendButton";
import LogoutButton from "./logoutButton";
import ModActions from "./modActions";
import { ProfileProvider } from "./profileContext";

export const fetchCache = "default-no-store";

function ProfileStat({
  href,
  label,
  value,
}: {
  href?: string;
  label: string;
  value: number;
}) {
  const content = (
    <>
      <span className="group-hover:text-highlight order-1 text-xl font-bold tracking-wide text-white transition-colors">
        {value.toLocaleString()}
      </span>
      <span className="text-muted order-2 mt-0.5 min-h-8 text-xs leading-4 sm:text-sm">
        {label}
      </span>
    </>
  );

  return (
    <li className="px-2 text-center sm:px-4">
      {href ? (
        <Link
          href={href}
          className="group flex flex-col rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-yellow-400"
        >
          {content}
        </Link>
      ) : (
        <div className="flex flex-col">{content}</div>
      )}
    </li>
  );
}

export async function generateMetadata(props: {
  params: Promise<{ username: string }>;
}) {
  const params = await props.params;

  const { username } = params;

  const { client } = await createServerClient();
  const user = await resolveOrNotFound(
    client.users.details({ user: username }),
  );

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

export default async function Layout(props: {
  params: Promise<{ username: string }>;
  children: ReactNode;
}) {
  const params = await props.params;

  const { username } = params;

  const { children } = props;

  const { client } = await createServerClient();
  const user = await resolveOrNotFound(
    client.users.details({
      user: username,
    }),
  );

  const currentUser = await getCurrentUser();

  const isPrivate =
    user.private &&
    (!currentUser ||
      (user.id !== currentUser.id && user.friendStatus !== "friends"));

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
      <div className="mb-3 flex min-w-full flex-wrap gap-y-4 lg:flex-nowrap lg:gap-x-6">
        <div className="flex w-full justify-center lg:w-auto lg:justify-start">
          <UserAvatar user={user} size={132} />
        </div>
        <div className="flex w-full flex-col justify-center gap-y-3 px-4 lg:w-auto lg:flex-auto lg:gap-y-1 lg:px-0">
          <h1 className="self-center text-3xl font-semibold leading-normal text-white lg:self-start">
            {user.username}
          </h1>
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
          <ul className="mx-auto grid w-full max-w-lg grid-cols-4 divide-x divide-slate-800 lg:mx-0">
            <ProfileStat
              href={`/users/${user.username}/activity`}
              label="Tastings"
              value={user.stats.tastings}
            />
            <ProfileStat label="Unique bottles" value={user.stats.bottles} />
            <ProfileStat
              href={`/users/${user.username}/library`}
              label="In library"
              value={user.stats.library.total}
            />
            <ProfileStat
              label="Contributions"
              value={user.stats.contributions}
            />
          </ul>
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
        <ProfileProvider userId={user.id}>
          <Tabs border aria-label={`${user.username}'s profile`}>
            <TabItem as={Link} href={`/users/${user.username}`} controlled>
              Profile
            </TabItem>
            <TabItem
              as={Link}
              href={`/users/${user.username}/activity`}
              controlled
            >
              Activity
            </TabItem>
            <TabItem
              as={Link}
              href={`/users/${user.username}/library`}
              controlled
            >
              Library ({user.stats.library.total.toLocaleString()})
            </TabItem>
          </Tabs>
          {children}
        </ProfileProvider>
      )}
    </>
  );
}
