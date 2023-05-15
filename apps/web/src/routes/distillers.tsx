import type { LoaderFunction } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import DistillerTable from "../components/distillerTable";
import EmptyActivity from "../components/emptyActivity";
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
  distillerListResponse: PagedResponse<Entity>;
};

export const loader: LoaderFunction = async ({
  request,
}): Promise<LoaderData> => {
  const url = new URL(request.url);

  const distillerListResponse = await api.get(`/entities`, {
    query: {
      sort: "name",
      type: "distiller",
      page: url.searchParams.get("page") || undefined,
    },
  });

  return { distillerListResponse };
};

export default function DistillerList() {
  const { distillerListResponse } = useLoaderData() as LoaderData;

  return (
    <Layout gutter>
      {distillerListResponse.results.length > 0 ? (
        <DistillerTable
          distillerList={distillerListResponse.results}
          rel={distillerListResponse.rel}
        />
      ) : (
        <EmptyActivity>
          Looks like there's no distillers in the database yet. Weird.
        </EmptyActivity>
      )}
    </Layout>
  );
}
