"use client";

import * as stylex from "@stylexjs/stylex";
import { useMutation } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import {
  Button,
  ButtonLink,
  EmptyState,
  PageTabs,
  RowMenu,
} from "@peated/web/components";
import { MemberProfileHeader } from "@peated/web/components/pages/memberProfileHeader.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";
import { space } from "../../../../styles/tokens.stylex";
import { ProfileProvider, type ProfileUser } from "./profileContext";

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
  const [isModerator, setIsModerator] = useState(Boolean(initialUser.mod));

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
        pictureUrl={initialUser.pictureUrl}
        privateProfile={privateRecord}
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
          <PageTabs
            ariaLabel={`${initialUser.username}'s profile`}
            currentHref={pathname}
            items={[
              {
                href: `/users/${initialUser.username}`,
                label: "Overview",
              },
              {
                count: initialUser.stats.tastings,
                href: `/users/${initialUser.username}/tastings`,
                label: "Tastings",
              },
              {
                count: initialUser.stats.library.total,
                href: `/users/${initialUser.username}/library`,
                label: "Library",
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

const styles = stylex.create({
  page: { minWidth: 0 },
  content: { marginTop: space.x8 },
  privateState: { maxWidth: "760px", marginTop: space.x6 },
});
