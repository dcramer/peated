"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { type BottleRelease } from "@peated/server/types";
import Button from "@peated/web/components/button";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import Link from "@peated/web/components/link";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

export default function ModActions({ release }: { release: BottleRelease }) {
  const { user } = useAuth();
  const router = useRouter();
  const orpc = useORPC();

  const deleteBottleReleaseMutation = useMutation(
    orpc.bottleReleases.delete.mutationOptions(),
  );

  if (!user?.mod) return null;

  const deleteRelease = async () => {
    // TODO: show confirmation message
    await deleteBottleReleaseMutation.mutateAsync({
      release: release.id,
    });
    router.refresh();
  };

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
          href={`/bottles/${release.bottleId}/releases/${release.id}/edit`}
        >
          Edit
        </MenuItem>
        {user?.admin && (
          <MenuItem
            as={ConfirmationButton}
            onContinue={deleteRelease}
            disabled={deleteBottleReleaseMutation.isPending}
          >
            Delete
          </MenuItem>
        )}
      </MenuItems>
    </Menu>
  );
}
