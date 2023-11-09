import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData, useParams } from "@remix-run/react";
import invariant from "tiny-invariant";

import EmptyActivity from "~/components/emptyActivity";
import TastingList from "~/components/tastingList";

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
  context: { trpc },
}: LoaderFunctionArgs) {
  invariant(bottleId);

  const tastingList = await trpc.tastingList.query({
    bottle: Number(bottleId),
  });

  return json({ tastingList });
}

export default function BottleActivity() {
  const { bottleId } = useParams<"bottleId">();
  const { tastingList } = useLoaderData<typeof loader>();

  invariant(bottleId);

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
