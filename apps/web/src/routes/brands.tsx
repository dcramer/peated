import type { LoaderFunction } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import BrandTable from "../components/brandTable";
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
  brandListResponse: PagedResponse<Entity>;
};

export const loader: LoaderFunction = async ({
  request,
}): Promise<LoaderData> => {
  const url = new URL(request.url);

  const brandListResponse = await api.get(`/entities`, {
    query: {
      sort: "name",
      type: "brand",
      page: url.searchParams.get("page") || undefined,
    },
  });

  return { brandListResponse };
};

export default function BrandList() {
  const { brandListResponse } = useLoaderData() as LoaderData;

  return (
    <Layout gutter>
      {brandListResponse.results.length > 0 ? (
        <BrandTable
          brandList={brandListResponse.results}
          rel={brandListResponse.rel}
        />
      ) : (
        <EmptyActivity>
          Looks like there's no brands in the database yet. Weird.
        </EmptyActivity>
      )}
    </Layout>
  );
}
