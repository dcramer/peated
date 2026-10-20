"use client";

import { isORPCNotFoundError } from "@peated/orpc/client/errors";
import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useState, type ReactNode } from "react";

import { BottleIdentityRow } from "@peated/web/components/bottleIdentityRow.stylex";
import { IconButton } from "@peated/web/components/button.stylex";
import ConfirmationDialog from "@peated/web/components/confirmationDialog.client";
import {
  EmptyState,
  LoadingList,
} from "@peated/web/components/feedback.stylex";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import { ItemList, ItemListItem } from "@peated/web/components/itemList.stylex";
import { CursorPager } from "@peated/web/components/lists.stylex";
import { PageHeader } from "@peated/web/components/pages/pageLayout.stylex";
import { Timestamp } from "@peated/web/components/timestamp";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  describeTastingDraft,
  getTastingDraftHref,
  type TastingDraft,
} from "@peated/web/lib/tastingDrafts";
import { space } from "../../../styles/tokens.stylex";

export function TastingDraftsPageFrame({ children }: { children: ReactNode }) {
  return (
    <div>
      <PageHeader
        description="Tastings you started and haven't posted yet. Pick one to finish it."
        title="Drafts"
      />
      <div {...stylex.props(styles.list)}>{children}</div>
    </div>
  );
}

export function TastingDraftList({
  drafts: initialDrafts,
  nextHref,
  page,
  previousHref,
}: {
  drafts: TastingDraft[];
  nextHref?: string;
  page: number;
  previousHref?: string;
}) {
  const orpc = useORPC();
  const queryClient = useQueryClient();
  const { flash } = useFlashMessages();
  const [drafts, setDrafts] = useState(initialDrafts);
  const [deleting, setDeleting] = useState<TastingDraft | null>(null);
  const [deleteError, setDeleteError] = useState<string>();
  const deleteMutation = useMutation(
    orpc.tastingDrafts.delete.mutationOptions(),
  );

  async function deleteDraft(draft: TastingDraft) {
    setDeleteError(undefined);
    try {
      await deleteMutation.mutateAsync({ draft: draft.id });
    } catch (error) {
      // Someone already deleted or posted it; either way it is gone.
      if (!isORPCNotFoundError(error)) {
        setDeleteError(
          getFormErrorMessage(error, {
            fallbackMessage: "We couldn't delete that draft. Try again.",
          }),
        );
        return;
      }
    }
    setDrafts((values) => values.filter(({ id }) => id !== draft.id));
    setDeleting(null);
    flash("Draft deleted.", "info");
    // A failed mutation skips the app's refresh after mutations, so update
    // the header count when the draft was already gone.
    await queryClient.invalidateQueries({
      queryKey: orpc.tastingDrafts.count.key(),
    });
  }

  if (!drafts.length) {
    return (
      <EmptyState heading="No drafts">
        Nothing is waiting to be finished.
      </EmptyState>
    );
  }

  return (
    <>
      <ItemList ariaLabel="Drafts">
        {drafts.map((draft) => {
          const { name, status } = describeTastingDraft(draft);
          return (
            <ItemListItem key={draft.id}>
              <BottleIdentityRow
                end={
                  <IconButton
                    disabled={deleteMutation.isPending}
                    icon={<Trash2 aria-hidden="true" size={16} />}
                    label={`Delete draft: ${name}`}
                    onClick={() => {
                      setDeleteError(undefined);
                      setDeleting(draft);
                    }}
                    size="sm"
                    variant="text"
                  />
                }
                href={getTastingDraftHref(draft)}
                imageFit={draft.imageUrl ? "cover" : undefined}
                imageUrl={draft.imageUrl ?? draft.bottle?.imageUrl}
                metadata={[status]}
                name={name}
                subtitle={
                  <>
                    Had <Timestamp date={draft.tastedAt} format="date" />
                  </>
                }
              />
            </ItemListItem>
          );
        })}
      </ItemList>
      <CursorPager
        ariaLabel="Draft pages"
        nextHref={nextHref}
        page={page}
        previousHref={previousHref}
      />
      <ConfirmationDialog
        continueLabel="Delete draft"
        error={deleteError}
        isOpen={deleting !== null}
        message="Its notes and photo are deleted too. This can't be undone."
        onCancel={() => setDeleting(null)}
        onContinue={() => {
          if (deleting) void deleteDraft(deleting);
        }}
        pending={deleteMutation.isPending}
        pendingLabel="Deleting…"
        title="Delete this draft?"
      />
    </>
  );
}

export function TastingDraftListLoading() {
  return <LoadingList label="Loading drafts" rows={4} />;
}

const styles = stylex.create({
  list: { maxWidth: "880px", marginTop: space.x6 },
});
