import type { FriendStatus } from "@peated/core/types";
import useApi from "~/hooks/useApi";
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
  const api = useApi();

  const acceptRequest = (toUserId: number) => {
    // fire and forget
    api.post(`/friends/${toUserId}`);
    onArchive();
  };

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
          acceptRequest(ref.user.id);
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
