import type { Paginated } from "@peated/shared/types";
import type { LoaderArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useOutletContext } from "@remix-run/react";
import { QueryClient, dehydrate, useQuery } from "@tanstack/react-query";
import invariant from "tiny-invariant";
import EmptyActivity from "~/components/emptyActivity";
import TastingList from "~/components/tastingList";
import useApi from "~/hooks/useApi";
import type { Entity, Tasting } from "~/types";

export async function loader({ params: { entityId }, context }: LoaderArgs) {
  invariant(entityId);

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(
    ["entity", entityId, "tastings"],
    (): Promise<Paginated<Tasting>> =>
      context.api.get(`/tastings`, {
        query: { entity: entityId },
      }),
  );

  return json({ dehydratedState: dehydrate(queryClient) });
}

export default function EntityActivity() {
  const api = useApi();

  const { entity } = useOutletContext<{ entity: Entity }>();

  const { data: tastingList } = useQuery(
    ["entity", entity.id, "tastings"],
    (): Promise<Paginated<Tasting>> =>
      api.get(`/tastings`, {
        query: { entity: entity.id },
      }),
  );

  if (!tastingList) return null;

  return (
    <>
      {tastingList.results.length ? (
        <TastingList values={tastingList.results} />
      ) : (
        <EmptyActivity to={`/search?tasting`}>
          <span className="mt-2 block font-semibold ">
            Are you enjoying a dram?
          </span>

          <span className="mt-2 block font-light">
            Looks like no ones recorded any related spirit. You could be the
            first!
          </span>
        </EmptyActivity>
      )}
    </>
  );
}
