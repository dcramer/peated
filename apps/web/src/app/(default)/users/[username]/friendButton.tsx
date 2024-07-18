"use client";

import { type User } from "@peated/server/types";
import Button from "@peated/web/components/button";
import { trpc } from "@peated/web/lib/trpc/client";
import { useState } from "react";

export default function FriendButton({ user }: { user: User }) {
  const [friendStatus, setFriendStatus] = useState(user.friendStatus);

  const trpcUtils = trpc.useUtils();
  const friendCreateMutation = trpc.friendCreate.useMutation({
    onSuccess: (data, toUserId) => {
      const previous = trpcUtils.userById.getData(toUserId);
      if (previous) {
        trpcUtils.userById.setData(toUserId, {
          ...previous,
          friendStatus: data.status,
        });
      }
      setFriendStatus(data.status);
    },
  });
  const friendDeleteMutation = trpc.friendDelete.useMutation({
    onSuccess: (data, toUserId) => {
      const previous = trpcUtils.userById.getData(toUserId);
      if (previous) {
        trpcUtils.userById.setData(toUserId, {
          ...previous,
          friendStatus: data.status,
        });
      }
      setFriendStatus("none");
    },
  });

  return (
    <Button
      color="primary"
      onClick={() => {
        if (friendStatus === "none") friendCreateMutation.mutate(user.id);
        else friendDeleteMutation.mutate(user.id);
      }}
    >
      {friendStatus === "none"
        ? "Add Friend"
        : friendStatus === "pending"
          ? "Request Pending"
          : "Remove Friend"}
    </Button>
  );
}
