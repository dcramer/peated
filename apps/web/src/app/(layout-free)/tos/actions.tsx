"use client";

import Button from "@peated/web/components/button";
import { acceptTosForm, logoutForm } from "@peated/web/lib/auth.actions";
import { useFormState } from "react-dom";

export default function Actions() {
  const [, acceptAction] = useFormState(acceptTosForm, undefined);
  const [, logoutAction] = useFormState(logoutForm, undefined);
  return (
    <div className="flex justify-between">
      <form action={logoutAction}>
        <Button color="default">Log out</Button>
      </form>
      <form action={acceptAction}>
        <Button color="highlight">Accept and continue</Button>
      </form>
    </div>
  );
}
