"use client";

import Link from "@peated/web/components/link";
import { useLocation } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import classNames from "../lib/classNames";

export default function NavLink(props: ComponentProps<typeof Link>) {
  const location = useLocation();
  const pathname = location.pathname;
  const baseClassNames =
    "focus:ring-highlight relative flex max-w-xs items-center rounded p-2 text-sm hover:bg-slate-800 focus:outline-none focus:ring";
  return (
    <Link
      className={classNames(
        baseClassNames,
        pathname === props.href
          ? "text-highlight"
          : "text-muted hover:text-white"
      )}
      {...props}
    />
  );
}
