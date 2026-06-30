import Link from "@peated/web/components/link";
import classNames from "@peated/web/lib/classNames";
import {
  forwardRef,
  type AnchorHTMLAttributes,
  type ComponentProps,
  type ElementType,
  type PropsWithChildren,
} from "react";

type Props = {
  active?: boolean;
  icon?: ElementType;
  size?: "small" | "default";
};

const defaultElement = Link;

type SidebarLinkProps = PropsWithChildren<
  Props &
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "href"> & {
      as?: ElementType;
      href?: ComponentProps<typeof Link>["href"] | string;
    }
>;

export default forwardRef<HTMLAnchorElement, SidebarLinkProps>(
  function SidebarLink(
    { children, active, icon, size = "default", as, href, ...props },
    ref,
  ) {
    const Component = (as ?? defaultElement) as ElementType;
    const Icon = icon;

    return (
      <li>
        <Component
          href={href ?? ""}
          className={classNames(
            active
              ? "text-highlight border-highlight"
              : "text-muted border-transparent hover:border-slate-400 hover:text-slate-400",
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
                  : "text-muted group-hover:text-slate-400",
                "h-6 w-6 shrink-0",
              )}
              aria-hidden="true"
            />
          )}
          {children}
        </Component>
      </li>
    );
  },
);
