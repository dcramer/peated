"use client";

import type { FriendStatus } from "@peated/server/types";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import type { FriendRequestNotification } from "../../types";
import Button from "../button";

export default function FriendRequestEntry({
  notification: { ref },
  onArchive,
  onMarkRead,
}: {
  notification: FriendRequestNotification;
  onArchive: () => void;
  onMarkRead: () => void;
}) {
  const orpc = useORPC();
  const friendCreateMutation = useMutation(
    orpc.friends.create.mutationOptions({
      onSuccess: () => onArchive(),
    })
  );

  const actionLabel = (status: FriendStatus) => {
    switch (status) {
      case "friends":
        return "Remove Friend";
      case "pending":
      case "none":
      default:
        return "Add Friend";
    }
  };

  return (
    <div className="mt-2 flex gap-x-2">
      <Button
        color="highlight"
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          friendCreateMutation.mutate({ user: ref.user.id });
        }}
      >
        {actionLabel(ref.status)}
      </Button>
      <Button
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          onArchive();
        }}
      >
        Ignore
      </Button>
    </div>
  );
}
