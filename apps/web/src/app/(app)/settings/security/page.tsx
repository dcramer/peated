"use client";

import { AccountDeletionSection } from "@peated/web/components/accountDeletionSection";
import { Button } from "@peated/web/components/button.stylex";
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

  async function scheduleDeletion() {
    setUser(await deleteAccount.mutateAsync({ user: "me" }));
    await updateSession();
  }

  async function keepAccount() {
    setUser(await cancelDeletion.mutateAsync({ user: "me" }));
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
      {user ? (
        <AccountDeletionSection
          deletionScheduledAt={user.deletionScheduledAt}
          onDelete={scheduleDeletion}
          onKeep={keepAccount}
          username={user.username}
        />
      ) : null}
    </FormStack>
  );
}
