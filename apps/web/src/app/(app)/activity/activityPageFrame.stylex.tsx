"use client";

import * as stylex from "@stylexjs/stylex";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import {
  PageHeader,
  TabbedPage,
} from "@peated/web/components/pages/pageLayout.stylex";

const tabs = [
  { href: "/activity/friends", label: "Friends" },
  { href: "/", label: "Global" },
  { href: "/activity/local", label: "Local" },
] as const;

export function ActivityPageFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div {...stylex.props(styles.page)}>
      <TabbedPage
        currentHref={pathname}
        header={<PageHeader eyebrow="Community" title="Activity" />}
        tabs={tabs}
        tabsLabel="Activity feeds"
      >
        {children}
      </TabbedPage>
    </div>
  );
}

const styles = stylex.create({
  page: { minWidth: 0, maxWidth: "900px" },
});
