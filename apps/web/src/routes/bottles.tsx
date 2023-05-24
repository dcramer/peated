import { useLocation } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";
import BottleTable from "../components/bottleTable";
import EmptyActivity from "../components/emptyActivity";
import Layout from "../components/layout";
import QueryBoundary from "../components/queryBoundary";
import api from "../lib/api";
import { Bottle, Paginated } from "../types";

const Content = ({
  page,
  category,
  age,
  tag,
}: {
  page: string | number;
  category?: string;
  age?: string;
  tag?: string;
}) => {
  const { data } = useQuery({
    queryKey: ["bottles", page, "category", category, "age", age, "tag", tag],
    queryFn: (): Promise<Paginated<Bottle>> =>
      api.get("/bottles", {
        query: {
          category,
          age,
          tag,
          page,
          sort: "name",
        },
      }),
  });

  if (!data) return null;

  return (
    <>
      {data.results.length > 0 ? (
        <BottleTable bottleList={data.results} rel={data.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's nothing in the database yet. Weird.
        </EmptyActivity>
      )}
    </>
  );
};

export default function BottleList() {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const page = qs.get("page") || 1;
  return (
    <Layout title="Bottles">
      <QueryBoundary>
        <Content
          page={page}
          category={qs.get("category") || undefined}
          age={qs.get("age") || undefined}
          tag={qs.get("tag") || undefined}
        />
      </QueryBoundary>
    </Layout>
  );
}
