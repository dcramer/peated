import type { LoaderFunction } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import BottleTable from "../components/bottleTable";
import EmptyActivity from "../components/emptyActivity";
import Layout from "../components/layout";
import api from "../lib/api";
import type { Bottle } from "../types";

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
  bottleListResponse: PagedResponse<Bottle>;
};

export const loader: LoaderFunction = async ({
  request,
}): Promise<LoaderData> => {
  const url = new URL(request.url);

  const bottleListResponse = await api.get(`/bottles`, {
    query: {
      sort: "name",
      page: url.searchParams.get("page") || undefined,
    },
  });

  return { bottleListResponse };
};

export default function BottleList() {
  const { bottleListResponse } = useLoaderData() as LoaderData;

  return (
    <Layout gutter>
      {bottleListResponse.results.length > 0 ? (
        <BottleTable
          bottleList={bottleListResponse.results}
          rel={bottleListResponse.rel}
        />
      ) : (
        <EmptyActivity>
          Looks like there's no bottles in the database yet. Weird.
        </EmptyActivity>
      )}
    </Layout>
  );
}
