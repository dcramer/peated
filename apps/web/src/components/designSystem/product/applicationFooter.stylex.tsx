"use client";

import { useQuery } from "@tanstack/react-query";

import { useORPC } from "../../../lib/orpc/context";
import { SiteFooter, type SiteFooterProps } from "../components";

const groups = [
  {
    label: "Database",
    links: [
      { href: "/bottles", label: "Bottles" },
      { href: "/distillers", label: "Distillers" },
      { href: "/brands", label: "Brands" },
      { href: "/bottlers", label: "Bottlers" },
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
      { href: "/about/ratings", label: "Rating systems" },
      { href: "https://github.com/peated/peated", label: "Source" },
      { href: "/terms", label: "Terms" },
    ],
  },
] as const satisfies SiteFooterProps["groups"];

function formatCount(value: number, noun: string) {
  return `${value.toLocaleString("en-US")} ${noun}`;
}

/** Connects the shared footer to platform facts without putting data access in it. */
export function ApplicationFooter() {
  const orpc = useORPC();
  const stats = useQuery(orpc.stats.queryOptions());
  const coverage = stats.data
    ? [
        formatCount(stats.data.totalBottles, "bottles"),
        formatCount(stats.data.totalEntities, "brands, distillers & bottlers"),
        formatCount(stats.data.totalTastings, "tastings"),
      ].join(" · ")
    : undefined;

  return (
    <SiteFooter
      coverage={coverage}
      groups={groups}
      provenance="Community-edited · corrections welcome"
      referenceLinks={[
        {
          href: "/entities/4263/codes",
          label: "SMWS distillery codes",
        },
      ]}
      responsibility="Drink responsibly"
      statement="A record of every whisky bottling, what the critics said, and what the people who drank it said."
    />
  );
}
