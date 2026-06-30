"use client";

import Button from "@peated/web/components/button";
import { resendVerificationForm } from "@peated/web/lib/auth.actions";
import type { ComponentProps } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";

export default function ResendVerificationForm() {
  const [state, resendVerificationAction] = useActionState(
    resendVerificationForm,
    undefined,
  );

  return (
    <form action={resendVerificationAction}>
      {state?.ok ? (
        state.alreadyVerified ? (
          <p className="mb-8 text-center">
            Oops, it looks like you already verified your account. Nothing to
            see here!
          </p>
        ) : (
          <p className="mb-8 text-center">
            Follow the instructions in your inbox to continue.
          </p>
        )
      ) : (
        <ResendVerificationButton />
      )}
    </form>
  );
}

function ResendVerificationButton(props: ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" color="highlight" loading={pending} {...props}>
      Resend Verification Email
    </Button>
  );
}
