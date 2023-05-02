import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import { PlusIcon } from "@heroicons/react/20/solid";
import { Link } from "react-router-dom";

import type { Checkin } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import CheckinListItem from "../components/checkinListItem";

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

export default function Activity() {
  const { checkinList } = useLoaderData() as LoaderData;

  return (
    <Layout>
      <FloatingCheckinButton />
      <ul role="list" className="space-y-3">
        {checkinList.map((checkin) => (
          <CheckinListItem key={checkin.id} checkin={checkin} />
        ))}
      </ul>
    </Layout>
  );
}
