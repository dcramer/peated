import classNames from "@peated/web/lib/classNames";
import { Link } from "@tanstack/react-router";
import { type ElementType, type ReactNode, forwardRef } from "react";
import { Slot } from "./slot";

type Props = {
  active?: boolean;
  icon?: ElementType;
  size?: "small" | "default";
  asChild?: boolean;
  children?: ReactNode;
} & React.ComponentPropsWithoutRef<typeof Link>;

export default forwardRef<HTMLAnchorElement, Props>(function SidebarLink(
  { children, active, icon, size = "default", asChild = false, ...props },
  ref
) {
  const Component = asChild ? Slot : Link;
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
        {asChild ? (
          children
        ) : (
          <>
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
          </>
        )}
      </Component>
    </li>
  );
});
