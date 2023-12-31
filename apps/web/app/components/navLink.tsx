import { NavLink as RRNavLink } from "@remix-run/react";
import type { ComponentProps } from "react";
import classNames from "../lib/classNames";

export default function NavLink(props: ComponentProps<typeof RRNavLink>) {
  const baseClassNames =
    "focus:ring-highlight relative flex max-w-xs items-center rounded p-2 text-sm hover:bg-slate-800 focus:outline-none focus:ring";
  return (
    <RRNavLink
      className={({ isActive, isPending }) =>
        classNames(
          baseClassNames,
          isActive ? "text-highlight" : "text-light hover:text-white",
        )
      }
      {...props}
    />
  );
}
