import EmptyActivity from "@peated/web/components/emptyActivity";
import EntityTable from "@peated/web/components/entityTable";
import Layout from "@peated/web/components/layout";
import { getTrpcClient } from "@peated/web/lib/trpc.server";
import type { Metadata } from "next";
import EntityListSidebar from "./rightSidebar";

const DEFAULT_SORT = "-tastings";

export const metadata: Metadata = {
  title: "Search Whisky Brands, Bottler, and Distillers",
};

export default async function EntityList({
  searchParams,
}: {
  searchParams: Record<string, string>;
}) {
  const numericFields = new Set(["cursor", "limit"]);

  const trpcClient = await getTrpcClient();
  const entityList = await trpcClient.entityList.query(
    Object.fromEntries(
      [...Object.entries(searchParams)].map(([k, v]) =>
        numericFields.has(k) ? [k, Number(v)] : [k, v === "" ? null : v],
      ),
    ),
  );

  return (
    <Layout rightSidebar={<EntityListSidebar />}>
      {entityList.results.length > 0 ? (
        <EntityTable
          entityList={entityList.results}
          rel={entityList.rel}
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
