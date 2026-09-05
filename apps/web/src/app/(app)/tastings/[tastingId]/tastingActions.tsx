"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { RowMenu } from "@peated/web/components";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";

type Tasting = Outputs["tastings"]["details"];

export function TastingActions({ tasting }: { tasting: Tasting }) {
  const { user } = useAuth();
  const orpc = useORPC();
  const router = useRouter();
  const { flash } = useFlashMessages();
  const deleteMutation = useMutation(orpc.tastings.delete.mutationOptions());

  const isOwner = user?.id === tasting.createdBy.id;
  if (!isOwner && !user?.admin) return null;

  return (
    <RowMenu
      groups={[
        ...(isOwner
          ? [
              [
                {
                  href: `/tastings/${tasting.id}/edit`,
                  label: "Edit tasting",
                },
              ],
            ]
          : []),
        [
          {
            disabled: deleteMutation.isPending,
            label: deleteMutation.isPending
              ? "Deleting tasting…"
              : "Delete tasting",
            onSelect: () => {
              if (
                !window.confirm(
                  "Permanently delete this tasting? This cannot be undone.",
                )
              ) {
                return;
              }
              void deleteMutation
                .mutateAsync({ tasting: tasting.id })
                .then(() =>
                  router.replace(
                    `/users/${tasting.createdBy.username}/tastings`,
                  ),
                )
                .catch((error) => {
                  flash(
                    error instanceof Error
                      ? error.message
                      : "Unable to delete this tasting.",
                    "error",
                  );
                });
            },
          },
        ],
      ]}
      label="Tasting"
      triggerVariant="text"
    />
  );
}
