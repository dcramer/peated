import type {
  ComponentPropsWithRef,
  ComponentPropsWithoutRef,
  ElementType,
  PropsWithChildren,
} from "react";

import type { FriendSchema, TastingSchema } from "@peated/server/schemas";
import type { Notification, User } from "@peated/server/types";
import type { z } from "zod";

export type FriendRequestNotification = Notification & {
  objectType: "friend_request";
  ref: z.infer<typeof FriendSchema>;
};

export type ToastNotification = Notification & {
  objectType: "toast";
  ref: z.infer<typeof TastingSchema>;
};

export type CommentNotification = Notification & {
  objectType: "comment";
  ref: z.infer<typeof TastingSchema>;
};

// locations are where you're tasting from (e.g. a bar, a distillery)
export type Location = {
  id: number;
  name: string;
};

export type SessionPayload = {
  user: User;
  accessToken: string;
};

export type PolymorphicAsProp<E extends ElementType> = {
  as?: E;
};

type PropsToOmit<E extends ElementType, P> = keyof (PolymorphicAsProp<E> & P);

export type PolymorphicProps<
  E extends ElementType,
  Props = Record<string, never>,
> = PropsWithChildren<
  Props &
    Omit<ComponentPropsWithoutRef<E>, PropsToOmit<E, Props>> &
    PolymorphicAsProp<E>
>;

export type PolymorphicRef<E extends ElementType> =
  ComponentPropsWithRef<E>["ref"];
