"use client";

import * as stylex from "@stylexjs/stylex";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { PageTabs, TextLink, type PageTabItem } from "@peated/web/components";
import CountryMapIcon from "@peated/web/components/countryMapIcon";
import { PageHeader } from "@peated/web/components/pages/pageLayout.stylex";
import UsStateMapIcon from "@peated/web/components/usStateMapIcon";
import { colors, space } from "../../../styles/tokens.stylex";

export function LocationsIndexFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <PageHeader eyebrow="Whisky database" title="Locations" />
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
  country,
  description,
  name,
  tabs,
  visual,
}: {
  actions?: ReactNode;
  children: ReactNode;
  country?: { href: string; name: string };
  description?: ReactNode;
  name: string;
  tabs: readonly [PageTabItem, ...PageTabItem[]];
  visual?: { kind: "country" | "state"; slug: string };
}) {
  const pathname = usePathname();

  return (
    <div>
      <PageHeader
        actions={actions}
        description={description}
        eyebrow={country ? "Whisky region" : "Whisky country"}
        parent={
          country ? (
            <TextLink href={country.href} size="inherit">
              {country.name}
            </TextLink>
          ) : undefined
        }
        title={name}
      />
      <div {...stylex.props(styles.tabs)}>
        <PageTabs
          ariaLabel={`${name} sections`}
          currentHref={pathname}
          items={tabs}
        />
      </div>
      <div {...stylex.props(styles.overviewGrid)}>
        <div {...stylex.props(styles.content)}>{children}</div>
        {visual ? (
          <aside {...stylex.props(styles.details)}>
            <LocationVisual visual={visual} />
          </aside>
        ) : null}
      </div>
    </div>
  );
}

function LocationVisual({
  visual,
}: {
  visual: { kind: "country" | "state"; slug: string };
}) {
  const props = {
    "aria-hidden": true,
    ...stylex.props(styles.visualIcon),
  } as const;

  return (
    <div {...stylex.props(styles.visual)}>
      {visual.kind === "state" ? (
        <UsStateMapIcon slug={visual.slug} {...props} />
      ) : (
        <CountryMapIcon slug={visual.slug} {...props} />
      )}
    </div>
  );
}

const NARROW = "@media (max-width: 759px)";

const styles = stylex.create({
  indexTabs: { marginTop: space.x6 },
  tabs: { marginTop: 0 },
  overviewGrid: {
    display: "grid",
    gridTemplateAreas: {
      default: '"content details"',
      [NARROW]: '"details" "content"',
    },
    gridTemplateColumns: {
      default: "minmax(0, 1fr) 336px",
      [NARROW]: "minmax(0, 1fr)",
    },
    columnGap: space.x12,
  },
  content: {
    gridArea: "content",
    minWidth: 0,
    paddingTop: space.x4,
  },
  indexContent: {
    minWidth: 0,
    marginTop: space.x6,
  },
  details: {
    gridArea: "details",
    minWidth: 0,
  },
  visual: {
    display: "flex",
    height: "220px",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    marginTop: space.x4,
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
