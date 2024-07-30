"use client";

import { resendVerificationForm } from "@peated/web/lib/auth.actions";
import { useFormState, useFormStatus } from "react-dom";
import Alert from "./alert";
import { useFlashMessages } from "./flash";

export default function PendingVerificationAlert() {
  const [state, resendVerificationAction] = useFormState(
    resendVerificationForm,
    undefined,
  );

  const { flash } = useFlashMessages();

  if (state?.alreadyVerified) {
    flash("Oops, looks like you already verified your account.", "success");
  }

  return (
    <Alert type="default" noMargin>
      <form
        action={resendVerificationAction}
        className="flex items-center gap-x-4 text-sm"
      >
        Your account is pending verification.
        {state?.ok ? <div></div> : <ResendVerificationButton />}
      </form>
    </Alert>
  );
}

function ResendVerificationButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="cursor-pointer text-white underline"
    >
      Resend Verification Email
    </button>
  );
}
