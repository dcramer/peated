import type { LoaderFunction } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import { ReactComponent as Glyph } from "../assets/glyph.svg";
import EmptyActivity from "../components/emptyActivity";
import FloatingButton from "../components/floatingButton";
import Layout from "../components/layout";
import TastingList from "../components/tastingList";
import api from "../lib/api";
import type { Tasting } from "../types";

type LoaderData = {
  tastingList: Tasting[];
};

export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  const { results: tastingList } = await api.get("/tastings");

  return { tastingList };
};

export default function Activity() {
  const { tastingList } = useLoaderData() as LoaderData;

  return (
    <Layout gutter>
      <FloatingButton to="/search?tasting" />
      {tastingList.length > 0 ? (
        <TastingList values={tastingList} />
      ) : (
        <EmptyActivity to="/search?tasting">
          <Glyph className="group-hover:text-peated h-16 w-16 text-gray-400" />

          <span className="group-hover:text-peated mt-4 block font-semibold text-gray-400">
            What are you drinking?
          </span>
          <span className="blockfont-light group-hover:text-peated mt-2 text-gray-400">
            Get started by recording your first tasting notes.
          </span>
        </EmptyActivity>
      )}
    </Layout>
  );
}
