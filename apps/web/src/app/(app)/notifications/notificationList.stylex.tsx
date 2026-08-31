"use client";

import type { Notification } from "@peated/server/types";
import * as stylex from "@stylexjs/stylex";
import { useMutation } from "@tanstack/react-query";
import { X } from "lucide-react";
import { useState } from "react";

import { formatBottleDisplayName } from "@peated/server/lib/bottleDisplayName";
import {
  Button,
  CursorPager,
  EmptyState,
  IconButton,
  ItemList,
  ItemListItem,
  TextLink,
} from "@peated/web/components";
import { Avatar } from "@peated/web/components/avatar.stylex";
import { useFlashMessages } from "@peated/web/components/flashMessages.stylex";
import TimeSince from "@peated/web/components/timeSince";
import { getFormErrorMessage } from "@peated/web/lib/formHelpers";
import { logError } from "@peated/web/lib/log";
import { useORPC } from "@peated/web/lib/orpc/context";
import {
  colors,
  controlMetrics,
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
  const { flash } = useFlashMessages();
  const [notifications, setNotifications] = useState(initialNotifications);
  const [acceptingNotificationId, setAcceptingNotificationId] =
    useState<number>();
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

  async function acceptFriend(notificationId: number, userId: number) {
    setAcceptingNotificationId(notificationId);
    let friendAdded = false;
    try {
      const friend = await createFriend.mutateAsync({ user: userId });
      friendAdded = true;
      setNotifications((values) =>
        values.map((value) =>
          value.id === notificationId &&
          value.type === "friend_request" &&
          value.ref
            ? { ...value, ref: { ...value.ref, status: friend.status } }
            : value,
        ),
      );
      await archive(notificationId);
    } catch (caught) {
      if (friendAdded) {
        logError(caught, { context: "notification_archive_after_friend" });
        flash(
          "Friend added. We couldn't dismiss this notification. Try again.",
          "error",
        );
        return;
      }

      flash(
        getFormErrorMessage(caught, {
          fallbackMessage: "We couldn't add this friend. Try again.",
        }),
        "error",
      );
    } finally {
      setAcceptingNotificationId(undefined);
    }
  }

  async function dismiss(notificationId: number) {
    try {
      await archive(notificationId);
    } catch (caught) {
      logError(caught, { context: "notification_archive" });
      flash("We couldn't dismiss this notification. Try again.", "error");
    }
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
      <ItemList ariaLabel="Notifications">
        {notifications.map((notification) => {
          const href = getNotificationHref(notification);
          const from = notification.fromUser;
          return (
            <ItemListItem key={notification.id}>
              <div
                {...stylex.props(
                  styles.row,
                  !notification.read && styles.unread,
                )}
              >
                <Avatar
                  imageUrl={from?.pictureUrl}
                  initials={
                    from?.username.slice(0, 2).toLocaleUpperCase() ?? "P"
                  }
                />
                <div {...stylex.props(styles.copy)}>
                  <div {...stylex.props(styles.message)}>
                    {from ? (
                      <TextLink href={`/users/${from.username}`} size="inherit">
                        {from.username}
                      </TextLink>
                    ) : null}{" "}
                    {href ? (
                      <TextLink
                        href={href}
                        onClick={() => markRead(notification.id)}
                        size="inherit"
                      >
                        {getNotificationMessage(notification)}
                      </TextLink>
                    ) : (
                      getNotificationMessage(notification)
                    )}
                  </div>
                  <span {...stylex.props(styles.date)}>
                    <TimeSince date={notification.createdAt} />
                  </span>
                  {notification.type === "friend_request" &&
                  notification.ref ? (
                    <div {...stylex.props(styles.friendActions)}>
                      {notification.ref.status === "friends" ? (
                        <span {...stylex.props(styles.friendStatus)}>
                          Friends
                        </span>
                      ) : (
                        <Button
                          disabled={acceptingNotificationId !== undefined}
                          loading={acceptingNotificationId === notification.id}
                          onClick={() =>
                            void acceptFriend(
                              notification.id,
                              notification.ref!.userId,
                            )
                          }
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
                  disabled={
                    deleteNotification.isPending ||
                    acceptingNotificationId === notification.id
                  }
                  icon={<X aria-hidden="true" size={16} />}
                  label="Dismiss notification"
                  onClick={() => void dismiss(notification.id)}
                  size="sm"
                  variant="text"
                />
              </div>
            </ItemListItem>
          );
        })}
      </ItemList>
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
        ? `toasted ${formatBottleDisplayName(notification.ref.bottle)}`
        : "toasted an unavailable tasting";
    case "comment":
      return notification.ref
        ? `commented on ${formatBottleDisplayName(notification.ref.bottle)}`
        : "commented on an unavailable tasting";
  }
}

const styles = stylex.create({
  row: {
    display: "flex",
    minWidth: 0,
    alignItems: "flex-start",
    gap: space.x3,
    paddingTop: space.x4,
    paddingRight: space.x3,
    paddingBottom: space.x4,
    paddingLeft: space.x3,
    backgroundColor: "transparent",
  },
  unread: { backgroundColor: colors.surface },
  copy: { minWidth: 0, flex: 1 },
  message: {
    color: colors.inkMuted,
    fontFamily: fonts.reading,
    fontSize: "13px",
    lineHeight: 1.45,
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
