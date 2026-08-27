"use client";

import {
  Button,
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
} from "@peated/web/components/designSystem/patterns/authShell.stylex";
import { passwordResetForm } from "@peated/web/lib/auth.actions";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

function RecoveryRequestFields({ initialEmail }: { initialEmail: string }) {
  const { pending } = useFormStatus();

  return (
    <AuthActionStack>
      <AuthFormSurface>
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
      </AuthFormSurface>
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
    </AuthActionStack>
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
      <AuthPanel
        description="Follow the secure link we sent to choose a new way to sign in."
        title="Check your email"
      >
        <AuthNotice>Recovery instructions are on their way.</AuthNotice>
        <AuthDivider />
        <AuthFooterLinks>
          <AuthLink href="/login">Return to sign in</AuthLink>
        </AuthFooterLinks>
      </AuthPanel>
    );
  }

  return (
    <AuthPanel
      description="We’ll email a one-time link so you can restore access."
      title="Recover your account"
    >
      {result?.error ? <AuthNotice>{result.error}</AuthNotice> : null}
      <form action={formAction}>
        <RecoveryRequestFields initialEmail={initialEmail} />
      </form>
      <AuthDivider />
      <AuthFooterLinks>
        <span>Remembered how to sign in?</span>
        <AuthLink href="/login">Return to sign in</AuthLink>
      </AuthFooterLinks>
    </AuthPanel>
  );
}
