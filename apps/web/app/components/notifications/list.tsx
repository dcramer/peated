import type { Notification } from "@peated/core/types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import useApi from "~/hooks/useApi";
import NotificationEntry from "./entry";

export default function NotificationList({
  values,
}: {
  values: Notification[];
}) {
  const [archiveList, setArchiveList] = useState<number[]>([]);
  const [readList, setReadList] = useState<number[]>([]);

  const api = useApi();

  const queryClient = useQueryClient();

  const deleteNotification = useMutation({
    mutationFn: async (notification: Notification) => {
      await api.delete(`/notifications/${notification.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications", "count", "unread"]);
      queryClient.invalidateQueries(["notifications", "unread"]);
      queryClient.invalidateQueries(["notifications", "all"]);
    },
  });

  const markNotificationRead = useMutation({
    mutationFn: async (notification: Notification) => {
      await api.put(`/notifications/${notification.id}`, {
        data: { read: true },
      });
    },
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
                markNotificationRead.mutate(n);
                setReadList((results) => [...results, n.id]);
              }}
              onArchive={() => {
                deleteNotification.mutate(n);
                setArchiveList((results) => [...results, n.id]);
              }}
            />
          );
        })}
      </ul>
    </>
  );
}
