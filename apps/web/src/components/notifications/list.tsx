import type { Notification } from "@peated/server/types";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import NotificationEntry from "./entry";

export default function NotificationList({
  values,
}: {
  values: Notification[];
}) {
  const [archiveList, setArchiveList] = useState<number[]>([]);
  const [readList, setReadList] = useState<number[]>([]);

  const orpc = useORPC();
  const deleteNotification = useMutation(
    orpc.notifications.delete.mutationOptions(),
  );
  const updateNotification = useMutation(
    orpc.notifications.update.mutationOptions(),
  );

  const activeValues = values.filter((n) => !archiveList.includes(n.id));

  return (
    <>
      <ul className="divide-y divide-slate-800 sm:rounded">
        {activeValues.map((n) => {
          return (
            <NotificationEntry
              key={n.id}
              notification={{
                ...n,
                read: readList.includes(n.id) || n.read,
              }}
              onMarkRead={() => {
                updateNotification.mutate({
                  notification: n.id,
                  read: true,
                });
                setReadList((results) => [...results, n.id]);
              }}
              onArchive={() => {
                deleteNotification.mutate({
                  notification: n.id,
                });
                setArchiveList((results) => [...results, n.id]);
              }}
            />
          );
        })}
      </ul>
    </>
  );
}
