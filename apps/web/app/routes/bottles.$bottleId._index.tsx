import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useParams } from "@remix-run/react";
import { QueryClient, dehydrate, useQuery } from "@tanstack/react-query";
import invariant from "tiny-invariant";

import EmptyActivity from "~/components/emptyActivity";
import TastingList from "~/components/tastingList";
import useApi from "~/hooks/useApi";
import { fetchTastings } from "~/queries/tastings";

import type { SitemapFunction } from "remix-sitemap";
import config from "~/config";
import { ApiClient } from "~/lib/api";
import { fetchBottles } from "~/queries/bottles";

export const sitemap: SitemapFunction = async ({
  config: sitemapConfig,
  request,
}) => {
  const api = new ApiClient({
    server: config.API_SERVER,
  });

  let page: number | null = 1;
  const output = [];
  while (page) {
    const { results, rel } = await fetchBottles(api, {
      page,
    });

    output.push(
      ...results.map((bottle) => ({
        loc: `/bottles/${bottle.id}`,
        lastmod: bottle.createdAt, // not correct
      })),
    );

    page = rel?.nextPage || null;
  }
  return output;
};

export async function loader({
  params: { bottleId },
  context,
}: LoaderFunctionArgs) {
  invariant(bottleId);

  const queryClient = new QueryClient();
  await queryClient.prefetchQuery(["bottle", bottleId, "tastings"], () =>
    fetchTastings(context.api, { bottle: bottleId }),
  );

  return json({ dehydratedState: dehydrate(queryClient) });
}

export default function BottleActivity() {
  const api = useApi();

  const { bottleId } = useParams<"bottleId">();
  invariant(bottleId);

  const { data: tastingList } = useQuery(["bottle", bottleId, "tastings"], () =>
    fetchTastings(api, { bottle: bottleId }),
  );

  if (!tastingList) return null;

  return (
    <>
      {tastingList.results.length ? (
        <TastingList values={tastingList.results} noBottle />
      ) : (
        <EmptyActivity to={`/bottles/${bottleId}/addTasting`}>
          <span className="mt-2 block font-semibold ">
            Are you enjoying a dram?
          </span>

          <span className="mt-2 block font-light">
            Looks like no ones recorded this spirit. You could be the first!
          </span>
        </EmptyActivity>
      )}
    </>
  );
}
