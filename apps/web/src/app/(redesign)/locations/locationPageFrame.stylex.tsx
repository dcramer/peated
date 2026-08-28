"use client";

import * as stylex from "@stylexjs/stylex";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import CountryMapIcon from "@peated/web/components/countryMapIcon";
import {
  PageTabs,
  SpecStrip,
} from "@peated/web/components/designSystem/components";
import { PageHeader } from "@peated/web/components/designSystem/patterns/pagePatternShell.stylex";
import UsStateMapIcon from "@peated/web/components/usStateMapIcon";
import { colors, space } from "../../../styles/tokens.stylex";

export function LocationsIndexFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div>
      <PageHeader eyebrow="Whisky database" title="Locations" />
      <div {...stylex.props(styles.tabs)}>
        <PageTabs
          ariaLabel="Location sections"
          currentHref={pathname}
          items={[
            { href: "/locations", label: "Overview" },
            { href: "/locations/all-regions", label: "All locations" },
          ]}
        />
      </div>
      <div {...stylex.props(styles.content)}>{children}</div>
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
  totalBottles,
  totalDistillers,
  visual,
}: {
  actions?: ReactNode;
  children: ReactNode;
  country?: { href: string; name: string };
  description?: ReactNode;
  name: string;
  tabs: readonly [
    { href: string; label: string },
    ...{ href: string; label: string }[],
  ];
  totalBottles: number;
  totalDistillers: number;
  visual?: { kind: "country" | "state"; slug: string };
}) {
  const pathname = usePathname();

  return (
    <div>
      <PageHeader
        actions={actions}
        description={description}
        eyebrow={country ? "Whisky region" : "Whisky country"}
        identity={visual ? <LocationVisual visual={visual} /> : undefined}
        parent={country ? <a href={country.href}>{country.name}</a> : undefined}
        title={name}
      />
      <div {...stylex.props(styles.specs)}>
        <SpecStrip
          cells={[
            { label: "Distillers", value: totalDistillers.toLocaleString() },
            { label: "Bottles", value: totalBottles.toLocaleString() },
          ]}
        />
      </div>
      <div {...stylex.props(styles.tabs)}>
        <PageTabs
          ariaLabel={`${name} sections`}
          currentHref={pathname}
          items={tabs}
        />
      </div>
      <div {...stylex.props(styles.content)}>{children}</div>
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
    ...stylex.props(styles.visual),
  } as const;

  return visual.kind === "state" ? (
    <UsStateMapIcon slug={visual.slug} {...props} />
  ) : (
    <CountryMapIcon slug={visual.slug} {...props} />
  );
}

const styles = stylex.create({
  specs: { marginTop: space.x4 },
  tabs: { marginTop: space.x6 },
  content: { minWidth: 0, marginTop: space.x6 },
  visual: {
    display: "block",
    width: "96px",
    maxHeight: "72px",
    color: colors.inkMuted,
  },
});
