"use client";

import {
  Button,
  ButtonLink,
  Field,
  TextInput,
} from "@peated/web/components/designSystem/components";
import {
  AuthActionStack,
  AuthDivider,
  AuthFooterLinks,
  AuthFormSurface,
  AuthLink,
  AuthNotice,
  AuthPanel,
  AuthTextButton,
} from "@peated/web/components/designSystem/patterns/authShell.stylex";
import {
  passwordResetConfirmForm,
  passwordResetConfirmPasskeyForm,
} from "@peated/web/lib/auth.actions";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { KeyRound, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

function PasswordFields({ token }: { token: string }) {
  const { pending } = useFormStatus();

  return (
    <AuthActionStack>
      <AuthFormSurface>
        <input type="hidden" name="token" value={token} />
        <Field htmlFor="recovery-password" label="New password" required>
          <TextInput
            autoComplete="new-password"
            autoFocus
            id="recovery-password"
            name="password"
            placeholder="Enter a new password"
            required
            type="password"
          />
        </Field>
      </AuthFormSurface>
      <Button
        align="start"
        fullWidth
        loading={pending}
        size="lg"
        type="submit"
        variant="accent"
      >
        Set password and continue
      </Button>
    </AuthActionStack>
  );
}

export default function PasswordResetChangeForm({ token }: { token: string }) {
  const orpc = useORPC();
  const router = useRouter();
  const [result, formAction] = useActionState(
    passwordResetConfirmForm,
    undefined,
  );
  const [passkeyResult, passkeyFormAction] = useActionState(
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
    if (!globalThis.PublicKeyCredential) {
      router.push("/browser-not-supported");
      return;
    }

    setPasskeyLoading(true);
    setPasskeyError(null);

    try {
      const { options, signedChallenge } = await challengeMutation.mutateAsync({
        token,
      });
      const response = await startRegistration({ optionsJSON: options });
      const formData = new FormData();
      formData.append("token", token);
      formData.append("passkeyResponse", JSON.stringify(response));
      formData.append("signedChallenge", signedChallenge);
      passkeyFormAction(formData);
    } catch (error: any) {
      logError(error, { context: "passkey_recovery" });

      if (
        error.name === "NotAllowedError" ||
        error.message?.includes("cancel")
      ) {
        setPasskeyLoading(false);
        return;
      }

      setPasskeyError(
        error.message?.includes("Invalid verification token")
          ? "invalid_token"
          : error.message || "Failed to recover account with passkey",
      );
      setPasskeyLoading(false);
    }
  };

  const isRecovered = result?.ok || passkeyResult?.ok;
  const error = result?.error || passkeyResult?.error || passkeyError;
  const isInvalidToken =
    error === "invalid_token" || error?.includes("Invalid verification token");

  if (isInvalidToken) {
    return (
      <AuthPanel
        description="Recovery links work once and expire for your protection."
        title="This recovery link is no longer valid"
      >
        <AuthNotice>
          Request a new link to continue recovering your account.
        </AuthNotice>
        <ButtonLink
          align="start"
          fullWidth
          href="/recover-account"
          size="lg"
          variant="accent"
        >
          Request a new link
        </ButtonLink>
      </AuthPanel>
    );
  }

  if (isRecovered) {
    return (
      <AuthPanel
        description="Your new sign-in method is ready to use."
        title="Account recovered"
      >
        <AuthNotice>Your account access has been restored.</AuthNotice>
        <AuthActionStack>
          <ButtonLink
            align="start"
            fullWidth
            href="/settings/security"
            size="lg"
            variant="accent"
          >
            Manage passkeys
          </ButtonLink>
          <ButtonLink
            align="start"
            fullWidth
            href="/"
            size="lg"
            variant="tonal"
          >
            Return to Peated
          </ButtonLink>
        </AuthActionStack>
      </AuthPanel>
    );
  }

  if (showPasswordForm) {
    return (
      <AuthPanel
        back={
          <AuthTextButton
            type="button"
            onClick={() => setShowPasswordForm(false)}
          >
            ← Other recovery options
          </AuthTextButton>
        }
        description="Choose a new password for this account."
        title="Set a new password"
      >
        {error ? <AuthNotice>{error}</AuthNotice> : null}
        <form action={formAction}>
          <PasswordFields token={token} />
        </form>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      description="Add a new passkey or set a password to restore access."
      title="Recover your account"
    >
      {error ? <AuthNotice>{error}</AuthNotice> : null}
      <AuthActionStack>
        <Button
          align="start"
          fullWidth
          loading={passkeyLoading}
          onClick={handlePasskeyRecovery}
          size="lg"
          variant="accent"
        >
          <KeyRound aria-hidden="true" size={17} />
          Add a new passkey
        </Button>
        <Button
          align="start"
          fullWidth
          onClick={() => setShowPasswordForm(true)}
          size="lg"
          variant="tonal"
        >
          <Lock aria-hidden="true" size={17} />
          Set a password
        </Button>
      </AuthActionStack>
      <AuthDivider />
      <AuthFooterLinks>
        <AuthLink href="/login">Return to sign in</AuthLink>
      </AuthFooterLinks>
    </AuthPanel>
  );
}
