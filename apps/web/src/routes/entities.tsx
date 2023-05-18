import { useLocation } from "react-router-dom";

import EmptyActivity from "../components/emptyActivity";
import EntityTable from "../components/entityTable";
import Layout from "../components/layout";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import type { Entity, Paginated } from "../types";

export default function EntityList() {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const page = qs.get("page") || 1;

  const { data: entityList } = useSuspenseQuery(
    ["entities", page],
    (): Promise<Paginated<Entity>> =>
      api.get(`/entities`, {
        query: {
          sort: "name",
          page,
        },
      }),
  );

  return (
    <Layout>
      {entityList.results.length > 0 ? (
        <EntityTable entityList={entityList.results} rel={entityList.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </Layout>
  );
}
