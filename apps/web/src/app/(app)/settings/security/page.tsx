"use client";

import {
  Button,
  Field,
  FormActions,
  FormNotice,
  FormSection,
  FormStack,
  TextInput,
} from "@peated/web/components/designSystem/components";
import PasskeyManager from "@peated/web/components/passkeyManager";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

export default function SecuritySettingsPage() {
  const orpc = useORPC();
  const updateUser = useMutation(orpc.users.update.mutationOptions());
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
    </FormStack>
  );
}
