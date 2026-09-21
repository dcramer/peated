"use client";

import { ButtonLink } from "@peated/web/components/button.stylex";
import { Notice } from "@peated/web/components/feedback.stylex";
import useAuth from "@peated/web/hooks/useAuth";
import { usePathname } from "next/navigation";

/** Formats a deletion time in the member's locale. */
export function formatDeletionDate(value: string) {
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "long",
    timeStyle: "short",
  });
}

/** Reminds a member with a pending deletion that they can still keep the account. */
export function AccountDeletionNotice() {
  const { user } = useAuth();
  const pathname = usePathname();
  if (!user?.deletionScheduledAt || pathname === "/settings/security") {
    return null;
  }

  return (
    <Notice
      action={
        <ButtonLink href="/settings/security" size="sm" variant="tonal">
          Keep my account
        </ButtonLink>
      }
      tone="warning"
    >
      Your account will be deleted on{" "}
      {formatDeletionDate(user.deletionScheduledAt)}. You can cancel until then.
    </Notice>
  );
}
