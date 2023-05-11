import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";

import type { Bottle } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import BottleTable from "../components/bottleTable";

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

const EmptyActivity = () => {
  return (
    <div className="flex flex-col m-4 mx-auto items-center rounded-lg border border-dashed border-gray-300 p-12">
      <span className="block font-light text-gray-400">
        Looks like there's no bottles in the database yet. Weird.
      </span>
    </div>
  );
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
        <EmptyActivity />
      )}
    </Layout>
  );
}
