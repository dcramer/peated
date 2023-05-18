import { Menu } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/20/solid";
import { useState } from "react";
import { Outlet, useParams } from "react-router-dom";
import Button from "../components/button";
import Chip from "../components/chip";
import Layout from "../components/layout";
import Tabs from "../components/tabs";
import UserAvatar from "../components/userAvatar";
import { useRequiredAuth } from "../hooks/useAuth";
import { useSuspenseQuery } from "../hooks/useSuspenseQuery";
import api from "../lib/api";
import type { FollowStatus, User } from "../types";

type UserDetails = User & {
  followStatus?: FollowStatus;
  stats: {
    bottles: number;
    tastings: number;
    contributions: number;
  };
};

export default function Profile() {
  const { user: currentUser } = useRequiredAuth();
  const { userId } = useParams();
  const { data } = useSuspenseQuery(
    ["user", userId],
    (): Promise<UserDetails> => api.get(`/users/${userId}`),
  );
  const [user, setUser] = useState<UserDetails>(data);
  const [followStatus, setFollowStatus] = useState(data.followStatus);

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
          <div className="mb-4 self-center sm:self-start">
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
        <Tabs.Item to={`/users/${user.username}`} controlled>
          Activity
        </Tabs.Item>
        <Tabs.Item to={`/users/${user.username}/collections`} controlled>
          Collections
        </Tabs.Item>
      </Tabs>
      <Outlet context={{ user }} />
    </Layout>
  );
}
