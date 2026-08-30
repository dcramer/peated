import type { Outputs } from "@peated/server/orpc/router";

import {
  SiteFooter,
  type SiteFooterProps,
} from "@peated/web/components/designSystem/components";

const groups = [
  {
    label: "Database",
    links: [
      { href: "/bottles", label: "Bottles" },
      { href: "/distillers", label: "Distillers" },
      { href: "/brands", label: "Brands" },
      { href: "/bottlers", label: "Bottlers" },
      { href: "/blenders", label: "Blenders" },
      { href: "/locations", label: "Locations" },
    ],
  },
  {
    label: "You",
    links: [
      { href: "/library", label: "Library" },
      { href: "/tastings", label: "Tastings" },
      { href: "/friends", label: "Friends" },
      { href: "/settings", label: "Settings" },
    ],
  },
  {
    label: "Contribute",
    links: [
      { href: "/addBottle", label: "Record a bottle" },
      { href: "/addEntity", label: "Add a distiller" },
      { href: "/updates", label: "Recent changes" },
    ],
  },
  {
    label: "Peated",
    links: [
      { href: "/about", label: "About" },
      { href: "/about/brand", label: "Brand voice" },
      { href: "/about/ratings", label: "Rating systems" },
      { href: "https://github.com/peated/peated", label: "Source" },
      { href: "/terms", label: "Terms" },
    ],
  },
] as const satisfies SiteFooterProps["groups"];

function formatCount(value: number, noun: string) {
  return `${value.toLocaleString("en-US")} ${noun}`;
}

/** Renders the server-supplied platform snapshot without owning data access. */
export function ApplicationFooter({ stats }: { stats?: Outputs["stats"] }) {
  const coverage = stats
    ? [
        formatCount(stats.bottles, "bottles"),
        formatCount(stats.distilleries, "distilleries"),
        formatCount(stats.brands, "brands"),
        formatCount(stats.bottlers, "bottlers"),
        formatCount(stats.blenders, "blenders"),
        formatCount(stats.tastings, "tastings"),
      ].join(" · ")
    : undefined;

  return (
    <SiteFooter
      coverage={coverage}
      groups={groups}
      provenance="Edited by members · corrections welcome"
      referenceLinks={[
        {
          href: "/entities/4263/codes",
          label: "SMWS distillery codes",
        },
      ]}
      responsibility="Drink responsibly"
      statement="A record of whisky bottlings, critic scores, and tasting notes from the people who drank them."
    />
  );
}
