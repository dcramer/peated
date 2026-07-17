"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { type BottleRelease } from "@peated/server/types";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import useAuth from "@peated/web/hooks/useAuth";
import { getBottleBottlingEditPath } from "@peated/web/lib/bottlings";

export default function ModActions({ release }: { release: BottleRelease }) {
  const { user } = useAuth();

  if (!user?.mod) return null;

  return (
    <Menu as="div" className="menu">
      <MenuButton as={Button} size="small">
        <EllipsisVerticalIcon className="h-5 w-5" />
      </MenuButton>
      <MenuItems
        className="absolute right-0 z-40 mt-2 w-32 origin-top-right"
        unmount={false}
      >
        <MenuItem
          as={Link}
          href={getBottleBottlingEditPath(release.bottleId, release.id)}
        >
          Edit
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}
