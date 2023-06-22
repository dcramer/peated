import { useState } from "react";
import useApi from "~/hooks/useApi";
import type { FollowNotification, FollowStatus } from "../../types";
import Button from "../button";

export default ({
  notification: { ref },
  onComplete,
}: {
  notification: FollowNotification;
  onComplete: () => void;
}) => {
  const api = useApi();
  const [theirFollowStatus, setTheirFollowStatus] = useState<FollowStatus>(
    ref.status,
  );
  const [myFollowStatus, setMyFollowStatus] = useState<FollowStatus>(
    ref.followsBack,
  );

  const acceptRequest = async (id: number) => {
    const data = await api.put(`/followers/${id}`, {
      data: { action: "accept" },
    });
    setTheirFollowStatus(data.status);
    onComplete();
  };

  const followUser = async (toUserId: number, follow: boolean) => {
    const data = await api[follow ? "post" : "delete"](
      `/users/${toUserId}/follow`,
    );
    setMyFollowStatus(data.status);
  };

  const followLabel = (status: FollowStatus) => {
    switch (status) {
      case "following":
        return "Unfollow";
      case "pending":
        return "Request Sent";
      case "none":
      default:
        return "Follow Back";
    }
  };

  return (
    <div className="mt-2">
      <Button
        color="highlight"
        size="small"
        onClick={(e) => {
          e.stopPropagation();
          if (theirFollowStatus === "pending") {
            acceptRequest(ref.id);
          } else {
            followUser(ref.user.id, myFollowStatus === "none");
          }
        }}
      >
        {theirFollowStatus === "pending"
          ? "Accept"
          : followLabel(myFollowStatus)}
      </Button>
    </div>
  );
};
