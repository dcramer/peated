"use client";

import Link from "@peated/web/components/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import classNames from "../lib/classNames";

export default function NavLink(props: ComponentProps<typeof Link>) {
  const pathname = usePathname();
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
