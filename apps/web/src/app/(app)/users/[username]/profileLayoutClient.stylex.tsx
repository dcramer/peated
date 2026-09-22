"use client";

import * as stylex from "@stylexjs/stylex";
import { useMutation } from "@tanstack/react-query";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";

import { Button, ButtonLink } from "@peated/web/components/button.stylex";
import { EmptyState } from "@peated/web/components/feedback.stylex";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { MemberProfileHeader } from "@peated/web/components/pages/memberProfileHeader.stylex";
import { PageTabs } from "@peated/web/components/pageTabs.stylex";
import { ReportContentDialog } from "@peated/web/components/reportContentDialog";
import {
  RowMenu,
  type RowMenuGroup,
  type RowMenuItem,
} from "@peated/web/components/rowMenu.stylex";
import { SuspendMemberDialog } from "@peated/web/components/suspendMemberDialog";
import { useORPC } from "@peated/web/lib/orpc/context";
import { space } from "../../../../styles/tokens.stylex";
import { ProfileProvider, type ProfileUser } from "./profileContext";

type FriendStatus = NonNullable<ProfileUser["friendStatus"]>;

export function ProfileLayoutClient({
  children,
  currentUserAdmin,
  currentUserId,
  currentUserStaff,
  initialUser,
  privateRecord,
}: {
  children: ReactNode;
  currentUserAdmin: boolean;
  currentUserId?: number;
  /** An administrator or moderator, who can suspend members. */
  currentUserStaff: boolean;
  initialUser: ProfileUser;
  privateRecord: boolean;
}) {
  const pathname = usePathname();
  const [isModerator, setIsModerator] = useState(Boolean(initialUser.mod));
  const [isSuspended, setIsSuspended] = useState(
    Boolean(initialUser.suspendedAt),
  );
  const [isBlocked, setIsBlocked] = useState(Boolean(initialUser.blocked));

  return (
    <div {...stylex.props(styles.page)}>
      <MemberProfileHeader
        actions={
          <ProfileActions
            currentUserAdmin={currentUserAdmin}
            currentUserId={currentUserId}
            currentUserStaff={currentUserStaff}
            initialUser={initialUser}
            isBlocked={isBlocked}
            isModerator={isModerator}
            isSuspended={isSuspended}
            onBlockedChange={setIsBlocked}
            onModeratorChange={setIsModerator}
            onSuspendedChange={setIsSuspended}
          />
        }
        blocked={isBlocked}
        pictureUrl={initialUser.pictureUrl}
        privateProfile={privateRecord}
        suspended={isSuspended}
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
  currentUserStaff,
  initialUser,
  isBlocked,
  isModerator,
  isSuspended,
  onBlockedChange,
  onModeratorChange,
  onSuspendedChange,
}: {
  currentUserAdmin: boolean;
  currentUserId?: number;
  currentUserStaff: boolean;
  initialUser: ProfileUser;
  isBlocked: boolean;
  isModerator: boolean;
  isSuspended: boolean;
  onBlockedChange: (value: boolean) => void;
  onModeratorChange: (value: boolean) => void;
  onSuspendedChange: (value: boolean) => void;
}) {
  const orpc = useORPC();
  const { flash } = useFlashMessages();
  const isCurrentUser = currentUserId === initialUser.id;
  const [friendStatus, setFriendStatus] = useState<FriendStatus>(
    initialUser.friendStatus ?? "none",
  );
  const [reporting, setReporting] = useState(false);
  const [suspending, setSuspending] = useState(false);
  const showError = (fallback: string) => (error: Error) =>
    flash(error.message || fallback, "error");
  const blockMutation = useMutation({
    ...orpc.users.blockCreate.mutationOptions(),
    onSuccess: () => {
      onBlockedChange(true);
      setFriendStatus("none");
      flash(
        `You blocked @${initialUser.username}. They can no longer comment on or toast your tastings, or send you friend requests.`,
        "success",
      );
    },
    onError: showError("Unable to block this member."),
  });
  const unblockMutation = useMutation({
    ...orpc.users.blockDelete.mutationOptions(),
    onSuccess: () => {
      onBlockedChange(false);
      flash(`You unblocked @${initialUser.username}.`, "success");
    },
    onError: showError("Unable to unblock this member."),
  });
  const suspensionMutation = useMutation({
    ...orpc.users.suspensionUpdate.mutationOptions(),
    onSuccess: (updatedUser) => {
      const suspended = Boolean(updatedUser.suspendedAt);
      onSuspendedChange(suspended);
      flash(
        suspended
          ? `@${initialUser.username} is suspended.`
          : `@${initialUser.username} is reinstated.`,
        "success",
      );
    },
  });
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

  const blockPending = blockMutation.isPending || unblockMutation.isPending;
  const groups: RowMenuGroup[] = [
    {
      items: [
        { label: "Report member", onSelect: () => setReporting(true) },
        {
          disabled: blockPending,
          label: isBlocked ? "Unblock member" : "Block member",
          onSelect: () => {
            if (isBlocked) unblockMutation.mutate({ user: initialUser.id });
            else blockMutation.mutate({ user: initialUser.id });
          },
        },
      ],
    },
  ];
  const moderation: RowMenuItem[] = [];
  // Administrators cannot be suspended, so staff see no suspend action there.
  if (currentUserStaff && !initialUser.admin) {
    moderation.push({
      disabled: suspensionMutation.isPending,
      label: isSuspended ? "Reinstate member" : "Suspend member",
      onSelect: () => {
        if (isSuspended)
          suspensionMutation.mutate(
            { suspended: false, user: initialUser.id },
            { onError: showError("Unable to reinstate this member.") },
          );
        else setSuspending(true);
      },
    });
  }
  if (currentUserAdmin) {
    moderation.push({
      disabled: userUpdateMutation.isPending,
      label: isModerator ? "Remove moderator role" : "Add moderator role",
      onSelect: () =>
        userUpdateMutation.mutate({ mod: !isModerator, user: initialUser.id }),
    });
  }
  if (moderation.length)
    groups.push({ label: "Moderation", items: moderation });

  return (
    <>
      {isBlocked ? null : (
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
      )}
      <RowMenu groups={groups} label={initialUser.username} variant="page" />
      <ReportContentDialog
        isOpen={reporting}
        onClose={() => setReporting(false)}
        subject={`@${initialUser.username}`}
        target={{ objectType: "user", objectId: initialUser.id }}
      />
      <SuspendMemberDialog
        isOpen={suspending}
        onCancel={() => setSuspending(false)}
        onSubmit={async (reason) => {
          await suspensionMutation.mutateAsync({
            reason,
            suspended: true,
            user: initialUser.id,
          });
          setSuspending(false);
        }}
        username={initialUser.username}
      />
    </>
  );
}

const styles = stylex.create({
  page: { minWidth: 0 },
  content: { marginTop: space.x8 },
  privateState: { maxWidth: "760px", marginTop: space.x6 },
});
