import { ArrowRightIcon } from "@heroicons/react/20/solid";
import Link from "@peated/web/components/link";
import type { ReactNode } from "react";

export default function HomepageSectionHeading({
  id,
  title,
  href,
  linkLabel,
  actions,
  artwork,
}: {
  id?: string;
  title: string;
  href?: string;
  linkLabel?: string;
  actions?: ReactNode;
  artwork?: string;
}) {
  return (
    <div className="relative isolate -mx-3 overflow-hidden border-b border-slate-700/60 bg-slate-900/70 px-3 sm:mx-0 sm:px-0">
      {artwork ? (
        <>
          <img
            src={artwork}
            alt=""
            className="absolute inset-0 -z-20 h-full w-full object-cover object-center opacity-35 sm:left-auto sm:w-[44%] sm:object-right"
          />
          <div
            className="absolute inset-0 -z-10 bg-slate-950/50 sm:bg-gradient-to-r sm:from-slate-900 sm:via-slate-900/90 sm:to-slate-950/25"
            aria-hidden="true"
          />
        </>
      ) : null}
      <div className="flex min-h-20 items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0">
          <h2
            id={id}
            className="text-xl font-semibold tracking-tight text-white sm:text-3xl"
          >
            {title}
          </h2>
        </div>
        <div
          className={
            actions
              ? "ml-auto flex items-center gap-4"
              : "hidden items-center gap-4 sm:flex"
          }
        >
          {href && linkLabel ? (
            <Link
              href={href}
              className="text-muted hidden items-center gap-1 text-sm font-semibold hover:text-white sm:flex"
            >
              {linkLabel}
              <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
            </Link>
          ) : null}
          {actions}
        </div>
      </div>
    </div>
  );
}
