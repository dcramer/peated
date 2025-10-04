"use client";

import Button from "@peated/web/components/button";
import { acceptTosForm, logoutForm } from "@peated/web/lib/auth.actions";
import { useFormState } from "react-dom";

export default function Actions({ redirectTo }: { redirectTo: string }) {
  const [, acceptAction] = useFormState(acceptTosForm, undefined);
  const [, logoutAction] = useFormState(logoutForm, undefined);
  return (
    <>
      <form action={acceptAction}>
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <Button type="submit" color="highlight" fullWidth>
          Accept & Continue
        </Button>
      </form>
    </>
  );
}
