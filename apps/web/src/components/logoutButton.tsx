"use client";

import { logout } from "@peated/web/lib/auth.actions";
import { useActionState } from "react";

export default function LogoutButton() {
  // TODO: this needs to show some kind of loading state
  const [, formAction] = useActionState(logout, undefined);
  return (
    <form action={formAction}>
      <button type="submit">Sign out</button>
    </form>
  );
}
