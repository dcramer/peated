"use client";

import { acceptTosForm, updateSession } from "@peated/web/lib/auth.actions";
import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import Alert from "./alert";
import Link from "./link";

export default function PendingTosAlert() {
  const [state, acceptAction] = useFormState(acceptTosForm, undefined);

  useEffect(() => {
    if (state?.ok) updateSession();
  }, [state?.ok]);

  return (
    <Alert type="default" noMargin>
      <form action={acceptAction} className="flex items-center gap-x-4 text-sm">
        You must accept our Terms of Service.
        <AcceptButton />
        <Link href="https://peated.com/terms" className="text-white underline">
          Review Terms
        </Link>
      </form>
    </Alert>
  );
}

function AcceptButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="cursor-pointer text-white underline"
    >
      Accept Now
    </button>
  );
}
