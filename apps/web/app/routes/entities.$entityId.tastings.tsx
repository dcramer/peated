import type { Entity } from "@peated/server/types";
import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useOutletContext } from "@remix-run/react";
import { QueryClient, dehydrate, useQuery } from "@tanstack/react-query";
import invariant from "tiny-invariant";
import EmptyActivity from "~/components/emptyActivity";
import TastingList from "~/components/tastingList";
import useApi from "~/hooks/useApi";
import { fetchTastings } from "~/queries/tastings";

export async function loader({
  params: { entityId },
  context,
}: LoaderFunctionArgs) {
  invariant(entityId);

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(["entity", entityId, "tastings"], () =>
    fetchTastings(context.api, {
      entity: entityId,
    }),
  );

  return json({ dehydratedState: dehydrate(queryClient) });
}

export default function EntityActivity() {
  const api = useApi();

  const { entity } = useOutletContext<{ entity: Entity }>();

  const { data: tastingList } = useQuery(
    ["entity", `${entity.id}`, "tastings"],
    () =>
      fetchTastings(api, {
        entity: entity.id,
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
