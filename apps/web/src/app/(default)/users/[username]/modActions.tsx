"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { type User } from "@peated/server/types";
import Button from "@peated/web/components/button";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";

export default function ModActions({ user }: { user: User }) {
  const { user: currentUser } = useAuth();
  const orpc = useORPC();

  const userUpdateMutation = useMutation(orpc.users.update.mutationOptions());

  if (!currentUser?.admin) return null;

  return (
    <Menu as="div" className="menu">
      <MenuButton as={Button}>
        <EllipsisVerticalIcon className="h-5 w-5" />
      </MenuButton>
      <MenuItems className="absolute right-0 z-40 mt-2 w-64 origin-top-right">
        <MenuItem
          as="button"
          onClick={() => {
            userUpdateMutation.mutate({
              user: user.id,
              mod: !user.mod,
            });
          }}
        >
          {user.mod ? "Remove Moderator Role" : "Add Moderator Role"}
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}
