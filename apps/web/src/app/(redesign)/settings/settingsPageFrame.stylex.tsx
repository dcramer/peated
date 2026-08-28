"use client";

import * as stylex from "@stylexjs/stylex";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageTabs } from "@peated/web/components/designSystem/components";
import { PageHeader } from "@peated/web/components/designSystem/patterns/pagePatternShell.stylex";
import { space } from "../../../styles/tokens.stylex";

const tabs = [
  { href: "/settings/profile", label: "Profile" },
  { href: "/settings/security", label: "Security" },
] as const;

export function SettingsPageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div {...stylex.props(styles.page)}>
      <PageHeader
        description="Manage how your account appears and how you sign in."
        eyebrow="Your account"
        title="Settings"
      />
      <div {...stylex.props(styles.tabs)}>
        <PageTabs
          ariaLabel="Account settings"
          currentHref={pathname}
          items={tabs}
        />
      </div>
      <div {...stylex.props(styles.content)}>{children}</div>
    </div>
  );
}

const styles = stylex.create({
  page: {
    width: "100%",
    maxWidth: "760px",
    minWidth: 0,
  },
  tabs: { marginTop: space.x6 },
  content: { marginTop: space.x4 },
});
