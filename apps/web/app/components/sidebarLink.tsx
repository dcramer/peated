import { Link } from "@remix-run/react";
import { forwardRef, type ElementType } from "react";
import classNames from "~/lib/classNames";
import { type PolymorphicProps, type PolymorphicRef } from "~/types";

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
  ref: PolymorphicRef<E>,
) {
  const Component = as ?? defaultElement;

  const Icon = icon;
  return (
    <li>
      <Component
        className={classNames(
          active
            ? "text-highlight border-highlight"
            : "border-transparent text-slate-500 hover:border-slate-400 hover:text-slate-400",
          "relative border-l-4",
          "group flex gap-x-3 text-sm font-semibold leading-6",
          size === "default" ? "p-2" : "px-2",
        )}
        ref={ref}
        {...props}
      >
        {Icon && (
          <Icon
            className={classNames(
              active
                ? "text-highlight"
                : "text-slate-500 group-hover:text-slate-400",
              "h-6 w-6 shrink-0",
            )}
            aria-hidden="true"
          />
        )}
        {children}
      </Component>
    </li>
  );
});
