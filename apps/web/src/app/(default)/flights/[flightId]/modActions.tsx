"use client";

import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { type Flight } from "@peated/server/types";
import Button from "@peated/web/components/button";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import Link from "@peated/web/components/link";
import useAuth from "@peated/web/hooks/useAuth";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter } from "next/navigation";

export default function ModActions({ flight }: { flight: Flight }) {
  const { user } = useAuth();

  const router = useRouter();

  const deleteFlightMutation = trpc.flightDelete.useMutation();

  if (!user?.mod && user?.id !== flight.createdBy?.id) return null;

  const deleteFlight = async () => {
    // TODO: show confirmation message
    await deleteFlightMutation.mutateAsync(flight.id);
    router.push("/");
  };

  return (
    <Menu as="div" className="menu">
      <Menu.Button as={Button}>
        <EllipsisVerticalIcon className="h-5 w-5" />
      </Menu.Button>
      <Menu.Items className="absolute right-0 z-40 mt-2 w-32 origin-top-right lg:left-0 lg:origin-top-left">
        <Menu.Item as={Link} href={`/flights/${flight.id}/edit`}>
          Edit Flight
        </Menu.Item>
        {user?.admin && (
          <Menu.Item
            as={ConfirmationButton}
            onContinue={deleteFlight}
            disabled={deleteFlightMutation.isPending}
          >
            Delete Flight
          </Menu.Item>
        )}
      </Menu.Items>
    </Menu>
  );
}
