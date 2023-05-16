import { useLocation } from "react-router-dom";
import { ReactComponent as Glyph } from "../assets/glyph.svg";
import EmptyActivity from "../components/emptyActivity";
import FloatingButton from "../components/floatingButton";
import Layout from "../components/layout";
import QueryBoundary from "../components/queryBoundary";
import Tabs from "../components/tabs";
import TastingList from "../components/tastingList";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import type { Paginated, Tasting } from "../types";

const defaultViewParam = "global";

const mapFilterParam = (value: string | null) => {
  if (value === "friends" || value === "local") return value;
  return defaultViewParam;
};

export default function Activity() {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);
  const filterQ = mapFilterParam(qs.get("view"));

  const { data } = useSuspenseQuery(
    ["tastings", filterQ],
    (): Promise<Paginated<Tasting>> =>
      api.get("/tastings", {
        query: {
          filter: filterQ,
        },
      }),
  );

  return (
    <Layout>
      <FloatingButton to="/search?tasting" />
      <Tabs fullWidth>
        <Tabs.Item to="?view=friends" active={filterQ == "friends"}>
          Friends
        </Tabs.Item>
        <Tabs.Item to="./" active={filterQ === "global"}>
          Global
        </Tabs.Item>
        <Tabs.Item to="?view=local" active={filterQ === "local"}>
          Local
        </Tabs.Item>
      </Tabs>
      <QueryBoundary>
        {data.results.length > 0 ? (
          <TastingList values={data.results} />
        ) : (
          <EmptyActivity to="/search?tasting">
            <Glyph className="h-16 w-16" />

            <div className="mt-4 font-semibold">What are you drinking?</div>
            <div className="mt-2 block">
              Get started by recording your first tasting notes.
            </div>
          </EmptyActivity>
        )}
      </QueryBoundary>
    </Layout>
  );
}
