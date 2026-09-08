import InboxPage from "@peated/web/components/admin/moderation/inboxPage";
import type { ReactNode } from "react";

export default function InboxLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <InboxPage />
      {children}
    </>
  );
}
