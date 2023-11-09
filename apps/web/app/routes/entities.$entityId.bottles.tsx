import type { LoaderFunctionArgs, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useLocation, useOutletContext } from "@remix-run/react";
import invariant from "tiny-invariant";

import type { Entity } from "@peated/server/types";
import BottleTable from "~/components/bottleTable";
import QueryBoundary from "~/components/queryBoundary";
import type { ApiClient } from "~/lib/api";
import { fetchBottles } from "~/queries/bottles";

export function buildQuery(
  api: ApiClient,
  entityId: string,
  queryParams: URLSearchParams,
) {
  return {
    queryKey: ["entity", entityId, "bottles"],
    queryFn: () =>
      fetchBottles(api, {
        ...Object.fromEntries(queryParams.entries()),
        entity: entityId,
      }),
    cacheTime: 0,
  };
}

export async function loader({
  request,
  context: { trpc },
  params: { entityId },
}: LoaderFunctionArgs) {
  invariant(entityId);
  const { searchParams } = new URL(request.url);

  return json({
    bottleList: await trpc.bottleList.query({
      ...Object.fromEntries(searchParams.entries()),
      entity: Number(entityId),
      page: Number(searchParams.get("page") || 1),
    }),
  });
}

export default function EntityBottles() {
  const { entity } = useOutletContext<{ entity: Entity }>();
  const { bottleList } = useLoaderData<typeof loader>();

  return (
    <QueryBoundary
      loading={
        <div
          className="mb-4 animate-pulse bg-slate-800"
          style={{ height: 200 }}
        />
      }
      fallback={() => null}
    >
      <Content entityId={`${entity.id}`} bottleList={bottleList} />
    </QueryBoundary>
  );
}

const Content = ({
  entityId,
  bottleList,
}: {
  entityId: string;
  bottleList: SerializeFrom<typeof loader>["bottleList"];
}) => {
  const location = useLocation();

  if (!bottleList) return null;

  const { results, rel } = bottleList;

  return (
    <BottleTable
      bottleList={results}
      rel={rel}
      groupBy={(bottle) => bottle.brand}
      groupTo={(group) => `/entities/${group.id}`}
    />
  );
};
