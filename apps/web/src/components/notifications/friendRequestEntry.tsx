"use client";

import type { Notification } from "@peated/server/types";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import Button from "../button";

type FriendRequestNotification = Extract<
  Notification,
  { type: "friend_request" }
>;
type FriendRequestRef = NonNullable<FriendRequestNotification["ref"]>;
type FriendRequestPresentation =
  | {
      kind: "accepted";
      archiveLabel: "Dismiss";
      statusLabel: "Friends";
    }
  | {
      kind: "request";
      actionLabel: "Add Friend";
      archiveLabel: "Ignore";
    };

export function getFriendRequestPresentation(
  status: FriendRequestRef["status"],
): FriendRequestPresentation {
  switch (status) {
    case "friends":
      return {
        kind: "accepted",
        archiveLabel: "Dismiss",
        statusLabel: "Friends",
      };
    case "pending":
    case "none":
      return {
        kind: "request",
        actionLabel: "Add Friend",
        archiveLabel: "Ignore",
      };
  }
}

export default function FriendRequestEntry({
  notification: { ref },
  onArchive,
}: {
  notification: FriendRequestNotification;
  onArchive: () => void;
}) {
  const orpc = useORPC();
  const friendCreateMutation = useMutation(
    orpc.friends.create.mutationOptions({
      onSuccess: () => onArchive(),
    }),
  );

  if (!ref) return null;
  const presentation = getFriendRequestPresentation(ref.status);

  return (
    <div className="mt-2 flex gap-x-2">
      {presentation.kind === "request" ? (
        <Button
          color="highlight"
          size="small"
          onClick={(e) => {
            e.stopPropagation();
            friendCreateMutation.mutate({ user: ref.userId });
          }}
        >
          {presentation.actionLabel}
        </Button>
      ) : (
        <span className="text-muted inline-flex items-center text-xs font-semibold">
          {presentation.statusLabel}
        </span>
      )}
      <Button
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onArchive();
        }}
      >
        {presentation.archiveLabel}
      </Button>
    </div>
  );
}
