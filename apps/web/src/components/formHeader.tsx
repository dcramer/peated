"use client";

import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { useRouter } from "next/navigation";
import type { FormEvent, ReactNode } from "react";
import classNames from "../lib/classNames";

export default function FormHeader({
  onClose,
  onSave,
  title,
  subtitle,
  icon,
  saveDisabled = false,
  saveLabel = "Save",
}: {
  title: string;
  subtitle?: string | undefined | null;
  icon?: ReactNode;
  saveDisabled?: boolean;
  saveLabel?: string;
  onClose?: () => void;
  onSave: (e: FormEvent<HTMLFormElement | HTMLButtonElement>) => void;
}) {
  const router = useRouter();

  const blockStyles = `p-3`;

  return (
    <nav className="flex min-w-full items-stretch justify-between text-white lg:mx-3">
      <div className="-mx-3 flex justify-center">
        <button
          onClick={() => (onClose ? onClose() : router.back())}
          className={`${blockStyles} text-muted group`}
        >
          <div className="sr-only">Back</div>
          <div className="-my-1 rounded bg-slate-800 p-1 group-hover:bg-slate-700 group-hover:text-white">
            {icon || <ChevronLeftIcon className="h-8 w-8" />}
          </div>
        </button>
      </div>
      <div
        className={`flex flex-auto flex-row items-center justify-center gap-x-2 ${blockStyles}`}
      >
        <h1 className="text-lg">{title}</h1>
        {subtitle && (
          <h2 className="text-muted hidden truncate text-sm sm:block">
            {subtitle}
          </h2>
        )}
      </div>
      <div className="-mr-3 flex justify-center lg:mr-3">
        <button
          onClick={!saveDisabled ? onSave : undefined}
          className={classNames(
            `text-muted group hover:text-white`,
            blockStyles,
            saveDisabled ? "cursor-auto" : ""
          )}
        >
          <div
            className={classNames(
              "rounded p-3 py-1.5 font-semibold shadow-sm",
              saveDisabled
                ? "bg-peated-dark text-peated"
                : "bg-slate-800 group-hover:bg-slate-700"
            )}
          >
            {saveLabel}
          </div>
        </button>
      </div>
    </nav>
  );
}
