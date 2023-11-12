import type { Entity } from "@peated/server/types";
import type { LoaderFunctionArgs, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useLocation, useOutletContext } from "@remix-run/react";
import invariant from "tiny-invariant";
import BottleTable from "~/components/bottleTable";
import QueryBoundary from "~/components/queryBoundary";

export async function loader({
  request,
  context: { trpc },
  params: { entityId },
}: LoaderFunctionArgs) {
  invariant(entityId);
  const { searchParams } = new URL(request.url);
  const numericFields = new Set([
    "cursor",
    "limit",
    "age",
    "entity",
    "distiller",
    "bottler",
    "entity",
  ]);

  return json({
    bottleList: await trpc.bottleList.query({
      ...Object.fromEntries(
        [...searchParams.entries()].map(([k, v]) =>
          numericFields.has(k) ? [k, Number(v)] : [k, v === "" ? null : v],
        ),
      ),
      entity: Number(entityId),
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
