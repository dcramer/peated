"use client";

import { Button } from "@peated/web/components/button.stylex";
import ConfirmationDialog from "@peated/web/components/confirmationDialog.client";
import { Notice } from "@peated/web/components/feedback.stylex";
import { Field, TextInput } from "@peated/web/components/field.stylex";
import {
  FormActions,
  FormNotice,
  FormSection,
  FormStack,
} from "@peated/web/components/formLayout.stylex";
import PasskeyManager from "@peated/web/components/passkeyManager";
import useAuth from "@peated/web/hooks/useAuth";
import { updateSession } from "@peated/web/lib/auth.actions";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { formatDeletionDate } from "../../_components/accountDeletionNotice";

export default function SecuritySettingsPage() {
  const orpc = useORPC();
  const { user, setUser } = useAuth();
  const updateUser = useMutation(orpc.users.update.mutationOptions());
  const deleteAccount = useMutation(orpc.users.delete.mutationOptions());
  const cancelDeletion = useMutation(
    orpc.users.deletionCancel.mutationOptions(),
  );
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();

  async function submitPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(undefined);
    setMessage(undefined);
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    try {
      await updateUser.mutateAsync({ password, user: "me" });
      setPassword("");
      setConfirmation("");
      setMessage("Password updated.");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Unable to update password.",
      );
    }
  }

  async function confirmDeleteAccount() {
    setConfirmingDelete(false);
    setDeleteError(undefined);
    try {
      setUser(await deleteAccount.mutateAsync({ user: "me" }));
    } catch (caught) {
      setDeleteError(
        caught instanceof Error
          ? caught.message
          : "Unable to delete your account.",
      );
      return;
    }
    await updateSession();
  }

  async function keepAccount() {
    setDeleteError(undefined);
    try {
      setUser(await cancelDeletion.mutateAsync({ user: "me" }));
    } catch (caught) {
      setDeleteError(
        caught instanceof Error
          ? caught.message
          : "Unable to cancel the deletion.",
      );
      return;
    }
    await updateSession();
  }

  return (
    <FormStack>
      <form onSubmit={submitPassword}>
        <FormSection
          description="Use a unique password with at least 8 characters."
          title="Password"
        >
          {error ? <FormNotice>{error}</FormNotice> : null}
          {message ? <FormNotice>{message}</FormNotice> : null}
          <Field htmlFor="settings-new-password" label="New password" required>
            <TextInput
              autoComplete="new-password"
              id="settings-new-password"
              minLength={8}
              onChange={(event) => setPassword(event.currentTarget.value)}
              required
              type="password"
              value={password}
            />
          </Field>
          <Field
            htmlFor="settings-confirm-password"
            label="Confirm password"
            required
          >
            <TextInput
              autoComplete="new-password"
              id="settings-confirm-password"
              minLength={8}
              onChange={(event) => setConfirmation(event.currentTarget.value)}
              required
              type="password"
              value={confirmation}
            />
          </Field>
          <FormActions>
            <Button
              loading={updateUser.isPending}
              loadingLabel="Updating…"
              type="submit"
              variant="accent"
            >
              Update password
            </Button>
          </FormActions>
        </FormSection>
      </form>
      <FormSection
        description="Sign in with your fingerprint, face, or device PIN."
        title="Passkeys"
      >
        <PasskeyManager />
      </FormSection>
      <FormSection
        description="Deleting your account removes your profile, tastings, reviews, comments, and collections. You have 24 hours to change your mind."
        title="Delete account"
      >
        {deleteError ? <FormNotice>{deleteError}</FormNotice> : null}
        {user?.deletionScheduledAt ? (
          <Notice
            action={
              <Button
                loading={cancelDeletion.isPending}
                loadingLabel="Cancelling…"
                onClick={() => void keepAccount()}
                size="sm"
                variant="tonal"
              >
                Keep my account
              </Button>
            }
            tone="warning"
          >
            Your account will be deleted on{" "}
            {formatDeletionDate(user.deletionScheduledAt)}.
          </Notice>
        ) : (
          <FormActions>
            <Button
              loading={deleteAccount.isPending}
              loadingLabel="Scheduling…"
              onClick={() => setConfirmingDelete(true)}
              variant="danger"
            >
              Delete account
            </Button>
          </FormActions>
        )}
      </FormSection>
      <ConfirmationDialog
        continueLabel="Delete my account"
        isOpen={confirmingDelete}
        message="Your account and everything you added will be deleted in 24 hours. You can cancel from this page until then."
        onCancel={() => setConfirmingDelete(false)}
        onContinue={() => void confirmDeleteAccount()}
        title="Delete your account?"
      />
    </FormStack>
  );
}
