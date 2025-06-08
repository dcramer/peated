import { useLocation } from "@tanstack/react-router";
import React from "react";
import classNames from "../lib/classNames";
import { Slot } from "./slot";

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
        border ? "border-slate-700 border-b" : "",
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
  asChild?: boolean;
  children: React.ReactNode;
} & React.ComponentPropsWithoutRef<"button">;

export function TabItem({
  active,
  count,
  children,
  controlled,
  desktopOnly,
  asChild,
  ...props
}: ItemProps) {
  const Component = asChild ? Slot : "button";
  const location = useLocation();
  const pathname = location.pathname;

  const activeStyles = "text-highlight border-highlight";
  const inactiveStyles =
    "border-transparent text-muted hover:border-muted hover:text-slate-400";

  // For controlled tabs with asChild, we need to check if the child is a Link
  // and extract its 'to' prop to determine active state
  if (controlled && asChild && React.isValidElement(children)) {
    const childProps = children.props as any;
    if (childProps.to) {
      // Handle TanStack Router Link with 'to' prop
      const linkPath =
        typeof childProps.to === "string" ? childProps.to : childProps.to;
      active = pathname === linkPath;
    }
  }

  const className = classNames(
    active ? activeStyles : inactiveStyles,
    "whitespace-nowrap border-b-4 px-3 py-4 text-sm font-medium",
    desktopOnly ? "hidden lg:flex" : "flex"
  );

  return (
    <Component className={className} {...props}>
      {asChild ? (
        children
      ) : (
        <>
          {children}
          {count !== undefined && (
            <span
              className={classNames(
                "bg-slate-700 text-muted",
                "ml-3 hidden rounded-full px-2.5 py-0.5 font-medium text-xs md:inline-block"
              )}
            >
              {count}
            </span>
          )}
        </>
      )}
    </Component>
  );
}
export default Tabs;
