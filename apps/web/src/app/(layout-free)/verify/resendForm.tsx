"use client";

import { Button } from "@peated/web/components/designSystem/components";
import { AuthNotice } from "@peated/web/components/designSystem/patterns/authShell.stylex";
import { resendVerificationForm } from "@peated/web/lib/auth.actions";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

export default function ResendVerificationForm() {
  const [state, resendVerificationAction] = useActionState(
    resendVerificationForm,
    undefined,
  );

  if (state?.ok) {
    return (
      <AuthNotice>
        {state.alreadyVerified
          ? "This account is already verified. You can continue to Peated."
          : "Follow the instructions in your inbox to continue."}
      </AuthNotice>
    );
  }

  return (
    <form action={resendVerificationAction}>
      {state?.error ? <AuthNotice>{state.error}</AuthNotice> : null}
      <ResendVerificationButton />
    </form>
  );
}

function ResendVerificationButton() {
  const { pending } = useFormStatus();

  return (
    <Button
      align="start"
      fullWidth
      loading={pending}
      size="lg"
      type="submit"
      variant="accent"
    >
      Resend verification email
    </Button>
  );
}
