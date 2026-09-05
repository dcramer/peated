import { getPublicPageServerClient } from "@peated/web/lib/orpc/client.server";
import { getPublicStats } from "@peated/web/lib/publicStats.server";
import { getSession } from "@peated/web/lib/session.server";
import type { Metadata } from "next";

import { SearchPageClient } from "./searchPageClient.stylex";

export const metadata: Metadata = {
  title: "Search",
  description: "Search the Peated whisky database.",
};

const apiScopes = [
  "bottles",
  "series",
  "distilleries",
  "brands",
  "bottlers",
  "companies",
  "regions",
  "members",
] as const;

const databasePageScopes = [
  "all",
  "bottles",
  "series",
  "distilleries",
  "brands",
  "bottlers",
  "members",
] as const;

const bottleSelectionIntents = [
  "addBottle",
  "catalog",
  "choose",
  "library",
  "tasting",
  "view",
] as const;

function getValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SearchPage(props: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [searchParams, session, { client }] = await Promise.all([
    props.searchParams,
    getSession(),
    getPublicPageServerClient(),
  ]);
  const query = getValue(searchParams.q)?.trim() ?? "";
  const type = getValue(searchParams.type);
  const intent = getValue(searchParams.intent);
  const memberSearch = type === "users";
  const bottleSelection =
    bottleSelectionIntents.some((value) => value === intent) ||
    searchParams.tasting !== undefined;
  const databaseSearch = !memberSearch && !bottleSelection;
  const requestedScope = memberSearch
    ? "members"
    : bottleSelection
      ? "bottles"
      : (databasePageScopes.find((scope) => scope === type) ?? "all");
  const selectedScope =
    databaseSearch && requestedScope === "members" && !session.user
      ? "all"
      : requestedScope;
  const searchScopes = databaseSearch
    ? apiScopes.filter((scope) => Boolean(session.user) || scope !== "members")
    : memberSearch
      ? (["members"] as const)
      : (["bottles"] as const);
  const searchLimit = databaseSearch && selectedScope === "all" ? 5 : 50;
  const [stats, initialResponse] = await Promise.all([
    getPublicStats(),
    query
      ? client.search({
          includeFacets: databaseSearch,
          limit: searchLimit,
          query,
          scopes: [...searchScopes],
        })
      : undefined,
  ]);

  return (
    <SearchPageClient
      bottleTotal={stats.bottles}
      initialResponse={initialResponse}
    />
  );
}
