import { getAnonymousServerClient } from "@peated/web/lib/orpc/client.server";
import { resolveOrNotFound } from "@peated/web/lib/orpc/notFound.server";
import BottleGroupView from "./bottleGroupView";

type SearchParams = Record<string, string | string[] | undefined>;

function getCursor(searchParams: SearchParams): number {
  const value = searchParams.cursor;
  const cursor = Number(Array.isArray(value) ? value[0] : value);
  return Number.isInteger(cursor) && cursor > 0 ? cursor : 1;
}

export default async function BottleGroupPage(props: {
  params: Promise<{ groupId: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const [{ groupId }, searchParams, { client }] = await Promise.all([
    props.params,
    props.searchParams,
    getAnonymousServerClient(),
  ]);
  const group = Number(groupId);

  const [target, bottleList] = await Promise.all([
    resolveOrNotFound(client.bottleGroups.details({ group })),
    resolveOrNotFound(
      client.bottleGroups.bottles({
        group,
        cursor: getCursor(searchParams),
        limit: 25,
        query: "",
        sort: "-tastings",
      }),
    ),
  ]);

  return <BottleGroupView target={target} bottleList={bottleList} />;
}
