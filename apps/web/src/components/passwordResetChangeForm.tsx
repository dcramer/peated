"use client";

import Button from "@peated/web/components/button";
import TextField from "@peated/web/components/textField";
import {
  passwordResetConfirmForm,
  passwordResetConfirmPasskeyForm,
} from "@peated/web/lib/auth.actions";
import { useORPC } from "@peated/web/lib/orpc/context";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Lock } from "lucide-react";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Alert from "./alert";

function PasswordFormComponent({ token }: { token: string }) {
  const { pending } = useFormStatus();

  return (
    <>
      <div className="-mx-4 -mt-4">
        <input type="hidden" name="token" value={token} />
        <TextField
          name="password"
          label="New Password"
          type="password"
          autoComplete="new-password"
          required
          placeholder="************"
          autoFocus
        />
      </div>
      <div className="flex justify-center gap-x-2">
        <Button type="submit" color="highlight" fullWidth loading={pending}>
          Set Password & Continue
        </Button>
      </div>
    </>
  );
}

export default function PasswordResetChangeForm({ token }: { token: string }) {
  const orpc = useORPC();
  const [result, formAction] = useFormState(
    passwordResetConfirmForm,
    undefined,
  );
  const [passkeyResult, passkeyFormAction] = useFormState(
    passwordResetConfirmPasskeyForm,
    undefined,
  );
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [passkeyError, setPasskeyError] = useState<string | null>(null);

  const challengeMutation = useMutation(
    orpc.auth.recovery.challenge.mutationOptions(),
  );

  const handlePasskeyRecovery = async () => {
    setPasskeyLoading(true);
    setPasskeyError(null);

    try {
      // Get WebAuthn challenge from server
      const { options, signedChallenge } = await challengeMutation.mutateAsync({
        token,
      });

      // Start WebAuthn registration
      const response = await startRegistration(options);

      // Prepare form data for server action
      const formData = new FormData();
      formData.append("token", token);
      formData.append("passkeyResponse", JSON.stringify(response));
      formData.append("signedChallenge", signedChallenge);

      await passkeyFormAction(formData);
    } catch (err: any) {
      console.error("Passkey recovery error:", err);

      // Check if user cancelled the passkey prompt
      if (err.name === "NotAllowedError" || err.message?.includes("cancel")) {
        setPasskeyLoading(false);
        return;
      }

      // Check for invalid token error
      if (err.message?.includes("Invalid verification token")) {
        setPasskeyError("invalid_token");
      } else {
        setPasskeyError(
          err.message || "Failed to recover account with passkey",
        );
      }
      setPasskeyLoading(false);
    }
  };

  const isRecovered = result?.ok || passkeyResult?.ok;
  const error = result?.error || passkeyResult?.error || passkeyError;
  const isInvalidToken =
    error === "invalid_token" || error?.includes("Invalid verification token");

  return (
    <div className="min-w-sm flex flex-auto flex-col gap-y-4">
      {error && !isInvalidToken && <Alert>{error}</Alert>}
      {isInvalidToken && (
        <Alert>
          This recovery link has expired or is invalid.{" "}
          <a href="/recover-account" className="text-highlight underline">
            Request a new one
          </a>
          .
        </Alert>
      )}
      {isInvalidToken ? null : isRecovered ? (
        <>
          <p className="mb-8 text-center">Your account has been recovered.</p>
          <div className="flex flex-col gap-y-2">
            <Button href="/settings/security" color="highlight" fullWidth>
              Manage Passkeys
            </Button>
            <Button href="/" color="primary" fullWidth>
              Return to Peated
            </Button>
          </div>
        </>
      ) : showPasswordForm ? (
        <>
          <div className="mb-4 text-center">
            <button
              type="button"
              onClick={() => setShowPasswordForm(false)}
              className="text-highlight text-sm underline"
            >
              ← Back to other options
            </button>
          </div>

          <form action={formAction}>
            <PasswordFormComponent token={token} />
          </form>
        </>
      ) : (
        <>
          <Button
            fullWidth
            color="highlight"
            onClick={handlePasskeyRecovery}
            loading={passkeyLoading}
          >
            <KeyRound className="mr-2 h-4 w-4" />
            Add a New Passkey
          </Button>
          <Button
            fullWidth
            color="primary"
            onClick={() => setShowPasswordForm(true)}
          >
            <Lock className="mr-2 h-4 w-4" />
            Set a Password
          </Button>
        </>
      )}
    </div>
  );
}
