"use client";

import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import type { CollectionBottle, PagingRel } from "@peated/server/types";
import Button from "@peated/web/components/button";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

export default function FavoriteEntryActions({
  entry,
  username,
}: {
  entry: CollectionBottle;
  username: string;
}) {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const entryDeleteMutation = useMutation(
    orpc.collections.bottles.delete.mutationOptions(),
  );
  const listQueryKey = orpc.collections.bottles.list.key({
    input: {
      user: username,
      collection: "default",
    },
  });
  const collectionStatusQueryKey = orpc.collections.bottles.list.key({
    input: {
      user: "me",
      collection: "default",
      bottle: entry.bottle.id,
      release: entry.release?.id ?? undefined,
      baseOnly: entry.release == null,
    },
  });

  async function removeFromFavorites() {
    setError(null);
    try {
      await entryDeleteMutation.mutateAsync({
        bottle: entry.bottle.id,
        release: entry.release?.id ?? null,
        baseOnly: entry.release == null,
        user: "me",
        collection: "default",
      });

      queryClient.setQueryData<{
        results: CollectionBottle[];
        rel: PagingRel;
      }>(listQueryKey, (current) => {
        if (!current) return current;

        return {
          ...current,
          results: current.results.filter((item) => item.id !== entry.id),
        };
      });
      await queryClient.invalidateQueries({
        queryKey: listQueryKey,
        exact: true,
      });
      await queryClient.invalidateQueries({
        queryKey: collectionStatusQueryKey,
      });
    } catch (err) {
      logError(err, { context: "favorite_entry_remove" });
      setError(
        getFormErrorMessage(err, {
          expectedErrorNames: ["BAD_REQUEST", "FORBIDDEN", "NOT_FOUND"],
        }),
      );
    }
  }

  return (
    <div className="min-w-0 shrink-0">
      <Menu as="div" className="menu">
        <MenuButton as={Button} size="small" title="Bottle options">
          <EllipsisVerticalIcon className="h-5 w-5" aria-hidden="true" />
          <span className="sr-only">Bottle options</span>
        </MenuButton>
        <MenuItems
          className="absolute right-0 z-40 mt-2 w-48 origin-top-right"
          unmount={false}
        >
          <MenuItem
            as="button"
            disabled={entryDeleteMutation.isPending}
            onClick={() => void removeFromFavorites()}
          >
            Remove from Favorites
          </MenuItem>
        </MenuItems>
      </Menu>
      {error && (
        <div className="mt-1 text-xs font-medium text-red-300" role="alert">
          {error}
        </div>
      )}
    </div>
  );
}
