"use client";

import type { Entity } from "@peated/server/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { useORPC } from "@peated/web/lib/orpc/context";

export default function useEntityFollowing() {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { flash } = useFlashMessages();
  const [overrides, setOverrides] = useState<Record<number, boolean>>({});
  const [pendingIds, setPendingIds] = useState<ReadonlySet<number>>(
    () => new Set(),
  );
  const followMutation = useMutation(orpc.entities.follow.mutationOptions());
  const unfollowMutation = useMutation(
    orpc.entities.unfollow.mutationOptions(),
  );
  function isFollowing(entity: Pick<Entity, "id" | "isFollowing">) {
    return overrides[entity.id] ?? entity.isFollowing;
  }

  async function toggle(entity: Pick<Entity, "id" | "isFollowing">) {
    const current = isFollowing(entity);
    setPendingIds((ids) => new Set(ids).add(entity.id));

    try {
      if (current) {
        await unfollowMutation.mutateAsync({ entity: entity.id });
      } else {
        await followMutation.mutateAsync({ entity: entity.id });
      }
      setOverrides((values) => ({ ...values, [entity.id]: !current }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: orpc.entities.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.brands.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.bottlers.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.distilleries.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.bottles.key() }),
        queryClient.invalidateQueries({ queryKey: orpc.search.key() }),
      ]);
    } catch (error) {
      flash(
        error instanceof Error
          ? error.message
          : "We couldn't update this follow. Try again.",
        "error",
      );
    } finally {
      setPendingIds((ids) => {
        const nextIds = new Set(ids);
        nextIds.delete(entity.id);
        return nextIds;
      });
    }
  }

  return { isFollowing, pendingIds, toggle };
}
