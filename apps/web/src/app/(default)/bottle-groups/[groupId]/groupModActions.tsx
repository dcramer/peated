"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import useAuth from "@peated/web/hooks/useAuth";

export default function GroupModActions({
  groupId,
  totalBottles,
}: {
  groupId: number;
  totalBottles: number;
}) {
  const { user } = useAuth();

  if (!user?.mod && !user?.admin) return null;

  return (
    <Menu as="div" className="menu">
      <MenuButton as={Button} aria-label="Bottle group actions">
        <EllipsisVerticalIcon className="h-5 w-5" />
      </MenuButton>
      <MenuItems
        className="absolute right-0 z-40 mt-2 w-44 origin-top-right"
        unmount={false}
      >
        <MenuItem as={Link} href={`/bottle-groups/${groupId}/merge`}>
          Merge expression
        </MenuItem>
        {totalBottles > 1 && (
          <MenuItem as={Link} href={`/bottle-groups/${groupId}/split`}>
            Split releases
          </MenuItem>
        )}
      </MenuItems>
    </Menu>
  );
}
