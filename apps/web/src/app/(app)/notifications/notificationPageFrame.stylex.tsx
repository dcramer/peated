"use client";

import * as stylex from "@stylexjs/stylex";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import {
  PageHeader,
  TabbedPage,
} from "@peated/web/components/pages/pageLayout.stylex";

const tabs = [
  { href: "/notifications", label: "Unread" },
  { href: "/notifications/all", label: "All" },
] as const;

export function NotificationPageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div {...stylex.props(styles.page)}>
      <TabbedPage
        currentHref={pathname}
        header={<PageHeader eyebrow="Your account" title="Notifications" />}
        tabs={tabs}
        tabsLabel="Notification filters"
      >
        {children}
      </TabbedPage>
    </div>
  );
}

const styles = stylex.create({
  page: { minWidth: 0, maxWidth: "900px" },
});
