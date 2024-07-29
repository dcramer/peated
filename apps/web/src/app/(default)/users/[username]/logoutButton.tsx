"use client";

import Button from "@peated/web/components/button";
import { logoutForm } from "@peated/web/lib/auth.actions";
import { useFormState } from "react-dom";

export default function LogoutButton() {
  // TODO: this needs to show some kind of loading state
  const [, formAction] = useFormState(logoutForm, undefined);
  return (
    <form action={formAction}>
      <Button type="submit" color="primary">
        Sign out
      </Button>
    </form>
  );
}
