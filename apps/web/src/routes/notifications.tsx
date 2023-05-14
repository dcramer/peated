import type { LoaderFunction } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import { Link } from "react-router-dom";
import Layout from "../components/layout";
import ListItem from "../components/listItem";
import TimeSince from "../components/timeSince";
import UserAvatar from "../components/userAvatar";
import api from "../lib/api";
import type { Notification, Paginated } from "../types";

const NotificationItem = ({ notification }: { notification: Notification }) => {
  switch (notification.objectType) {
    case "follow":
      return <div>requested to follow you</div>;
  }
};

const EmptyActivity = () => {
  return (
    <div className="m-4 mx-auto flex flex-col items-center rounded-lg border border-dashed border-gray-300 p-12">
      <span className="block font-light text-gray-400">
        You don't have any unread notifications.
      </span>
    </div>
  );
};

type LoaderData = {
  notificationList: Paginated<Notification>;
};

// TODO: when this executes the apiClient has not configured
// its token yet as react-dom (thus context) seemingly has
// not rendered.. so this errors out
export const loader: LoaderFunction = async (): Promise<LoaderData> => {
  const notificationList = await api.get(`/notifications`);

  return { notificationList };
};

export default function Notifications() {
  const { notificationList } = useLoaderData() as LoaderData;

  return (
    <Layout gutter noMobileGutter>
      <ul role="list" className="divide-y divide-gray-100">
        {notificationList.results.length ? (
          notificationList.results.map(({ fromUser, ...notification }) => {
            return (
              <ListItem
                key={[notification.objectId, notification.objectType].join("-")}
              >
                <div className="mb-4 flex flex-1  items-center space-x-4">
                  {fromUser && (
                    <>
                      <span className="w-48-px h-48-px overflow-hidden rounded bg-gray-100">
                        <UserAvatar size={48} user={fromUser} />
                      </span>
                      <div className="text-peated flex-1 space-y-1 font-medium">
                        <Link
                          to={`/users/${fromUser.id}`}
                          className="hover:underline"
                        >
                          {fromUser.displayName}
                        </Link>
                        <TimeSince
                          className="block text-sm font-light text-gray-500 dark:text-gray-400"
                          date={notification.createdAt}
                        />
                      </div>
                    </>
                  )}
                  <NotificationItem notification={notification} />
                </div>
              </ListItem>
            );
          })
        ) : (
          <EmptyActivity />
        )}
      </ul>
    </Layout>
  );
}
