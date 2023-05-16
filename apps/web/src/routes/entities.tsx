import type { LoaderFunction } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import EmptyActivity from "../components/emptyActivity";
import EntityTable from "../components/entityTable";
import Layout from "../components/layout";
import api from "../lib/api";
import type { Entity } from "../types";

type PagedResponse<T> = {
  results: T[];
  rel: {
    next: string | null;
    nextPage: number | null;
    prev: string | null;
    prevPage: number | null;
  };
};

type LoaderData = {
  entityListResponse: PagedResponse<Entity>;
};

export const loader: LoaderFunction = async ({
  request,
}): Promise<LoaderData> => {
  const url = new URL(request.url);

  const entityListResponse = await api.get(`/entities`, {
    query: {
      sort: "name",
      page: url.searchParams.get("page") || undefined,
    },
  });

  return { entityListResponse };
};

export default function EntityList() {
  const { entityListResponse } = useLoaderData() as LoaderData;

  return (
    <Layout gutter>
      {entityListResponse.results.length > 0 ? (
        <EntityTable
          entityList={entityListResponse.results}
          rel={entityListResponse.rel}
        />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </Layout>
  );
}
