import type { LoaderFunction } from "react-router-dom";
import { Link, useLoaderData } from "react-router-dom";

import { ReactComponent as Glyph } from "../assets/glyph.svg";
import FloatingButton from "../components/floatingButton";
import Layout from "../components/layout";
import TastingListItem from "../components/tastingListItem";
import api from "../lib/api";
import type { Tasting } from "../types";

type LoaderData = {
  tastingList: Tasting[];
};

export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  const tastingList = await api.get("/tastings");

  return { tastingList };
};

const EmptyActivity = () => {
  return (
    <Link
      type="button"
      className="hover:border-peated group mx-auto flex flex-col items-center rounded-lg border-2 border-dashed border-gray-300 p-12 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 sm:max-w-xl"
      to="/search?tasting"
    >
      <Glyph className="group-hover:text-peated h-16 w-16 text-gray-400" />

      <span className="group-hover:text-peated mt-4 block font-semibold text-gray-400">
        What are you drinking?
      </span>
      <span className="blockfont-light group-hover:text-peated mt-2 text-gray-400">
        Get started by recording your first tasting notes.
      </span>
    </Link>
  );
};

export default function Activity() {
  const { tastingList } = useLoaderData() as LoaderData;

  return (
    <Layout gutter>
      <FloatingButton to="/search?tasting" />
      {tastingList.length > 0 ? (
        <ul role="list" className="space-y-3">
          {tastingList.map((tasting) => (
            <TastingListItem key={tasting.id} tasting={tasting} />
          ))}
        </ul>
      ) : (
        <EmptyActivity />
      )}
    </Layout>
  );
}
