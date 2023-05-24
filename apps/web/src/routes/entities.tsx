import { useLocation } from "react-router-dom";

import EmptyActivity from "../components/emptyActivity";
import EntityTable from "../components/entityTable";
import Layout from "../components/layout";
import QueryBoundary from "../components/queryBoundary";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import type { Entity, Paginated } from "../types";

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

export default function EntityList() {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const page = parseInt(qs.get("page") || "1", 10);

  return (
    <Layout>
      <QueryBoundary>
        <Content
          page={page}
          type={qs.get("type") || undefined}
          country={qs.get("country") || undefined}
          region={qs.get("region") || undefined}
        />
      </QueryBoundary>
    </Layout>
  );
}
