import { useLoaderData } from "react-router-dom";
import type { LoaderFunction } from "react-router-dom";

import type { Checkin, User } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import CheckinListItem from "../components/checkinListItem";
import UserAvatar from "../components/userAvatar";
import Button from "../components/button";
import { useRequiredAuth } from "../hooks/useAuth";

type UserWithStats = User & {
  stats: {
    bottles: number;
    checkins: number;
  };
};

type LoaderData = {
  user: UserWithStats;
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
    <div className="flex flex-col block m-4 mx-auto items-center rounded-lg border border-dashed border-gray-300 p-12">
      <span className="mt-2 block text-sm font-light text-gray-400">
        Looks like this ones a bit short on tastings.
      </span>
    </div>
  );
};

export default function UserDetails() {
  const { user, checkinList } = useLoaderData() as LoaderData;
  const { user: currentUser } = useRequiredAuth();

  return (
    <Layout gutter>
      <div className="flex flex-wrap mb-8">
        <div className="w-full sm:w-3/12 pr-4">
          <UserAvatar user={user} size={150} />
        </div>
        <div className="w-full sm:w-6/12 flex flex-col justify-center pr-4">
          <h3 className="text-4xl font-semibold leading-normal mb-2 text-peated self-center sm:self-start">
            {user.displayName}
          </h3>
          <div className="flex justify-center sm:justify-start">
            <div className="mr-4 pr-3 text-center">
              <span className="text-xl font-bold block uppercase tracking-wide text-peated">
                {user.stats.checkins.toLocaleString()}
              </span>
              <span className="text-sm text-gray-400">Tastings</span>
            </div>
            <div className="pl-3 text-center mb-4">
              <span className="text-xl font-bold block uppercase tracking-wide text-peated">
                {user.stats.bottles.toLocaleString()}
              </span>
              <span className="text-sm text-gray-400">Bottles</span>
            </div>
          </div>
        </div>
        <div className="w-full sm:w-3/12 flex flex-col justify-center items-center sm:items-end">
          {user.id !== currentUser.id ? (
            <>
              <Button color="primary">Add Friend</Button>
            </>
          ) : (
            <>
              <Button color="primary">Edit Profile</Button>
            </>
          )}
        </div>
      </div>

      {checkinList.length ? (
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
