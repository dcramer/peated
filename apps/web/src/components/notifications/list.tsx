import { useState } from "react";
import api from "../../lib/api";
import { Notification } from "../../types";
import NotificationEntry from "./entry";

export default function NotificationList({
  values,
}: {
  values: Notification[];
}) {
  const [archiveList, setArchiveList] = useState<number[]>([]);

  const archive = async (notification: Notification) => {
    await api.delete(`/notifications/${notification.id}`);
    setArchiveList((results) => [...results, notification.id]);
  };

  const activeValues = values.filter((n) => archiveList.indexOf(n.id) === -1);

  return (
    <ul role="list" className="divide-y divide-gray-100">
      {activeValues.map((n) => {
        return (
          <NotificationEntry
            key={n.id}
            notification={n}
            onArchive={() => {
              archive(n);
            }}
          />
        );
      })}
    </ul>
  );
}
