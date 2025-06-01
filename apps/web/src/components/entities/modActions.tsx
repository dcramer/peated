"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import type { Entity } from "@peated/server/types";
import Button from "@peated/web/components/button";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import { Link } from "@tanstack/react-router";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

export default function ModActions({ entity }: { entity: Entity }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const orpc = useORPC();

  const deleteEntityMutation = useMutation(
    orpc.entities.delete.mutationOptions()
  );

  if (!user?.mod) return null;

  const deleteEntity = async () => {
    // TODO: show confirmation message
    await deleteEntityMutation.mutateAsync({
      entity: entity.id,
    });
    navigate({ to: "/entities" });
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
        <MenuItem as={Link} to={`/entities/${entity.id}/aliases`}>
          View Aliases
        </MenuItem>
        <MenuItem as={Link} to={`/entities/${entity.id}/edit`}>
          Edit Entity
        </MenuItem>
        <MenuItem as={Link} to={`/entities/${entity.id}/merge`}>
          Merge Entity
        </MenuItem>
        {user.admin && (
          <MenuItem
            as={ConfirmationButton}
            onContinue={deleteEntity}
            disabled={deleteEntityMutation.isPending}
          >
            Delete Entity
          </MenuItem>
        )}
      </MenuItems>
    </Menu>
  );
}
