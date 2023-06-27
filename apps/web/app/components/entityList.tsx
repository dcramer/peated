import type { Paginated } from "@peated/shared/types";
import { useLocation } from "@remix-run/react";

import EmptyActivity from "~/components/emptyActivity";
import EntityTable from "~/components/entityTable";
import Layout from "~/components/layout";
import QueryBoundary from "~/components/queryBoundary";
import { SearchTerm } from "~/components/searchTerm";
import useApi from "~/hooks/useApi";
import { useSuspenseQuery } from "~/hooks/useSuspenseQuery";
import type { Entity, EntityType } from "~/types";

const Content = ({
  page,
  type,
  country,
  region,
}: {
  page: number;
  type?: string;
  country?: string;
  region?: string;
}) => {
  const api = useApi();

  const { data: entityList } = useSuspenseQuery(
    ["entities", page, "type", type, "country", country, "region", region],
    (): Promise<Paginated<Entity>> =>
      api.get(`/entities`, {
        query: {
          type,
          country,
          region,
          sort: "name",
          page,
        },
      }),
  );

  return (
    <>
      {entityList.results.length > 0 ? (
        <EntityTable entityList={entityList.results} rel={entityList.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </>
  );
};

export default function EntityList({ type }: { type: EntityType }) {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const page = parseInt(qs.get("page") || "1", 10);
  const country = qs.get("country") || undefined;
  const region = qs.get("region") || undefined;

  return (
    <Layout>
      {(country || region) && (
        <div className="text-light space-x-2 p-3">
          <span className="font-medium">Results for</span>
          <SearchTerm name="country" value={country} />
          <SearchTerm name="region" value={region} />
        </div>
      )}
      <QueryBoundary>
        <Content
          page={page}
          type={type}
          country={qs.get("country") || undefined}
          region={qs.get("region") || undefined}
        />
      </QueryBoundary>
    </Layout>
  );
}
