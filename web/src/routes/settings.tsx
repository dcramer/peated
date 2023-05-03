import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";

import type { Checkin, User } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import CheckinListItem from "../components/checkinListItem";

type LoaderData = {
  user: User;
  checkinList: Checkin[];
};

// TODO: when this executes the apiClient has not configured
// its token yet as react-dom (thus context) seemingly has
// not rendered.. so this errors out
export const loader: LoaderFunction = async ({
  params: { userId },
}): Promise<LoaderData> => {
  if (!userId) throw new Error("Missing userId");
  const user = await api.get(`/users/${userId}`);
  const checkinList = await api.get(`/checkins`, {
    query: { user: user.id },
  });

  return { user, checkinList };
};

const EmptyActivity = () => {
  return (
    <div className="flex flex-col block m-4 mx-auto items-center rounded-lg border border-dashed border-gray-300 p-12 group hover:border-peated focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
      <span className="mt-2 block text-sm font-light text-gray-400 group-hover:text-peated">
        Looks like this ones a bit short on tastings.
      </span>
    </div>
  );
};

export default function Settings() {
  const { user, checkinList } = useLoaderData() as LoaderData;

  return (
    <Layout gutter>
      <div className="flex flex-row items-start justify-between gap-x-8">
        <div className="space-y-1 flex-1">
          <h1 className="flex gap-x-3 mb-2 leading-7 font-semibold text-3xl text-peated">
            {user.displayName}
          </h1>
        </div>
      </div>

      <div className="mt-8 grid gap-3 grid-cols-2 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => (
          <div key={stat.name}>
            <p className="text-base leading-7 text-gray-400">{stat.name}</p>
            <p className="order-first text-3xl font-semibold tracking-tight text-peated sm:text-5xl">
              {stat.value}
            </p>
          </div>
        ))}
      </div>
      <h2 className="text-lg font-semibold leading-6 mt-12 mb-6 text-gray-900">
        Activity
      </h2>
      {checkinList.length ? (
        <ul role="list" className="space-y-3 m-4">
          {checkinList.map((checkin) => (
            <CheckinListItem key={checkin.id} checkin={checkin} noBottle />
          ))}
        </ul>
      ) : (
        <EmptyActivity />
      )}
    </Layout>
  );
}
