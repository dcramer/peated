"use client";

import type { Outputs } from "@peated/server/orpc/router";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { ReportContentDialog } from "@peated/web/components/reportContentDialog";
import {
  RowMenu,
  type RowMenuItem,
} from "@peated/web/components/rowMenu.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";

type Tasting = Outputs["tastings"]["details"];

export function TastingActions({ tasting }: { tasting: Tasting }) {
  const { user } = useAuth();
  const orpc = useORPC();
  const router = useRouter();
  const { flash } = useFlashMessages();
  const deleteMutation = useMutation(orpc.tastings.delete.mutationOptions());
  const [reporting, setReporting] = useState(false);

  if (!user) return null;
  const isOwner = user.id === tasting.createdBy.id;
  const canDelete = isOwner || Boolean(user.admin || user.mod);

  const manage: RowMenuItem[] = [];
  if (isOwner) {
    manage.push({
      href: `/tastings/${tasting.id}/edit`,
      label: "Edit tasting",
    });
  }
  if (canDelete) {
    manage.push({
      disabled: deleteMutation.isPending,
      label: deleteMutation.isPending ? "Deleting tasting…" : "Delete tasting",
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
            router.replace(`/users/${tasting.createdBy.username}/tastings`),
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
    });
  }

  const groups: RowMenuItem[][] = [];
  if (!isOwner) {
    groups.push([
      { label: "Report tasting", onSelect: () => setReporting(true) },
    ]);
  }
  if (manage.length) groups.push(manage);

  return (
    <>
      <RowMenu groups={groups} label="Tasting" triggerVariant="text" />
      <ReportContentDialog
        isOpen={reporting}
        onClose={() => setReporting(false)}
        subject="this tasting"
        target={{ objectType: "tasting", objectId: tasting.id }}
      />
    </>
  );
}
