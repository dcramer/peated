"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import type { Flight } from "@peated/server/types";
import Button from "@peated/web/components/button";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import Link from "@peated/web/components/link";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

export default function ModActions({ flight }: { flight: Flight }) {
  const { user } = useAuth();
  const orpc = useORPC();
  const navigate = useNavigate();

  const deleteFlightMutation = useMutation(
    orpc.flights.delete.mutationOptions()
  );

  if (!user?.mod && user?.id !== flight.createdBy?.id) return null;

  const deleteFlight = async () => {
    // TODO: show confirmation message
    await deleteFlightMutation.mutateAsync({ flight: flight.id });
    navigate({ to: "/flights" });
  };

  return (
    <Menu as="div" className="menu">
      <MenuButton as={Button}>
        <EllipsisVerticalIcon className="h-5 w-5" />
      </MenuButton>
      <MenuItems className="absolute right-0 z-40 mt-2 w-32 origin-top-right lg:left-0 lg:origin-top-left">
        <MenuItem as={Link} href={`/flights/${flight.id}/edit`}>
          Edit Flight
        </MenuItem>
        {user?.admin && (
          <MenuItem
            as={ConfirmationButton}
            onContinue={deleteFlight}
            disabled={deleteFlightMutation.isPending}
          >
            Delete Flight
          </MenuItem>
        )}
      </MenuItems>
    </Menu>
  );
}
