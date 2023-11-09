import type { Notification } from "@peated/server/types";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { trpc } from "~/lib/trpc";
import NotificationEntry from "./entry";

export default function NotificationList({
  values,
}: {
  values: Notification[];
}) {
  const [archiveList, setArchiveList] = useState<number[]>([]);
  const [readList, setReadList] = useState<number[]>([]);

  const queryClient = useQueryClient();

  const deleteNotification = trpc.notificationDelete.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications", "count", "unread"]);
      queryClient.invalidateQueries(["notifications", "unread"]);
      queryClient.invalidateQueries(["notifications", "all"]);
    },
  });

  const updateNotification = trpc.notificationUpdate.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications", "count", "unread"]);
      queryClient.invalidateQueries(["notifications", "unread"]);
      queryClient.invalidateQueries(["notifications", "all"]);
    },
  });

  const activeValues = values.filter((n) => archiveList.indexOf(n.id) === -1);

  return (
    <>
      <ul className="divide-y divide-slate-800 sm:rounded">
        {activeValues.map((n) => {
          return (
            <NotificationEntry
              key={n.id}
              notification={{
                ...n,
                read: readList.indexOf(n.id) !== -1 || n.read,
              }}
              onMarkRead={() => {
                updateNotification.mutate({
                  notification: n.id,
                  read: true,
                });
                setReadList((results) => [...results, n.id]);
              }}
              onArchive={() => {
                deleteNotification.mutate(n.id);
                setArchiveList((results) => [...results, n.id]);
              }}
            />
          );
        })}
      </ul>
    </>
  );
}
