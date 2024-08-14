"use client";

import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import SearchHeaderForm from "./form";

export default function SearchHeader(
  props: ComponentPropsWithoutRef<typeof SearchHeaderForm>,
) {
  const router = useRouter();

  const blockStyles = ``;

  return (
    <nav className="flex min-w-full items-stretch justify-between gap-x-4 text-white">
      <div className="flex items-center">
        <button
          onClick={() => router.back()}
          className={`${blockStyles} text-muted group flex justify-center`}
        >
          <div className="-my-1 rounded bg-slate-800 p-1 group-hover:bg-slate-700 group-hover:text-white">
            <ChevronLeftIcon className="h-8 w-8" />
          </div>
        </button>
      </div>
      <SearchHeaderForm {...props} />
    </nav>
  );
}
