"use client";

import * as stylex from "@stylexjs/stylex";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageTabs } from "@peated/web/components/designSystem/components";
import { PageHeader } from "@peated/web/components/designSystem/patterns/pageLayout.stylex";
import { space } from "../../../styles/tokens.stylex";

const tabs = [
  { href: "/notifications", label: "Unread" },
  { href: "/notifications/all", label: "All" },
] as const;

export function NotificationPageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div {...stylex.props(styles.page)}>
      <PageHeader eyebrow="Your account" title="Notifications" />
      <div {...stylex.props(styles.tabs)}>
        <PageTabs
          ariaLabel="Notification filters"
          currentHref={pathname}
          items={tabs}
        />
      </div>
      <div {...stylex.props(styles.list)}>{children}</div>
    </div>
  );
}

const styles = stylex.create({
  page: { minWidth: 0, maxWidth: "900px" },
  tabs: { marginTop: space.x6 },
  list: { marginTop: space.x4 },
});
