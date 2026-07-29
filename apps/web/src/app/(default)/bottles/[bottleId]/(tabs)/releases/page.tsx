import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import {
  parseReleaseFamilyRouteId,
  requireReleaseFamilyAnchor,
  requireReleaseFamilyGroup,
} from "@peated/web/lib/releaseFamily";
import { cache } from "react";
import ReleaseFamilyView from "./releaseFamilyView";

type SearchParams = Record<string, string | string[] | undefined>;

function getCursor(searchParams: SearchParams, key: string): number {
  const value = searchParams[key];
  const cursor = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(cursor) && cursor > 0 ? cursor : 1;
}

const getReleaseFamilyGroup = cache(async (anchorBottleId: number) => {
  const [anchorBottle, { client }] = await Promise.all([
    getBottlePage(anchorBottleId),
    getAnonymousServerClient(),
  ]);
  const groupSummary = requireReleaseFamilyGroup(anchorBottle);

  const group = await resolveOrNotFound(
    client.bottleGroups.details({ group: groupSummary.id }),
  );
  requireReleaseFamilyAnchor(group);

  return { client, group };
});

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const { group } = await getReleaseFamilyGroup(
    parseReleaseFamilyRouteId(bottleId),
  );
  const description = `Explore releases of ${group.fullName}. Each bottle has its own details, tastings, and Library entry.`;

  return {
    title: `${group.fullName} releases`,
    description,
    openGraph: {
      title: `${group.fullName} releases`,
      description,
    },
  };
}

export default async function ReleaseFamilyPage(props: {
  params: Promise<{ bottleId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ bottleId }, searchParams] = await Promise.all([
    props.params,
    props.searchParams,
  ]);
  const anchorBottleId = parseReleaseFamilyRouteId(bottleId);
  const { client, group } = await getReleaseFamilyGroup(anchorBottleId);
  const bottleList = await resolveOrNotFound(
    client.bottleGroups.bottles({
      group: group.id,
      cursor: getCursor(searchParams, "cursor"),
      limit: 25,
      query: "",
      sort: "-tastings",
    }),
  );

  return (
    <ReleaseFamilyView
      bottleList={bottleList}
      currentBottleId={anchorBottleId}
    />
  );
}
