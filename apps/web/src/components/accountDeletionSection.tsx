"use client";

import { useState, type ReactNode } from "react";

import { Button } from "@peated/web/components/button.stylex";
import ConfirmationDialog from "@peated/web/components/confirmationDialog.client";
import { FlashMessage, Notice } from "@peated/web/components/feedback.stylex";
import {
  FormActions,
  FormSection,
} from "@peated/web/components/formLayout.stylex";

/** Formats a scheduled deletion time in the member's locale. */
export function formatDeletionDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
}

export type AccountDeletionSectionProps = {
  /** When the pending deletion runs, or null when none is scheduled. */
  deletionScheduledAt?: string | null;
  /** Schedules the deletion. Throw to keep the dialog open with the error. */
  onDelete: () => Promise<void>;
  /** Cancels the pending deletion. Throw to show the error in place. */
  onKeep: () => Promise<void>;
  username: string;
};

/**
 * The danger area in account settings. Before a request it explains what
 * deletion does and asks the member to type their username. While a deletion
 * is pending it shows the date and makes keeping the account the main action.
 */
export function AccountDeletionSection({
  deletionScheduledAt,
  onDelete,
  onKeep,
  username,
}: AccountDeletionSectionProps) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<ReactNode>();
  const [keeping, setKeeping] = useState(false);
  const [keepError, setKeepError] = useState<ReactNode>();
  const [kept, setKept] = useState(false);

  async function confirmDelete() {
    setDeleting(true);
    setDeleteError(undefined);
    try {
      await onDelete();
      setConfirming(false);
      setKept(false);
    } catch (caught) {
      setDeleteError(
        caught instanceof Error && caught.message
          ? caught.message
          : "We couldn't schedule the deletion. Nothing has changed. Try again.",
      );
    } finally {
      setDeleting(false);
    }
  }

  async function keep() {
    setKeeping(true);
    setKeepError(undefined);
    try {
      await onKeep();
      setKept(true);
    } catch (caught) {
      setKeepError(
        caught instanceof Error && caught.message
          ? caught.message
          : "We couldn't cancel the deletion. It's still scheduled. Try again.",
      );
    } finally {
      setKeeping(false);
    }
  }

  return (
    <FormSection
      description="Deleting your account removes your profile, tastings, reviews, comments, and collections. Bottles and catalog edits you added stay, without your name. You'll have 24 hours to change your mind."
      title="Delete account"
      tone="danger"
    >
      {deletionScheduledAt ? (
        <>
          {keepError ? (
            <FlashMessage tone="error">{keepError}</FlashMessage>
          ) : null}
          <Notice
            action={
              <Button
                loading={keeping}
                loadingLabel="Keeping…"
                onClick={() => void keep()}
                variant="accent"
              >
                Keep my account
              </Button>
            }
            heading="Deletion scheduled"
            status="Pending"
            tone="warning"
          >
            Your account will be deleted on{" "}
            {formatDeletionDate(deletionScheduledAt)}. Until then everything
            works as usual, and we've emailed you a confirmation.
          </Notice>
        </>
      ) : (
        <>
          {kept ? (
            <FlashMessage status="Cancelled" tone="success">
              Your account stays. Nothing was deleted.
            </FlashMessage>
          ) : null}
          <FormActions>
            <Button
              onClick={() => {
                setDeleteError(undefined);
                setConfirming(true);
              }}
              variant="danger"
            >
              Delete account
            </Button>
          </FormActions>
        </>
      )}
      <ConfirmationDialog
        confirmation={{
          label: (
            <>
              Type <strong>{username}</strong> to confirm
            </>
          ),
          value: username,
        }}
        continueLabel="Delete my account"
        error={deleteError}
        isOpen={confirming}
        message="We'll delete your account in 24 hours. You can cancel from Settings until then. After that, your profile, tastings, reviews, comments, and collections are gone for good."
        onCancel={() => setConfirming(false)}
        onContinue={() => void confirmDelete()}
        pending={deleting}
        pendingLabel="Scheduling…"
        title="Delete your account?"
      />
    </FormSection>
  );
}
