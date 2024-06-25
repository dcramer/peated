"use client";

import type { PolymorphicProps } from "@peated/web/types";
import { usePathname } from "next/navigation";
import type { ElementType } from "react";
import classNames from "../lib/classNames";

type Props = {
  fullWidth?: boolean;
  border?: boolean;
} & React.ComponentPropsWithoutRef<"nav">;

const Tabs = ({ fullWidth, border, ...props }: Props) => {
  return (
    <nav
      className={classNames(
        "-mb-px flex space-x-8",
        fullWidth ? "[&>*]:flex-auto [&>*]:justify-center" : "",
        border ? "border-b border-slate-700" : "",
      )}
      aria-label="Tabs"
      {...props}
    />
  );
};

type ItemProps = {
  active?: boolean;
  count?: number;
  controlled?: boolean;
};

const defaultElement = "button";

export function TabItem<E extends ElementType = typeof defaultElement>({
  as,
  active,
  count,
  children,
  controlled,
  ...props
}: PolymorphicProps<E, ItemProps>) {
  const Component = as ?? defaultElement;

  const pathname = usePathname();

  const activeStyles = "text-highlight border-highlight";
  const inactiveStyles =
    "border-transparent text-light hover:border-light hover:text-slate-400";

  if ("href" in props) {
    if (controlled) active = pathname === props.href;
  }

  const className = classNames(
    active ? activeStyles : inactiveStyles,
    "flex whitespace-nowrap border-b-4 px-1 py-4 text-sm font-medium",
  );

  return (
    <Component className={className} {...props}>
      {children}
      {count !== undefined && (
        <span
          className={classNames(
            "text-light bg-slate-700",
            "ml-3 hidden rounded-full px-2.5 py-0.5 text-xs font-medium md:inline-block",
          )}
        >
          {count}
        </span>
      )}
    </Component>
  );
}

Tabs.Item = TabItem;

export default Tabs;
