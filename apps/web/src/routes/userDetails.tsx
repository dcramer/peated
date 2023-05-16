import type { LoaderFunction } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { useEffect, useState } from "react";
import Button from "../components/button";
import Chip from "../components/chip";
import EmptyActivity from "../components/emptyActivity";
import Layout from "../components/layout";
import Tabs from "../components/tabs";
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

export default function UserDetails() {
  const { tastingList, ...loaderData } = useLoaderData() as LoaderData;
  const { user: currentUser } = useRequiredAuth();

  const [user, setUser] = useState(loaderData.user);

  useEffect(() => {
    setUser(loaderData.user);
  }, [loaderData.user]);

  const [followStatus, setFollowStatus] = useState(user.followStatus);

  const followUser = async (follow: boolean) => {
    const data = await api[follow ? "post" : "delete"](
      `/users/${user.id}/follow`,
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
          <h3 className="mb-2 self-center text-4xl font-semibold leading-normal text-white sm:self-start">
            {user.displayName}
          </h3>
          <div className="mb-4">
            {user.admin ? (
              <Chip size="small" color="highlight">
                Admin
              </Chip>
            ) : user.mod ? (
              <Chip size="small" color="highlight">
                Moderator
              </Chip>
            ) : null}
          </div>
          <div className="flex justify-center sm:justify-start">
            <div className="mr-4 pr-3 text-center">
              <span className="block text-xl font-bold uppercase tracking-wide text-white">
                {user.stats.tastings.toLocaleString()}
              </span>
              <span className="text-peated-light text-sm">Tastings</span>
            </div>
            <div className="mb-4 px-3 text-center">
              <span className="block text-xl font-bold uppercase tracking-wide text-white">
                {user.stats.bottles.toLocaleString()}
              </span>
              <span className="text-peated-light text-sm">Bottles</span>
            </div>
            <div className="mb-4 pl-3 text-center">
              <span className="block text-xl font-bold uppercase tracking-wide text-white">
                {user.stats.contributions.toLocaleString()}
              </span>
              <span className="text-peated-light text-sm">Contributions</span>
            </div>
          </div>
        </div>
        <div className="flex w-full flex-col items-center justify-center sm:w-auto sm:items-end">
          <div className="flex gap-x-2">
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
            {currentUser.admin && (
              <Menu as="div" className="menu">
                <Menu.Button as={Button}>
                  <EllipsisVerticalIcon className="h-5 w-5" />
                </Menu.Button>
                <Menu.Items className="absolute right-0 z-10 mt-2 w-64 origin-top-right">
                  <Menu.Item
                    as="button"
                    onClick={async () => {
                      const data = await api.put(`/users/${user.id}`, {
                        data: {
                          mod: !user.mod,
                        },
                      });
                      setUser((state) => ({ ...state, ...data }));
                    }}
                  >
                    {user.mod ? "Remove Moderator Role" : "Add Moderator Role"}
                  </Menu.Item>
                </Menu.Items>
              </Menu>
            )}
          </div>
        </div>
      </div>
      <Tabs fullWidth>
        <Tabs.Item to={`/users/${user.id}`} active>
          Activity
        </Tabs.Item>
        <Tabs.Item to={`/users/${user.id}/collections`}>Collections</Tabs.Item>
      </Tabs>

      {tastingList.results.length ? (
        <TastingList values={tastingList.results} />
      ) : (
        <EmptyActivity>
          Looks like this ones a bit short on tastings.
        </EmptyActivity>
      )}
    </Layout>
  );
}
