import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import { PlusIcon } from "@heroicons/react/20/solid";
import { Link } from "react-router-dom";

import type { Checkin } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import CheckinListItem from "../components/checkinListItem";
import Glyph from "../assets/glyph.svg";

type LoaderData = {
  checkinList: Checkin[];
};

export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  const checkinList = await api.get("/checkins");

  return { checkinList };
};

const FloatingCheckinButton = () => {
  return (
    <Link
      type="button"
      className="rounded-full bg-peated p-2 text-white shadow-sm hover:bg-peated-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated fixed bottom-8 right-8"
      to="/search"
    >
      <PlusIcon className="h-8 w-8" aria-hidden="true" />
    </Link>
  );
};

const EmptyActivity = () => {
  return (
    <Link
      type="button"
      className="flex flex-col block w-full items-center rounded-lg border-2 border-dashed border-gray-300 p-12 text-center hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
      to="/search"
    >
      <Glyph style={{ width: 48, height: 48 }} />

      <span className="mt-2 block text-sm font-semibold text-gray-900">
        What are you drinking?
      </span>
    </Link>
  );
};

export default function Activity() {
  const { checkinList } = useLoaderData() as LoaderData;

  return (
    <Layout>
      <FloatingCheckinButton />
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
