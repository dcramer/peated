"use client";

import { Button, Field, TextInput } from "@peated/web/components";
import {
  AuthenticationActions,
  AuthenticationCard,
  AuthenticationDivider,
  AuthenticationLink,
  AuthenticationLinks,
  AuthenticationNotice,
  AuthenticationPanel,
} from "@peated/web/components/pages/authentication.stylex";
import { passwordResetForm } from "@peated/web/lib/auth.actions";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

function RecoveryRequestFields({ initialEmail }: { initialEmail: string }) {
  const { pending } = useFormStatus();

  return (
    <AuthenticationActions>
      <AuthenticationCard>
        <Field htmlFor="recovery-email" label="Email" required>
          <TextInput
            autoComplete="email"
            autoFocus
            defaultValue={initialEmail}
            id="recovery-email"
            name="email"
            placeholder="you@example.com"
            required
            type="email"
          />
        </Field>
      </AuthenticationCard>
      <Button
        align="start"
        fullWidth
        loading={pending}
        size="lg"
        type="submit"
        variant="accent"
      >
        Send recovery link
      </Button>
    </AuthenticationActions>
  );
}

export default function PasswordResetForm({
  initialEmail = "",
}: {
  initialEmail?: string;
}) {
  const [result, formAction] = useActionState(passwordResetForm, undefined);

  if (result?.ok) {
    return (
      <AuthenticationPanel
        description="Follow the secure link we sent to choose a new way to sign in."
        title="Check your email"
      >
        <AuthenticationNotice>
          Recovery instructions are on their way.
        </AuthenticationNotice>
        <AuthenticationDivider />
        <AuthenticationLinks>
          <AuthenticationLink href="/login">
            Return to sign in
          </AuthenticationLink>
        </AuthenticationLinks>
      </AuthenticationPanel>
    );
  }

  return (
    <AuthenticationPanel
      description="We’ll email a one-time link so you can restore access."
      title="Recover your account"
    >
      {result?.error ? (
        <AuthenticationNotice>{result.error}</AuthenticationNotice>
      ) : null}
      <form action={formAction}>
        <RecoveryRequestFields initialEmail={initialEmail} />
      </form>
      <AuthenticationDivider />
      <AuthenticationLinks>
        <span>Remembered how to sign in?</span>
        <AuthenticationLink href="/login">Return to sign in</AuthenticationLink>
      </AuthenticationLinks>
    </AuthenticationPanel>
  );
}
