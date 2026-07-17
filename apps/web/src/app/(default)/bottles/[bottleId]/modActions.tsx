"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { type Bottle } from "@peated/server/types";
import Button from "@peated/web/components/button";
import Link from "@peated/web/components/link";
import useAuth from "@peated/web/hooks/useAuth";

export default function ModActions({ bottle }: { bottle: Bottle }) {
  const { user } = useAuth();

  if (!user?.mod) return null;

  return (
    <Menu as="div" className="menu">
      <MenuButton as={Button}>
        <EllipsisVerticalIcon className="h-5 w-5" />
      </MenuButton>
      <MenuItems
        className="absolute right-0 z-40 mt-2 w-32 origin-top-right"
        unmount={false}
      >
        <MenuItem as={Link} href={`/bottles/${bottle.id}/aliases`}>
          View Aliases
        </MenuItem>
        <MenuItem
          as={Link}
          href={`/bottles/new?${new URLSearchParams({
            series: bottle.series ? `${bottle.series.id}` : "",
            brand: `${bottle.brand.id}`,
            bottler: bottle.bottler ? `${bottle.bottler.id}` : "",
            distiller: bottle.distillers.length
              ? `${bottle.distillers[0].id}`
              : "",
          }).toString()}`}
        >
          Add Similar Bottling
        </MenuItem>
        <MenuItem as={Link} href={`/bottles/${bottle.id}/edit`}>
          Edit Bottle
        </MenuItem>
        <MenuItem as={Link} href={`/bottles/${bottle.id}/merge`}>
          Merge Bottle
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}
