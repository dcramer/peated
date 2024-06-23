"use client";

import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { type User } from "@peated/server/types";
import Button from "@peated/web/components/button";
import useAuth from "@peated/web/hooks/useAuth";
import { trpc } from "@peated/web/lib/trpc";

export default function ModActions({ user }: { user: User }) {
  const { user: currentUser } = useAuth();

  const trpcUtils = trpc.useUtils();

  const userUpdateMutation = trpc.userUpdate.useMutation({
    onSuccess: (data, input) => {
      const previous = trpcUtils.userById.getData(input.user);
      if (previous) {
        const newUser = {
          ...previous,
          ...data,
        };
        trpcUtils.userById.setData(input.user, newUser);
        if (data.id === currentUser?.id)
          trpcUtils.userById.setData("me", newUser);
      }
    },
  });

  if (!currentUser?.admin) return null;

  return (
    <Menu as="div" className="menu">
      <Menu.Button as={Button}>
        <EllipsisVerticalIcon className="h-5 w-5" />
      </Menu.Button>
      <Menu.Items className="absolute right-0 z-10 mt-2 w-64 origin-top-right">
        <Menu.Item
          as="button"
          onClick={() => {
            userUpdateMutation.mutate({
              user: user.id,
              mod: !user.mod,
            });
          }}
        >
          {user.mod ? "Remove Moderator Role" : "Add Moderator Role"}
        </Menu.Item>
      </Menu.Items>
    </Menu>
  );
}
