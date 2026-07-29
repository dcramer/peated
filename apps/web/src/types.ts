import type {
  ComponentPropsWithRef,
  ComponentPropsWithoutRef,
  ElementType,
  PropsWithChildren,
} from "react";

import type { User } from "@peated/server/types";

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
  Props = unknown,
> = PropsWithChildren<
  Props &
    Omit<ComponentPropsWithoutRef<E>, PropsToOmit<E, Props>> &
    PolymorphicAsProp<E>
>;

export type PolymorphicRef<E extends ElementType> =
  ComponentPropsWithRef<E>["ref"];
