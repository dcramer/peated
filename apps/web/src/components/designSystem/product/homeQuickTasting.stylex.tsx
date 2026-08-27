"use client";

import { useQuery } from "@tanstack/react-query";

import { useORPC } from "../../../lib/orpc/context";
import { QuickTastingPrompt } from "../patterns/homeWidgets.stylex";

export function HomeQuickTasting() {
  const orpc = useORPC();
  const library = useQuery(
    orpc.collections.bottles.list.queryOptions({
      input: { collection: "library", limit: 3, user: "me" },
    }),
  );
  const seen = new Set<number>();
  const bottles = (library.data?.results ?? []).flatMap((entry) => {
    if (seen.has(entry.bottle.id)) return [];
    seen.add(entry.bottle.id);
    return [
      {
        href: `/bottles/${entry.bottle.id}/addTasting`,
        name: entry.bottle.fullName,
      },
    ];
  });

  return (
    <QuickTastingPrompt
      bottles={bottles}
      scanHref="/addBottle?intent=tasting"
    />
  );
}
