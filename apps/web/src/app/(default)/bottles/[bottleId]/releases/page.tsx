import { getBottlePage } from "@peated/web/lib/bottlePage.server";
import { summarize } from "@peated/web/lib/markdown";
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

const getReleaseFamilyTarget = cache(async (anchorBottleId: number) => {
  const [anchorBottle, { client }] = await Promise.all([
    getBottlePage(anchorBottleId),
    getAnonymousServerClient(),
  ]);
  const group = requireReleaseFamilyGroup(anchorBottle);

  const target = await resolveOrNotFound(
    client.bottleGroups.details({ group: group.id }),
  );
  requireReleaseFamilyAnchor(target.group);

  return { client, target };
});

export async function generateMetadata(props: {
  params: Promise<{ bottleId: string }>;
}) {
  const { bottleId } = await props.params;
  const { target } = await getReleaseFamilyTarget(
    parseReleaseFamilyRouteId(bottleId),
  );
  const description = summarize(target.group.description || "", 200);
  const images = target.group.imageUrl ? [target.group.imageUrl] : [];

  return {
    title: `${target.group.fullName} similar bottles`,
    description,
    images,
    openGraph: {
      title: `${target.group.fullName} similar bottles`,
      description,
      images,
    },
    twitter: {
      card: "summary",
      images,
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
  const { client, target } = await getReleaseFamilyTarget(
    parseReleaseFamilyRouteId(bottleId),
  );
  const bottleList = await resolveOrNotFound(
    client.bottleGroups.bottles({
      group: target.group.id,
      cursor: getCursor(searchParams, "cursor"),
      limit: 25,
      query: "",
      sort: "-tastings",
    }),
  );

  return <ReleaseFamilyView group={target.group} bottleList={bottleList} />;
}
