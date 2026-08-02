"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { type Bottle } from "@peated/server/types";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import useAuth from "@peated/web/hooks/useAuth";
import { getAddSimilarBottlePath } from "@peated/web/lib/addBottle";

export default function BottleActions({
  bottle,
}: {
  bottle: Pick<Bottle, "id">;
}) {
  const { user } = useAuth();

  return (
    <Menu as="div" className="menu">
      <MenuButton as={Button} aria-label="More bottle actions">
        <EllipsisVerticalIcon className="h-5 w-5" aria-hidden="true" />
      </MenuButton>
      <MenuItems
        className="absolute right-0 z-40 mt-2 w-48 origin-top-right"
        unmount={false}
      >
        <MenuItem as={Link} href={getAddSimilarBottlePath(bottle.id)}>
          Add a similar bottle
        </MenuItem>
        {user?.mod ? (
          <>
            <MenuItem as={Link} href={`/bottles/${bottle.id}/aliases`}>
              View Aliases
            </MenuItem>
            <MenuItem as={Link} href={`/bottles/${bottle.id}/edit`}>
              Edit Bottle
            </MenuItem>
            <MenuItem as={Link} href={`/bottles/${bottle.id}/merge`}>
              Merge Bottle
            </MenuItem>
            <MenuItem as={Link} href={`/bottles/${bottle.id}/audit`}>
              Audit Bottle
            </MenuItem>
          </>
        ) : null}
      </MenuItems>
    </Menu>
  );
}
