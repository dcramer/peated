import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLocation, useOutletContext } from "@remix-run/react";
import { QueryClient, dehydrate, useQuery } from "@tanstack/react-query";
import invariant from "tiny-invariant";
import BottleTable from "~/components/bottleTable";
import QueryBoundary from "~/components/queryBoundary";
import useApi from "~/hooks/useApi";
import type { Bottle, Entity, Paginated } from "~/types";

export async function loader({ request, context, params }: LoaderArgs) {
  invariant(params.entityId);
  const { searchParams } = new URL(request.url);
  const page = searchParams.get("page") || 1;

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(
    ["entity", params.entityId, "bottles", "page", page],
    (): Promise<Paginated<Bottle>> =>
      context.api.get(`/bottles`, {
        query: { entity: params.entityId, page, sort: "name" },
      }),
  );

  return json({ dehydratedState: dehydrate(queryClient) });
}

export default function EntityIndex() {
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
      <EntityBottles entityId={entity.id} />
    </QueryBoundary>
  );
}

const EntityBottles = ({ entityId }: { entityId: number }) => {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const page = qs.get("page") || 1;

  const api = useApi();

  const { data } = useQuery(
    ["entity", entityId, "bottles", "page", page],
    (): Promise<Paginated<Bottle>> =>
      api.get(`/bottles`, {
        query: { entity: entityId, page },
      }),
  );

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
