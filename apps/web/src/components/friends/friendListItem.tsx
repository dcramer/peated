import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import type { Friend, FriendStatus } from "@peated/server/types";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import ListItem from "@peated/web/components/listItem";
import UserAvatar from "@peated/web/components/userAvatar";
import classNames from "@peated/web/lib/classNames";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

function actionLabel(status: FriendStatus) {
  switch (status) {
    case "friends":
      return "Remove Friend";
    case "pending":
      return "Request Sent";
    case "none":
    default:
      return "Add Friend";
  }
}

export default function FriendListItem({ friend }: { friend: Friend }) {
  const [friendStatus, setFriendStatus] = useState<FriendStatus>(friend.status);

  const orpc = useORPC();
  const friendCreateMutation = useMutation(
    orpc.friends.create.mutationOptions({
      onSuccess: ({ status }) => {
        setFriendStatus(status);
      },
    })
  );
  const friendDeleteMutation = useMutation(
    orpc.friends.delete.mutationOptions({
      onSuccess: ({ status }) => {
        setFriendStatus(status);
      },
    })
  );

  if (friendStatus === "none") return null;

  const isPending =
    friendCreateMutation.isPending || friendDeleteMutation.isPending;

  const { user } = friend;

  return (
    <ListItem as="li">
      <div
        className={classNames(
          "flex flex-auto items-center space-x-4",
          isPending ? "opacity-50" : ""
        )}
      >
        <UserAvatar size={48} user={user} />
        <div className="flex-auto space-y-1 font-medium">
          <Link href={`/users/${user.username}`} className="hover:underline">
            {user.username}
          </Link>
        </div>
        <div className="flex items-center gap-x-4">
          <Menu as="div" className="menu">
            <MenuButton as={Button}>
              <EllipsisVerticalIcon className="h-5 w-5" />
            </MenuButton>
            <MenuItems className="absolute right-0 z-40 mt-2 w-48 origin-top-right">
              <MenuItem
                as="button"
                color="primary"
                disabled={isPending}
                onClick={() => {
                  if (isPending) return;
                  if (friendStatus === "friends") {
                    friendDeleteMutation.mutate({
                      user: user.id,
                    });
                  } else {
                    friendCreateMutation.mutate({
                      user: user.id,
                    });
                  }
                }}
              >
                {actionLabel(friendStatus)}
              </MenuItem>
            </MenuItems>
          </Menu>
        </div>
      </div>
    </ListItem>
  );
}
