import { Link } from "@remix-run/react";
import { type ElementType, type PropsWithChildren } from "react";
import classNames from "~/lib/classNames";

export default function SidebarLink({
  to,
  active = false,
  icon,
  children,
  size = "default",
}: PropsWithChildren<{
  to: string | Record<string, any>;
  active?: boolean;
  icon?: ElementType;
  size?: "small" | "default";
}>) {
  const Icon = icon;
  return (
    <li>
      <Link
        to={to}
        className={classNames(
          active
            ? "text-highlight border-highlight"
            : "border-transparent text-slate-500 hover:border-slate-400 hover:text-slate-400",
          "relative border-l-4",
          "group flex gap-x-3 text-sm font-semibold leading-6",
          size === "default" ? "p-2" : "px-2",
        )}
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
      </Link>
    </li>
  );
}
