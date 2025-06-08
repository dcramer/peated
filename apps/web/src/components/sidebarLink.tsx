import classNames from "@peated/web/lib/classNames";
import type { PolymorphicProps, PolymorphicRef } from "@peated/web/types";
import { Link } from "@tanstack/react-router";
import { type ElementType, forwardRef } from "react";

type Props = {
  active?: boolean;
  icon?: ElementType;
  size?: "small" | "default";
};

const defaultElement = Link;

export default forwardRef(function SidebarLink<
  E extends ElementType = typeof defaultElement,
>(
  {
    children,
    active,
    icon,
    size = "default",
    as,
    ...props
  }: PolymorphicProps<E, Props>,
  ref: PolymorphicRef<E>
) {
  const Component = as ?? defaultElement;
  const Icon = icon;

  return (
    <li>
      <Component
        to="."
        className={classNames(
          active
            ? "border-highlight text-highlight"
            : "border-transparent text-muted hover:border-slate-400 hover:text-slate-400",
          "relative cursor-pointer border-l-4",
          "group flex gap-x-3 font-semibold text-sm leading-6",
          size === "default" ? "p-2" : "px-2"
        )}
        ref={ref}
        {...props}
      >
        {Icon && (
          <Icon
            className={classNames(
              active
                ? "text-highlight"
                : "text-muted group-hover:text-slate-400",
              "h-6 w-6 shrink-0"
            )}
            aria-hidden="true"
          />
        )}
        {children}
      </Component>
    </li>
  );
});
