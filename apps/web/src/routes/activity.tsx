import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import { Link } from "react-router-dom";

import type { Tasting } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import TastingListItem from "../components/tastingListItem";
import { ReactComponent as Glyph } from "../assets/glyph.svg";
import FloatingButton from "../components/floatingButton";

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
      className="flex flex-col sm:max-w-xl mx-auto items-center rounded-lg border-2 border-dashed border-gray-300 p-12 group hover:border-peated focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      to="/search?tasting"
    >
      <Glyph className="text-gray-400 w-16 h-16 group-hover:text-peated" />

      <span className="mt-4 block font-semibold text-gray-400 group-hover:text-peated">
        What are you drinking?
      </span>
      <span className="mt-2 blockfont-light text-gray-400 group-hover:text-peated">
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
