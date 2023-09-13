import type {
  ComponentPropsWithoutRef,
  ElementType,
  PropsWithChildren,
} from "react";

import type { FollowSchema, TastingSchema } from "@peated/shared/schemas";
import type { Notification, User } from "@peated/shared/types";
import type { z } from "zod";

export type FollowNotification = Notification & {
  objectType: "follow";
  ref: z.infer<typeof FollowSchema>;
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

export type PolymorphicProps<E extends ElementType> = PropsWithChildren<
  ComponentPropsWithoutRef<E> & PolymorphicAsProp<E>
>;
