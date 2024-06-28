import { Menu } from "@headlessui/react";
import { AtSymbolIcon, EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { type Friend, type FriendStatus } from "@peated/server/types";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import ListItem from "@peated/web/components/listItem";
import UserAvatar from "@peated/web/components/userAvatar";
import classNames from "@peated/web/lib/classNames";
import { trpc } from "@peated/web/lib/trpc";
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

  const friendCreateMutation = trpc.friendCreate.useMutation({
    onSuccess: ({ status }) => {
      setFriendStatus(status);
    },
  });
  const friendDeleteMutation = trpc.friendDelete.useMutation({
    onSuccess: ({ status }) => {
      setFriendStatus(status);
    },
  });

  if (friendStatus === "none") return null;

  const isPending =
    friendCreateMutation.isPending || friendDeleteMutation.isPending;

  const { user } = friend;

  return (
    <ListItem as="li">
      <div
        className={classNames(
          "flex flex-auto items-center space-x-4",
          isPending ? "opacity-50" : "",
        )}
      >
        <UserAvatar size={48} user={user} />
        <div className="flex-auto space-y-1 font-medium">
          <Link href={`/users/${user.username}`} className="hover:underline">
            {user.displayName}
          </Link>
          <div className="text-light flex items-center text-sm">
            <AtSymbolIcon className="inline h-3 w-3" />
            {user.username}
          </div>
        </div>
        <div className="flex items-center gap-x-4">
          <Menu as="div" className="menu">
            <Menu.Button as={Button}>
              <EllipsisVerticalIcon className="h-5 w-5" />
            </Menu.Button>
            <Menu.Items className="absolute right-0 z-40 mt-2 w-48 origin-top-right">
              <Menu.Item
                as="button"
                color="primary"
                disabled={isPending}
                onClick={() => {
                  if (isPending) return;
                  if (friendStatus === "friends") {
                    friendDeleteMutation.mutate(user.id);
                  } else {
                    friendCreateMutation.mutate(user.id);
                  }
                }}
              >
                {actionLabel(friendStatus)}
              </Menu.Item>
            </Menu.Items>
          </Menu>
        </div>
      </div>
    </ListItem>
  );
}
