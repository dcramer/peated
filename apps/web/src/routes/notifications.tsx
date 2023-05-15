import type { LoaderFunction } from "react-router-dom";
import { useLoaderData } from "react-router-dom";

import Layout from "../components/layout";
import NotificationList from "../components/notifications/list";
import api from "../lib/api";
import type { Notification, Paginated } from "../types";

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
  const notificationList = await api.get(`/notifications`, {
    query: { filter: "unread" },
  });

  return { notificationList };
};

export default function Notifications() {
  const { notificationList } = useLoaderData() as LoaderData;

  return (
    <Layout gutter noMobileGutter>
      {notificationList.results.length ? (
        <NotificationList values={notificationList.results} />
      ) : (
        <EmptyActivity />
      )}
    </Layout>
  );
}
