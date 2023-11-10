import type { FriendStatus } from "@peated/server/types";
import { trpc } from "~/lib/trpc";
import type { FriendRequestNotification } from "../../types";
import Button from "../button";

export default ({
  notification: { ref },
  onArchive,
  onMarkRead,
}: {
  notification: FriendRequestNotification;
  onArchive: () => void;
  onMarkRead: () => void;
}) => {
  const friendCreateMutation = trpc.friendCreate.useMutation({
    onSuccess: () => onArchive(),
  });

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
          friendCreateMutation.mutate(ref.user.id);
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
};
