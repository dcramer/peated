import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import { Link } from "react-router-dom";

import type { Checkin } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import CheckinListItem from "../components/checkinListItem";
import { ReactComponent as Glyph } from "../assets/glyph.svg";
import FloatingCheckinButton from "../components/floatingCheckinButton";

type LoaderData = {
  checkinList: Checkin[];
};

export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  const checkinList = await api.get("/checkins");

  return { checkinList };
};

const EmptyActivity = () => {
  return (
    <Link
      type="button"
      className="flex flex-col sm:max-w-xl block mx-auto items-center rounded-lg border-2 border-dashed border-gray-300 p-12 group hover:border-peated focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      to="/search?checkin"
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
  const { checkinList } = useLoaderData() as LoaderData;

  return (
    <Layout gutter>
      <FloatingCheckinButton to="/search?checkin" />
      {checkinList.length > 0 ? (
        <ul role="list" className="space-y-3">
          {checkinList.map((checkin) => (
            <CheckinListItem key={checkin.id} checkin={checkin} />
          ))}
        </ul>
      ) : (
        <EmptyActivity />
      )}
    </Layout>
  );
}
