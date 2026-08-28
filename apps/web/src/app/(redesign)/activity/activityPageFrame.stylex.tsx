"use client";

import * as stylex from "@stylexjs/stylex";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageTabs } from "@peated/web/components/designSystem/components";
import { PageHeader } from "@peated/web/components/designSystem/patterns/pagePatternShell.stylex";
import { space } from "../../../styles/tokens.stylex";

const tabs = [
  { href: "/activity/friends", label: "Friends" },
  { href: "/", label: "Global" },
  { href: "/activity/local", label: "Local" },
] as const;

export function ActivityPageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div {...stylex.props(styles.page)}>
      <PageHeader eyebrow="Community" title="Activity" />
      <div {...stylex.props(styles.tabs)}>
        <PageTabs
          ariaLabel="Activity feeds"
          currentHref={pathname}
          items={tabs}
        />
      </div>
      <div {...stylex.props(styles.feed)}>{children}</div>
    </div>
  );
}

const styles = stylex.create({
  page: { minWidth: 0, maxWidth: "900px" },
  tabs: { marginTop: space.x6 },
  feed: { marginTop: space.x4 },
});
