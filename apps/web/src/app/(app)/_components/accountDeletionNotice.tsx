"use client";

import { ButtonLink } from "@peated/web/components/button.stylex";
import { Notice } from "@peated/web/components/feedback.stylex";
import { Timestamp } from "@peated/web/components/timestamp";
import useAuth from "@peated/web/hooks/useAuth";
import { usePathname } from "next/navigation";

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
        <ButtonLink href="/settings/security" variant="accent">
          Keep my account
        </ButtonLink>
      }
      heading="Deletion scheduled"
      status="Pending"
      tone="warning"
    >
      Your account will be deleted on{" "}
      <Timestamp date={user.deletionScheduledAt} format="dateTime" />. You can
      cancel until then.
    </Notice>
  );
}
