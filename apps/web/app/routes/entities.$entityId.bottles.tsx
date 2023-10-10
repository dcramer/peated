import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLocation, useOutletContext } from "@remix-run/react";
import { QueryClient, dehydrate, useQuery } from "@tanstack/react-query";
import invariant from "tiny-invariant";

import type { Entity } from "@peated/shared/types";
import BottleTable from "~/components/bottleTable";
import QueryBoundary from "~/components/queryBoundary";
import useApi from "~/hooks/useApi";
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

export async function loader({ request, context, params }: LoaderFunctionArgs) {
  invariant(params.entityId);
  const { searchParams } = new URL(request.url);

  const query = buildQuery(context.api, params.entityId, searchParams);

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(query);

  return json({ dehydratedState: dehydrate(queryClient) });
}

export default function EntityBottles() {
  const { entity } = useOutletContext<{ entity: Entity }>();

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
      <Content entityId={`${entity.id}`} />
    </QueryBoundary>
  );
}

const Content = ({ entityId }: { entityId: string }) => {
  const location = useLocation();

  const api = useApi();
  const query = buildQuery(api, entityId, new URLSearchParams(location.search));
  const { data } = useQuery(query);

  if (!data) return null;

  const { results, rel } = data;

  return (
    <BottleTable
      bottleList={results}
      rel={rel}
      groupBy={(bottle) => bottle.brand}
      groupTo={(group) => `/entities/${group.id}`}
    />
  );
};
