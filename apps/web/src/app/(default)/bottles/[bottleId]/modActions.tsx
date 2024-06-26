"use client";

import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { type Bottle } from "@peated/server/types";
import Button from "@peated/web/components/button";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import useAuth from "@peated/web/hooks/useAuth";
import { trpc } from "@peated/web/lib/trpc";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function ModActions({ bottle }: { bottle: Bottle }) {
  const { user } = useAuth();

  const router = useRouter();

  const deleteBottleMutation = trpc.bottleDelete.useMutation();

  if (!user?.mod) return null;

  const deleteBottle = async () => {
    // TODO: show confirmation message
    await deleteBottleMutation.mutateAsync(bottle.id);
    router.push("/");
  };

  return (
    <Menu as="div" className="menu">
      <Menu.Button as={Button}>
        <EllipsisVerticalIcon className="h-5 w-5" />
      </Menu.Button>
      <Menu.Items
        className="absolute right-0 z-40 mt-2 w-32 origin-top-right"
        unmount={false}
      >
        <Menu.Item as={Link} href={`/bottles/${bottle.id}/aliases`}>
          View Aliases
        </Menu.Item>
        <Menu.Item as={Link} href={`/bottles/${bottle.id}/edit`}>
          Edit Bottle
        </Menu.Item>
        <Menu.Item as={Link} href={`/bottles/${bottle.id}/merge`}>
          Merge Bottle
        </Menu.Item>
        {user?.admin && (
          <Menu.Item
            as={ConfirmationButton}
            onContinue={deleteBottle}
            disabled={deleteBottleMutation.isPending}
          >
            Delete Bottle
          </Menu.Item>
        )}
      </Menu.Items>
    </Menu>
  );
}
