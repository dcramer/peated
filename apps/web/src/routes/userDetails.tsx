import type { LoaderFunction } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import { useState } from "react";
import Button from "../components/button";
import Layout from "../components/layout";
import TastingList from "../components/tastingList";
import UserAvatar from "../components/userAvatar";
import { useRequiredAuth } from "../hooks/useAuth";
import api from "../lib/api";
import type { FollowStatus, Paginated, Tasting, User } from "../types";

type UserDetails = User & {
  followStatus?: FollowStatus;
  stats: {
    bottles: number;
    tastings: number;
    contributions: number;
  };
};

type LoaderData = {
  user: UserDetails;
  tastingList: Paginated<Tasting>;
};

// TODO: when this executes the apiClient has not configured
// its token yet as react-dom (thus context) seemingly has
// not rendered.. so this errors out
export const loader: LoaderFunction = async ({
  params: { userId },
}): Promise<LoaderData> => {
  if (!userId) throw new Error("Missing userId");
  const user = await api.get(`/users/${userId}`);
  const tastingList = await api.get(`/tastings`, {
    query: { user: user.id },
  });

  return { user, tastingList };
};

const EmptyActivity = () => {
  return (
    <div className="m-4 mx-auto flex flex-col items-center rounded-lg border border-dashed border-gray-300 p-12">
      <span className="block font-light text-gray-400">
        Looks like this ones a bit short on tastings.
      </span>
    </div>
  );
};

export default function UserDetails() {
  const { user, tastingList } = useLoaderData() as LoaderData;
  const { user: currentUser } = useRequiredAuth();

  const [followStatus, setFollowStatus] = useState(user.followStatus);

  const followUser = async (follow: boolean) => {
    const data = await api.post(
      follow ? `/users/${user.id}/follow` : `/users/${user.id}/unfollow`,
    );
    setFollowStatus(data.status);
  };

  return (
    <Layout gutter>
      <div className="my-8 flex min-w-full flex-wrap gap-y-4 sm:flex-nowrap">
        <div className="flex w-full justify-center sm:w-auto sm:justify-start">
          <UserAvatar user={user} size={150} />
        </div>
        <div className="flex w-full flex-col justify-center px-4 sm:w-auto sm:flex-1">
          <h3 className="text-peated mb-2 self-center text-4xl font-semibold leading-normal sm:self-start">
            {user.displayName}
          </h3>
          <div className="flex justify-center sm:justify-start">
            <div className="mr-4 pr-3 text-center">
              <span className="text-peated block text-xl font-bold uppercase tracking-wide">
                {user.stats.tastings.toLocaleString()}
              </span>
              <span className="text-sm text-gray-400">Tastings</span>
            </div>
            <div className="mb-4 px-3 text-center">
              <span className="text-peated block text-xl font-bold uppercase tracking-wide">
                {user.stats.bottles.toLocaleString()}
              </span>
              <span className="text-sm text-gray-400">Bottles</span>
            </div>
            <div className="mb-4 pl-3 text-center">
              <span className="text-peated block text-xl font-bold uppercase tracking-wide">
                {user.stats.contributions.toLocaleString()}
              </span>
              <span className="text-sm text-gray-400">Contributions</span>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col items-center justify-center sm:w-auto sm:items-end">
          {user.id !== currentUser.id ? (
            <>
              <Button
                color="primary"
                onClick={() => followUser(followStatus === "none")}
              >
                {followStatus === "none"
                  ? "Add Friend"
                  : followStatus === "pending"
                  ? "Request Pending"
                  : "Remove Friend"}
              </Button>
            </>
          ) : (
            <>
              <Button to="/settings" color="primary">
                Edit Profile
              </Button>
            </>
          )}
        </div>
      </div>

      {tastingList.results.length ? (
        <TastingList values={tastingList.results} />
      ) : (
        <EmptyActivity />
      )}
    </Layout>
  );
}
