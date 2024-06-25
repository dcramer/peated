import classNames from "@peated/web/lib/classNames";
import { type PolymorphicProps, type PolymorphicRef } from "@peated/web/types";
import Link from "next/link";
import { forwardRef, type ElementType } from "react";

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
        href=""
        className={classNames(
          active
            ? "text-highlight border-highlight"
            : "text-light border-transparent hover:border-slate-400 hover:text-slate-400",
          "relative cursor-pointer border-l-4",
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
                : "text-light group-hover:text-slate-400",
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
