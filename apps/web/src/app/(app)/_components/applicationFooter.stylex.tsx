import type { Outputs } from "@peated/server/orpc/router";

import { SiteFooter, type SiteFooterProps } from "@peated/web/components";

const groups = [
  {
    label: "Explore",
    links: [
      { href: "/locations", label: "Locations" },
      { href: "/brands", label: "Brands" },
      { href: "/events", label: "Whisky events" },
    ],
  },
  {
    label: "Reference",
    links: [
      { href: "/about/categories", label: "Whisky categories" },
      { href: "/about/tasting-wheel", label: "Tasting wheel" },
      { href: "/about/ratings", label: "Rating guide" },
      { href: "/bottlers/4263/codes", label: "SMWS distillery codes" },
    ],
  },
  {
    label: "Project",
    links: [
      { href: "/about", label: "About" },
      { href: "/updates", label: "Recent changes" },
      { href: "/about/api", label: "API" },
      { href: "https://github.com/peated/peated", label: "Source" },
    ],
  },
] as const satisfies SiteFooterProps["groups"];

function formatCount(value: number, noun: string) {
  return `${value.toLocaleString("en-US")} ${noun}`;
}

/** Renders platform coverage when the secondary stats query is available. */
export function ApplicationFooter({ stats }: { stats?: Outputs["stats"] }) {
  const coverage = stats
    ? [
        formatCount(stats.bottles, "bottles"),
        formatCount(stats.distilleries, "distilleries"),
        formatCount(stats.brands, "brands"),
        formatCount(stats.bottlers, "bottlers"),
        formatCount(stats.tastings, "tastings"),
      ].join(" · ")
    : undefined;

  return (
    <SiteFooter
      coverage={coverage}
      groups={groups}
      legalLinks={[{ href: "/terms", label: "Terms" }]}
      provenance="Edited by members · corrections welcome"
      responsibility="Drink responsibly"
      statement="A public record of whisky bottles, critic scores, and tasting notes from the people who drank them."
    />
  );
}
