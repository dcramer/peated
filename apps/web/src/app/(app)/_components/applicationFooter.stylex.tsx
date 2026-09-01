import type { Outputs } from "@peated/server/orpc/router";

import { SiteFooter, type SiteFooterProps } from "@peated/web/components";

const links = [
  { href: "/about", label: "About" },
  { href: "/about/categories", label: "Whisky categories" },
  { href: "/about/ratings", label: "Rating guide" },
  { href: "/events", label: "Whisky events" },
  { href: "/updates", label: "Recent changes" },
  { href: "https://github.com/peated/peated", label: "Source" },
  { href: "/terms", label: "Terms" },
] as const satisfies SiteFooterProps["links"];

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
      links={links}
      provenance="Edited by members · corrections welcome"
      referenceLinks={[
        {
          href: "/bottlers/4263/codes",
          label: "SMWS distillery codes",
        },
      ]}
      responsibility="Drink responsibly"
      statement="A record of whisky bottles, critic scores, and tasting notes from the people who drank them."
    />
  );
}
