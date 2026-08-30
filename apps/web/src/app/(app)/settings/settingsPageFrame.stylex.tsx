"use client";

import * as stylex from "@stylexjs/stylex";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import {
  PageHeader,
  TabbedPage,
} from "@peated/web/components/designSystem/patterns/pageLayout.stylex";

const tabs = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/security", label: "Security" },
] as const;

export function SettingsPageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div {...stylex.props(styles.page)}>
      <TabbedPage
        currentHref={pathname}
        header={
          <PageHeader
            description="Manage how your account appears and how you sign in."
            eyebrow="Your account"
            title="Settings"
          />
        }
        tabs={tabs}
        tabsLabel="Account settings"
      >
        {children}
      </TabbedPage>
    </div>
  );
}

const styles = stylex.create({
  page: {
    width: "100%",
    maxWidth: "760px",
    minWidth: 0,
  },
});
