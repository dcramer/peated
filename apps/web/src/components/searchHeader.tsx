"use client";

import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import SearchHeaderForm from "./searchHeaderForm";

export default function SearchHeader({
  onClose,
  onDone,
  closeIcon = <ChevronLeftIcon className="h-8 w-8" />,
  ...props
}: ComponentPropsWithoutRef<typeof SearchHeaderForm> & {
  closeIcon?: ReactNode;
  onClose?: () => void;
  onDone?: () => void;
}) {
  const router = useRouter();

  const blockStyles = ``;

  return (
    <nav className="flex min-w-full items-stretch justify-between gap-x-4 text-white">
      <div className="flex items-center">
        <button
          onClick={() => (onClose ? onClose() : router.back())}
          className={`${blockStyles} text-muted group flex justify-center`}
        >
          <div className="-my-1 rounded bg-slate-800 p-1 group-hover:bg-slate-700 group-hover:text-white">
            {closeIcon}
          </div>
        </button>
      </div>
      <SearchHeaderForm {...props} />
      {onDone && (
        <div className="flex">
          <button
            onClick={onDone}
            className={`group min-h-full ${blockStyles}`}
          >
            <span className="text-muted rounded bg-slate-800 p-2.5 font-semibold group-hover:bg-slate-700 group-hover:text-white">
              Done
            </span>
          </button>
        </div>
      )}
    </nav>
  );
}
