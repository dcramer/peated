"use client";

import type { Notification } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";

import {
  Button,
  CursorPager,
  EmptyState,
  IconButton,
} from "@peated/web/components/designSystem/components";
import { Avatar } from "@peated/web/components/designSystem/components/avatar.stylex";
import TimeSince from "@peated/web/components/timeSince";
import { getBottlePlainTextIdentity } from "@peated/web/lib/bottleLabel";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  colors,
  controlMetrics,
  effects,
  fonts,
  space,
} from "../../../styles/tokens.stylex";

export function NotificationList({
  emptyHeading,
  initialNotifications,
  nextHref,
  page,
  previousHref,
}: {
  emptyHeading: string;
  initialNotifications: Notification[];
  nextHref?: string;
  page: number;
  previousHref?: string;
}) {
  const orpc = useORPC();
  const [notifications, setNotifications] = useState(initialNotifications);
  const deleteNotification = useMutation(
    orpc.notifications.delete.mutationOptions(),
  );
  const updateNotification = useMutation(
    orpc.notifications.update.mutationOptions(),
  );
  const createFriend = useMutation(orpc.friends.create.mutationOptions());

  async function archive(id: number) {
    await deleteNotification.mutateAsync({ notification: id });
    setNotifications((values) => values.filter((value) => value.id !== id));
  }

  function markRead(id: number) {
    const notification = notifications.find((value) => value.id === id);
    if (!notification || notification.read) return;
    setNotifications((values) =>
      values.map((value) =>
        value.id === id ? { ...value, read: true } : value,
      ),
    );
    updateNotification.mutate({ notification: id, read: true });
  }

  if (!notifications.length) {
    return (
      <EmptyState heading={emptyHeading}>You're all caught up.</EmptyState>
    );
  }

  return (
    <>
      <ul aria-label="Notifications" {...stylex.props(styles.list)}>
        {notifications.map((notification) => {
          const href = getNotificationHref(notification);
          const from = notification.fromUser;
          return (
            <li
              key={notification.id}
              {...stylex.props(styles.row, !notification.read && styles.unread)}
            >
              <Avatar
                imageUrl={from?.pictureUrl}
                initials={from?.username.slice(0, 2).toLocaleUpperCase() ?? "P"}
              />
              <div {...stylex.props(styles.copy)}>
                <div {...stylex.props(styles.message)}>
                  {from ? (
                    <a
                      href={`/users/${from.username}`}
                      {...stylex.props(styles.author)}
                    >
                      {from.username}
                    </a>
                  ) : null}{" "}
                  {href ? (
                    <a
                      href={href}
                      onClick={() => markRead(notification.id)}
                      {...stylex.props(styles.target)}
                    >
                      {getNotificationMessage(notification)}
                    </a>
                  ) : (
                    getNotificationMessage(notification)
                  )}
                </div>
                <span {...stylex.props(styles.date)}>
                  <TimeSince date={notification.createdAt} />
                </span>
                {notification.type === "friend_request" && notification.ref ? (
                  <div {...stylex.props(styles.friendActions)}>
                    {notification.ref.status === "friends" ? (
                      <span {...stylex.props(styles.friendStatus)}>
                        Friends
                      </span>
                    ) : (
                      <Button
                        loading={createFriend.isPending}
                        onClick={async () => {
                          await createFriend.mutateAsync({
                            user: notification.ref!.userId,
                          });
                          await archive(notification.id);
                        }}
                        size="sm"
                        variant="accent"
                      >
                        Add friend
                      </Button>
                    )}
                  </div>
                ) : null}
              </div>
              <IconButton
                icon={<X aria-hidden="true" size={16} />}
                label="Dismiss notification"
                onClick={() => void archive(notification.id)}
                size="sm"
                variant="text"
              />
            </li>
          );
        })}
      </ul>
      <CursorPager
        ariaLabel="Notification pages"
        nextHref={nextHref}
        page={page}
        previousHref={previousHref}
      />
    </>
  );
}

function getNotificationHref(notification: Notification) {
  switch (notification.type) {
    case "friend_request":
      return notification.fromUser
        ? `/users/${notification.fromUser.username}`
        : undefined;
    case "comment":
    case "toast":
      return notification.ref ? `/tastings/${notification.ref.id}` : undefined;
  }
}

function getNotificationMessage(notification: Notification) {
  switch (notification.type) {
    case "friend_request":
      return "sent you a friend request";
    case "toast":
      return notification.ref
        ? `toasted ${getBottlePlainTextIdentity(notification.ref.bottle)}`
        : "toasted an unavailable tasting";
    case "comment":
      return notification.ref
        ? `commented on ${getBottlePlainTextIdentity(notification.ref.bottle)}`
        : "commented on an unavailable tasting";
  }
}

const styles = stylex.create({
  list: { margin: 0, padding: 0, listStyle: "none" },
  row: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    gap: space.x3,
    paddingTop: space.x4,
    paddingRight: space.x3,
    paddingBottom: space.x4,
    paddingLeft: space.x3,
    borderBottomWidth: "1px",
    borderBottomStyle: "solid",
    borderBottomColor: colors.hairline,
    backgroundColor: "transparent",
    ":first-child": {
      borderTopWidth: "1px",
      borderTopStyle: "solid",
      borderTopColor: colors.hairline,
    },
  },
  unread: { backgroundColor: colors.surface },
  copy: { minWidth: 0, flex: 1 },
  message: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
  },
  author: {
    color: colors.ink,
    fontWeight: 700,
    textDecoration: "none",
    outline: "none",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
  },
  target: {
    color: "inherit",
    textDecoration: "none",
    outline: "none",
    boxShadow: { default: "none", ":focus-visible": effects.focusRing },
    ":hover": { color: colors.ink, textDecoration: "underline" },
  },
  date: {
    display: "block",
    marginTop: space.x1,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
  },
  friendActions: { display: "flex", marginTop: space.x3 },
  friendStatus: {
    display: "inline-flex",
    paddingTop: space.x1,
    paddingRight: space.x2,
    paddingBottom: space.x1,
    paddingLeft: space.x2,
    borderRadius: controlMetrics.radiusSmall,
    backgroundColor: colors.inset,
    color: colors.inkMuted,
    fontFamily: fonts.data,
    fontSize: "10px",
    textTransform: "uppercase",
  },
});
