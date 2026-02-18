"use client";

import Alert from "@peated/web/components/alert";
import Button from "@peated/web/components/button";
import { acceptTosForm, logoutForm } from "@peated/web/lib/auth.actions";
import { useFormState } from "react-dom";

export default function Actions({ redirectTo }: { redirectTo: string }) {
  const [acceptState, acceptAction] = useFormState(acceptTosForm, undefined);
  const [, logoutAction] = useFormState(logoutForm, undefined);
  return (
    <>
      {acceptState?.error && <Alert>{acceptState.error}</Alert>}
      <form action={acceptAction}>
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <Button type="submit" color="highlight" fullWidth>
          Accept & Continue
        </Button>
      </form>
      <form action={logoutAction}>
        <Button type="submit" color="default" fullWidth>
          Log Out
        </Button>
      </form>
    </>
  );
}
