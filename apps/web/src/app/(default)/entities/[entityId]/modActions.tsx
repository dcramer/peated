"use client";

import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { type Entity } from "@peated/server/types";
import Button from "@peated/web/components/button";
import ConfirmationButton from "@peated/web/components/confirmationButton";
import Link from "@peated/web/components/link";
import useAuth from "@peated/web/hooks/useAuth";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter } from "next/navigation";

export default function ModActions({ entity }: { entity: Entity }) {
  const { user } = useAuth();

  const router = useRouter();

  const deleteEntityMutation = trpc.entityDelete.useMutation();

  if (!user?.mod) return null;

  const deleteEntity = async () => {
    // TODO: show confirmation message
    await deleteEntityMutation.mutateAsync(entity.id);
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
        <Menu.Item as={Link} href={`/entities/${entity.id}/aliases`}>
          View Aliases
        </Menu.Item>
        <Menu.Item as={Link} href={`/entities/${entity.id}/edit`}>
          Edit Entity
        </Menu.Item>
        <Menu.Item as={Link} href={`/entities/${entity.id}/merge`}>
          Merge Entity
        </Menu.Item>
        {user.admin && (
          <Menu.Item
            as={ConfirmationButton}
            onContinue={deleteEntity}
            disabled={deleteEntityMutation.isPending}
          >
            Delete Entity
          </Menu.Item>
        )}
      </Menu.Items>
    </Menu>
  );
}
