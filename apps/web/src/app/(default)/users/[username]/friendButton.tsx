"use client";

import { type User } from "@peated/server/types";
import Button from "@peated/web/components/button";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function FriendButton({ user }: { user: User }) {
  const [friendStatus, setFriendStatus] = useState(user.friendStatus);

  const orpc = useORPC();
  const queryClient = useQueryClient();

  const friendCreateMutation = useMutation({
    ...orpc.friends.create.mutationOptions(),
    onSuccess: (data, mutationInput) => {
      queryClient.setQueryData(
        orpc.users.details.key({ input: { user: mutationInput.user } }),
        (oldData: any) =>
          oldData
            ? {
                ...oldData,
                friendStatus: data.status,
              }
            : oldData,
      );
      setFriendStatus(data.status);
    },
  });

  const friendDeleteMutation = useMutation({
    ...orpc.friends.delete.mutationOptions(),
    onSuccess: (data, mutationInput) => {
      queryClient.setQueryData(
        orpc.users.details.key({ input: { user: mutationInput.user } }),
        (oldData: any) =>
          oldData
            ? {
                ...oldData,
                friendStatus: data.status,
              }
            : oldData,
      );
      setFriendStatus("none");
    },
  });

  return (
    <Button
      color="primary"
      onClick={() => {
        if (friendStatus === "none")
          friendCreateMutation.mutate({ user: user.id });
        else friendDeleteMutation.mutate({ user: user.id });
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
