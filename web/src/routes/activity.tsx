import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";
import { PlusIcon } from "@heroicons/react/20/solid";
import { Link } from "react-router-dom";

import type { Checkin } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";

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
      className="rounded-full bg-peated p-2 text-white shadow-sm hover:bg-peated-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated absolute bottom-8 right-8"
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
      <ul role="list" className="space-y-3 divide-y divide-peated">
        {checkinList.map((checkin) => (
          <li
            key={checkin.id}
            className="overflow-hidden bg-white px-4 py-4 shadow sm:rounded-md sm:px-6"
          >
            {checkin.bottle.name}
          </li>
        ))}
      </ul>
    </Layout>
  );
}
