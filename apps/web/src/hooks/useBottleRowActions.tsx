"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import type { RowMenuItem } from "@peated/web/components";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { getAddBottleHref } from "@peated/web/lib/addBottle";
import { useORPC } from "@peated/web/lib/orpc/context";

import useAuth from "./useAuth";

type Bottle = Outputs["bottles"]["list"]["results"][number];
type BottleActionTarget = Pick<Bottle, "id" | "isLibrary">;

export type BottleRowActionControls = {
  groupsFor: (bottle: BottleActionTarget) => RowMenuItem[][];
  isLibrary: (bottle: BottleActionTarget) => boolean;
};

export function getBottleRowActionGroups({
  bottle,
  changePending,
  isLibrary,
  isLoggedIn,
  onLibraryToggle,
  thisBottlePending,
}: {
  bottle: Pick<Bottle, "id">;
  changePending: boolean;
  isLibrary: boolean;
  isLoggedIn: boolean;
  onLibraryToggle: () => void;
  thisBottlePending: boolean;
}): RowMenuItem[][] {
  const libraryAction: RowMenuItem = isLoggedIn
    ? {
        disabled: changePending,
        label: thisBottlePending
          ? isLibrary
            ? "Removing from Library…"
            : "Adding to Library…"
          : isLibrary
            ? "Remove from Library"
            : "Add to Library",
        onSelect: onLibraryToggle,
      }
    : {
        href: getAddBottleHref({
          bottleId: bottle.id,
          intent: "library",
        }),
        label: "Add to Library",
      };

  return [
    [
      {
        href: getAddBottleHref({
          bottleId: bottle.id,
          intent: "tasting",
        }),
        label: "Log a tasting",
      },
    ],
    [libraryAction],
  ];
}

export default function useBottleRowActions(): BottleRowActionControls {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { flash } = useFlashMessages();
  const [libraryOverrides, setLibraryOverrides] = useState<
    Record<number, boolean>
  >({});
  const [pendingBottleId, setPendingBottleId] = useState<number>();
  const addMutation = useMutation(
    orpc.collections.bottles.create.mutationOptions(),
  );
  const removeMutation = useMutation(
    orpc.collections.bottles.delete.mutationOptions(),
  );
  const changePending = addMutation.isPending || removeMutation.isPending;

  function isLibrary(bottle: BottleActionTarget) {
    return libraryOverrides[bottle.id] ?? bottle.isLibrary;
  }

  async function toggleLibrary(bottle: BottleActionTarget) {
    if (!user || pendingBottleId !== undefined) return;

    const current = isLibrary(bottle);
    setPendingBottleId(bottle.id);
    try {
      if (current) {
        await removeMutation.mutateAsync({
          bottle: bottle.id,
          collection: "library",
          user: "me",
        });
      } else {
        await addMutation.mutateAsync({
          bottle: bottle.id,
          collection: "library",
          user: "me",
        });
      }

      setLibraryOverrides((values) => ({
        ...values,
        [bottle.id]: !current,
      }));
      flash(current ? "Removed from your Library." : "Added to your Library.");
      void queryClient.invalidateQueries({
        queryKey: orpc.bottles.list.key({ type: "query" }),
      });
      void queryClient.invalidateQueries({
        queryKey: orpc.collections.bottles.list.key({ type: "query" }),
      });
      void queryClient.invalidateQueries({
        queryKey: orpc.users.libraryStats.key({ type: "query" }),
      });
    } catch {
      flash(
        current
          ? "We couldn't remove this bottle from your Library. Try again."
          : "We couldn't add this bottle to your Library. Try again.",
        "error",
      );
    } finally {
      setPendingBottleId(undefined);
    }
  }

  return {
    groupsFor: (bottle) =>
      getBottleRowActionGroups({
        bottle,
        changePending,
        isLibrary: isLibrary(bottle),
        isLoggedIn: Boolean(user),
        onLibraryToggle: () => void toggleLibrary(bottle),
        thisBottlePending: pendingBottleId === bottle.id,
      }),
    isLibrary,
  };
}
