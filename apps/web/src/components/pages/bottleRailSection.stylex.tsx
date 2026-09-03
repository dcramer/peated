import type { ReactNode } from "react";

import { BottleList, type BottleListItem } from "@peated/web/components";
import { RailListSection } from "./railListSection.stylex";

/** Uses the compact sidebar identity; build items with toBottleListItem. */
export function BottleRailSection({
  children,
  heading,
  intro,
  items = [],
  moreHref,
  moreLabel,
}: {
  children?: ReactNode;
  heading: string;
  intro?: string;
  items?: readonly BottleListItem[];
  moreHref?: string;
  moreLabel?: string;
}) {
  return (
    <RailListSection
      action={
        moreHref && moreLabel ? { href: moreHref, label: moreLabel } : undefined
      }
      heading={heading}
      intro={intro}
    >
      {items.length ? (
        <BottleList
          ariaLabel={heading}
          items={items.map((item) => ({ ...item, variant: "sidebar" }))}
        />
      ) : null}
      {children}
    </RailListSection>
  );
}
