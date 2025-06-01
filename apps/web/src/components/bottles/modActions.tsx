"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import type { Bottle } from "@peated/server/types";
import Button from "@peated/web/components/button";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { useNavigate } from "@tanstack/react-router";

export default function ModActions({ bottle }: { bottle: Bottle }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const orpc = useORPC();

  const deleteBottleMutation = useMutation(
    orpc.bottles.delete.mutationOptions()
  );

  if (!user?.mod) return null;

  const deleteBottle = async () => {
    // TODO: show confirmation message
    await deleteBottleMutation.mutateAsync({
      bottle: bottle.id,
    });
    navigate({ to: "/bottles" });
  };

  return (
    <Menu as="div" className="menu">
      <MenuButton as={Button}>
        <EllipsisVerticalIcon className="h-5 w-5" />
      </MenuButton>
      <MenuItems
        className="absolute right-0 z-40 mt-2 w-32 origin-top-right"
        unmount={false}
      >
        <MenuItem
          as={Link}
          to="/bottles/$bottleId/aliases"
          params={{ bottleId: bottle.id }}
        >
          View Aliases
        </MenuItem>
        <MenuItem
          as={Link}
          to="/addBottle"
          search={{
            series: bottle.series ? String(bottle.series.id) : undefined,
            brand: String(bottle.brand.id),
            bottler: bottle.bottler ? String(bottle.bottler.id) : undefined,
            distiller: bottle.distillers.length
              ? String(bottle.distillers[0].id)
              : undefined,
          }}
        >
          Add Similar Release
        </MenuItem>
        <MenuItem
          as={Link}
          to="/bottles/$bottleId/edit"
          params={{ bottleId: bottle.id }}
        >
          Edit Bottle
        </MenuItem>
        <MenuItem
          as={Link}
          to="/bottles/$bottleId/merge"
          params={{ bottleId: bottle.id }}
        >
          Merge Bottle
        </MenuItem>
        {user?.admin && (
          <MenuItem
            as={ConfirmationButton}
            onContinue={deleteBottle}
            disabled={deleteBottleMutation.isPending}
          >
            Delete Bottle
          </MenuItem>
        )}
      </MenuItems>
    </Menu>
  );
}
