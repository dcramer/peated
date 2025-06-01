"use client";

import type { PolymorphicProps } from "@peated/web/types";
import { usePathname } from "next/navigation";
import type { ElementType } from "react";
import classNames from "../lib/classNames";

type Props = {
  fullWidth?: boolean;
  noMargin?: boolean;
  border?: boolean;
} & React.ComponentPropsWithoutRef<"nav">;

const Tabs = ({ fullWidth, border, noMargin, ...props }: Props) => {
  return (
    <nav
      className={classNames(
        "flex space-x-8",
        fullWidth
          ? "[&>*]:flex-auto [&>*]:justify-center"
          : "max-lg:[&>*]:flex-auto max-lg:[&>*]:justify-center",
        border ? "border-b border-slate-700" : "",
        noMargin ? "-mb-px" : "mb-4"
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
  desktopOnly?: boolean;
};

const defaultElement = "button";

export function TabItem<E extends ElementType = typeof defaultElement>({
  as,
  active,
  count,
  children,
  controlled,
  desktopOnly,
  ...props
}: PolymorphicProps<E, ItemProps>) {
  const Component = as ?? defaultElement;

  const pathname = usePathname();

  const activeStyles = "text-highlight border-highlight";
  const inactiveStyles =
    "border-transparent text-muted hover:border-muted hover:text-slate-400";

  if ("href" in props) {
    if (controlled) active = pathname === props.href;
  }

  const className = classNames(
    active ? activeStyles : inactiveStyles,
    "whitespace-nowrap border-b-4 px-3 py-4 text-sm font-medium",
    desktopOnly ? "hidden lg:flex" : "flex"
  );

  return (
    <Component className={className} {...props}>
      {children}
      {count !== undefined && (
        <span
          className={classNames(
            "text-muted bg-slate-700",
            "ml-3 hidden rounded-full px-2.5 py-0.5 text-xs font-medium md:inline-block"
          )}
        >
          {count}
        </span>
      )}
    </Component>
  );
}
export default Tabs;
