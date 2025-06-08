import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

type Props =
  | {
      to: string;
      children?: ReactNode;
    }
  | {
      to?: never;
      children?: ReactNode;
    };

export default function EmptyActivity({ to, children }: Props) {
  const baseStyles =
    "border-slate-700 text-muted m-3 sm:my-4 flex flex-col items-center rounded-lg border border-dashed p-12 font-muted";

  if (to) {
    return (
      <Link
        className={`${baseStyles} group hover:border-slate-400 hover:text-slate-400`}
        to={to}
      >
        {children}
      </Link>
    );
  }
  return <div className={baseStyles}>{children}</div>;
}
