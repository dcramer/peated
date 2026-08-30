"use client";

import type { Outputs } from "@peated/server/orpc/router";
import * as stylex from "@stylexjs/stylex";
import { useMutation, useQuery } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  Button,
  ButtonLink,
  EmptyState,
  PageTabs,
  RowMenu,
  SummaryStrip,
} from "@peated/web/components/designSystem/components";
import { MemberProfileHeader } from "@peated/web/components/designSystem/patterns/memberProfileHeader.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import { space } from "../../../../styles/tokens.stylex";
import { ProfileProvider, type ProfileUser } from "./profileContext";

type TastingStats = Outputs["users"]["tastingStats"];
type FriendStatus = NonNullable<ProfileUser["friendStatus"]>;

export function ProfileLayoutClient({
  children,
  currentUserAdmin,
  currentUserId,
  initialUser,
  privateRecord,
}: {
  children: ReactNode;
  currentUserAdmin: boolean;
  currentUserId?: number;
  initialUser: ProfileUser;
  privateRecord: boolean;
}) {
  const orpc = useORPC();
  const pathname = usePathname();
  const isCurrentUser = currentUserId === initialUser.id;
  const [isModerator, setIsModerator] = useState(Boolean(initialUser.mod));
  const ratingQuery = useQuery({
    ...orpc.users.tastingStats.queryOptions({
      input: { user: initialUser.id },
    }),
    enabled: !privateRecord,
  });
  const metadata = initialUser.createdAt
    ? [`Joined ${formatJoinDate(initialUser.createdAt)}`]
    : [];
  const badges = initialUser.admin
    ? ["Admin"]
    : isModerator
      ? ["Moderator"]
      : [];

  return (
    <div {...stylex.props(styles.page)}>
      <MemberProfileHeader
        actions={
          <ProfileActions
            currentUserAdmin={currentUserAdmin}
            currentUserId={currentUserId}
            initialUser={initialUser}
            isModerator={isModerator}
            onModeratorChange={setIsModerator}
          />
        }
        badges={badges}
        metadata={metadata}
        pictureUrl={initialUser.pictureUrl}
        privateProfile={privateRecord}
        ratingLabel={isCurrentUser ? "How you rate" : "How they rate"}
        bands={getBands(ratingQuery.data)}
        ratingsLoading={!privateRecord && ratingQuery.isPending}
        username={initialUser.username}
      />

      {privateRecord ? (
        <div {...stylex.props(styles.privateState)}>
          <EmptyState heading="This profile is private">
            Only this member and their friends can view the tasting record and
            library.
          </EmptyState>
        </div>
      ) : (
        <ProfileProvider currentUserId={currentUserId} user={initialUser}>
          <div {...stylex.props(styles.summary)}>
            <SummaryStrip
              cells={[
                { label: "Tastings", value: initialUser.stats.tastings },
                { label: "Unique bottles", value: initialUser.stats.bottles },
                { label: "In library", value: initialUser.stats.library.total },
                {
                  label: "Contributions",
                  value: initialUser.stats.contributions,
                },
              ]}
            />
          </div>
          <PageTabs
            ariaLabel={`${initialUser.username}'s profile`}
            currentHref={pathname}
            items={[
              {
                count: initialUser.stats.tastings,
                href: `/users/${initialUser.username}`,
                label: "Tastings",
              },
              {
                count: initialUser.stats.library.total,
                href: `/users/${initialUser.username}/library`,
                label: "Library",
              },
              {
                href: `/users/${initialUser.username}/activity`,
                label: "Activity",
              },
            ]}
          />
          <div {...stylex.props(styles.content)}>{children}</div>
        </ProfileProvider>
      )}
    </div>
  );
}

function ProfileActions({
  currentUserAdmin,
  currentUserId,
  initialUser,
  isModerator,
  onModeratorChange,
}: {
  currentUserAdmin: boolean;
  currentUserId?: number;
  initialUser: ProfileUser;
  isModerator: boolean;
  onModeratorChange: (value: boolean) => void;
}) {
  const orpc = useORPC();
  const isCurrentUser = currentUserId === initialUser.id;
  const [friendStatus, setFriendStatus] = useState<FriendStatus>(
    initialUser.friendStatus ?? "none",
  );
  const friendCreateMutation = useMutation({
    ...orpc.friends.create.mutationOptions(),
    onSuccess: (friend) => setFriendStatus(friend.status),
  });
  const friendDeleteMutation = useMutation({
    ...orpc.friends.delete.mutationOptions(),
    onSuccess: () => setFriendStatus("none"),
  });
  const userUpdateMutation = useMutation({
    ...orpc.users.update.mutationOptions(),
    onSuccess: (updatedUser) => onModeratorChange(Boolean(updatedUser.mod)),
  });

  if (isCurrentUser) {
    return (
      <>
        <ButtonLink href="/settings/profile" variant="tonal">
          Edit profile
        </ButtonLink>
        <ButtonLink href="/settings" variant="tonal">
          Settings
        </ButtonLink>
      </>
    );
  }
  if (!currentUserId) return null;

  const friendPending =
    friendCreateMutation.isPending || friendDeleteMutation.isPending;
  const friendLabel =
    friendStatus === "none"
      ? "Add friend"
      : friendStatus === "pending"
        ? "Cancel request"
        : "Remove friend";

  return (
    <>
      <Button
        loading={friendPending}
        loadingLabel="Updating…"
        onClick={() => {
          if (friendStatus === "none")
            friendCreateMutation.mutate({ user: initialUser.id });
          else friendDeleteMutation.mutate({ user: initialUser.id });
        }}
        variant={friendStatus === "none" ? "accent" : "tonal"}
      >
        {friendLabel}
      </Button>
      {currentUserAdmin ? (
        <RowMenu
          groups={[
            [
              {
                disabled: userUpdateMutation.isPending,
                label: isModerator
                  ? "Remove moderator role"
                  : "Add moderator role",
                onSelect: () =>
                  userUpdateMutation.mutate({
                    mod: !isModerator,
                    user: initialUser.id,
                  }),
              },
            ],
          ]}
          label={initialUser.username}
          variant="page"
        />
      ) : null}
    </>
  );
}

function getBands(stats?: TastingStats) {
  if (!stats?.bands.total) return undefined;
  return {
    good: stats.bands.good,
    mediocre: stats.bands.mediocre,
    outstanding: stats.bands.outstanding,
    unicorn: stats.bands.unicorn,
    very_good: stats.bands.very_good,
  };
}

function formatJoinDate(createdAt: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    timeZone: "UTC",
    year: "numeric",
  }).format(new Date(createdAt));
}

const styles = stylex.create({
  page: { minWidth: 0 },
  summary: { marginTop: "6px", marginBottom: space.x6 },
  content: { marginTop: space.x6 },
  privateState: { maxWidth: "760px", marginTop: space.x6 },
});
