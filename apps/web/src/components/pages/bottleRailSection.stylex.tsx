import type { ReactNode } from "react";

import { BottleVisual, RailList, RailListItem } from "@peated/web/components";
import { RailListSection } from "./railListSection.stylex";

export type BottleRailItem = {
  end?: ReactNode;
  href: string;
  imageUrl?: string | null;
  metadata?: string;
  name: string;
};

/** Presents a compact bottle list in a page rail or its mobile stack. */
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
  items?: readonly BottleRailItem[];
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
        <RailList ariaLabel={heading}>
          {items.map((item) => (
            <RailListItem
              end={item.end}
              href={item.href}
              key={item.href}
              leading={<BottleVisual imageUrl={item.imageUrl} size="sm" />}
              metadata={item.metadata}
              title={item.name}
            />
          ))}
        </RailList>
      ) : null}
      {children}
    </RailListSection>
  );
}
