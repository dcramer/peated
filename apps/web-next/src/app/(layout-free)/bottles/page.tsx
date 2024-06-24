import BottleTable from "@peated/web/components/bottleTable";
import EmptyActivity from "@peated/web/components/emptyActivity";
import Layout from "@peated/web/components/layout";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import type { Metadata } from "next";
import BottleListSidebar from "./rightSidebar";

const DEFAULT_SORT = "-tastings";

export const metadata: Metadata = {
  title: "Search Whisky Bottles",
};

export default async function BottleList({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const numericFields = new Set([
    "cursor",
    "limit",
    "age",
    "entity",
    "distiller",
    "bottler",
    "entity",
  ]);

  const trpcClient = await getTrpcClient();
  const bottleList = await trpcClient.bottleList.ensureData(
    Object.fromEntries(
      [...Object.entries(searchParams)].map(([k, v]) =>
        numericFields.has(k) ? [k, Number(v)] : [k, v === "" ? null : v],
      ),
    ),
  );

  return (
    <Layout rightSidebar={<BottleListSidebar />}>
      {bottleList.results.length > 0 ? (
        <BottleTable
          bottleList={bottleList.results}
          rel={bottleList.rel}
          sort={searchParams.sort || DEFAULT_SORT}
        />
      ) : (
        <EmptyActivity>
          {"Looks like there's nothing in the database yet. Weird."}
        </EmptyActivity>
      )}
    </Layout>
  );
}
