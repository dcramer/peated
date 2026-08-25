"use client";

import Link from "@peated/web/components/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import classNames from "../lib/classNames";

type Props = ComponentProps<typeof Link> & {
  selected?: boolean;
};

export default function NavLink({ selected, ...props }: Props) {
  const pathname = usePathname();
  const active = selected ?? pathname === props.href;
  const baseClassNames =
    "focus:ring-highlight relative flex max-w-xs items-center rounded p-2 text-sm hover:bg-slate-800 focus:outline-none focus:ring";
  return (
    <Link
      className={classNames(
        baseClassNames,
        active ? "text-highlight" : "text-muted hover:text-white",
      )}
      {...props}
    />
  );
}
