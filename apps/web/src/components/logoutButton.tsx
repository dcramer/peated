"use client";

import { logoutForm } from "@peated/web/lib/auth.actions";
import { useFormState } from "react-dom";

export default function LogoutButton() {
  // TODO: this needs to show some kind of loading state
  const [, formAction] = useFormState(logoutForm, undefined);
  return (
    <form action={formAction}>
      <button type="submit">Sign out</button>
    </form>
  );
}
