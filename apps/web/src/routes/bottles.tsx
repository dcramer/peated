import { useLocation } from "react-router-dom";

import { useQuery } from "@tanstack/react-query";
import BottleTable from "../components/bottleTable";
import EmptyActivity from "../components/emptyActivity";
import Layout from "../components/layout";
import api from "../lib/api";
import { Bottle, Paginated } from "../types";

export default function BottleList() {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const page = qs.get("page") || 1;

  const { data } = useQuery({
    queryKey: ["bottles", page],
    queryFn: (): Promise<Paginated<Bottle>> =>
      api.get("/bottles", {
        query: {
          ...Object.fromEntries(qs.entries()),
          page,
          sort: "name",
        },
      }),
  });

  return (
    <Layout>
      {data && data.results.length > 0 ? (
        <BottleTable bottleList={data.results} rel={data.rel} />
      ) : (
        <EmptyActivity>
          Looks like there's no bottles in the database yet. Weird.
        </EmptyActivity>
      )}
    </Layout>
  );
}
