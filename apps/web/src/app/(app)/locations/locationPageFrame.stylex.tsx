"use client";

import * as stylex from "@stylexjs/stylex";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageTabs, TextLink, type PageTabItem } from "@peated/web/components";
import { LocationMapIcon } from "@peated/web/components/locationMapIcon";
import { RegionMapCredit } from "@peated/web/components/locationMapIcon/credit.stylex";
import {
  PageHeader,
  TabbedPage,
} from "@peated/web/components/pages/pageLayout.stylex";
import {
  needsRegionMapCredit,
  type LocationMap,
} from "@peated/web/lib/locationMap";
import { colors, space } from "../../../styles/tokens.stylex";

export function LocationsIndexFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <PageHeader title="Locations" />
      <div {...stylex.props(styles.indexTabs)}>
        <PageTabs
          ariaLabel="Location sections"
          currentHref={pathname}
          items={[
            { href: "/locations", label: "Overview" },
            { href: "/locations/all-regions", label: "All locations" },
          ]}
        />
      </div>
      <div {...stylex.props(styles.indexContent)}>{children}</div>
    </div>
  );
}

export function LocationPageFrame({
  actions,
  children,
  description,
  location,
  tabs,
}: {
  actions?: ReactNode;
  children: ReactNode;
  description?: ReactNode;
  location:
    | { kind: "country"; name: string }
    | {
        country: { href: string; name: string };
        kind: "region";
        name: string;
      };
  tabs: readonly [PageTabItem, ...PageTabItem[]];
}) {
  const pathname = usePathname();
  const country = location.kind === "region" ? location.country : undefined;

  return (
    <TabbedPage
      currentHref={pathname}
      header={
        <PageHeader
          actions={actions}
          description={description}
          parent={
            country ? (
              <TextLink href={country.href}>{country.name}</TextLink>
            ) : undefined
          }
          title={location.name}
        />
      }
      tabs={tabs}
      tabsLabel={`${location.name} sections`}
    >
      {children}
    </TabbedPage>
  );
}

export function LocationVisual({ visual }: { visual: LocationMap }) {
  const props = {
    "aria-hidden": true,
    ...stylex.props(styles.visualIcon),
  } as const;

  return (
    <>
      <div {...stylex.props(styles.visual)}>
        <LocationMapIcon visual={visual} {...props} />
      </div>
      {needsRegionMapCredit(visual) ? <RegionMapCredit /> : null}
    </>
  );
}

const styles = stylex.create({
  indexTabs: { marginTop: space.x6 },
  indexContent: {
    minWidth: 0,
    marginTop: space.x6,
  },
  visual: {
    display: "flex",
    height: "220px",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    padding: space.x6,
    borderRadius: "3px",
    backgroundColor: colors.inset,
  },
  visualIcon: {
    display: "block",
    width: "100%",
    maxWidth: "240px",
    height: "100%",
    color: colors.ink,
  },
});
