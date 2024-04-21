import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { useNavigate } from "@remix-run/react";
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
  const navigate = useNavigate();

  const blockStyles = `p-3`;

  return (
    <nav className="flex min-w-full items-stretch justify-between text-white lg:mx-3">
      <div className="text-light -mx-3 flex hover:text-white">
        <button
          onClick={() => (onClose ? onClose() : navigate(-1))}
          className={`${blockStyles} flex items-stretch hover:bg-slate-800`}
        >
          <span className="sr-only">Back</span>
          <div className="h-8 w-8">
            {icon || <ChevronLeftIcon className="h-full w-full" />}
          </div>
        </button>
      </div>
      <div
        className={`flex flex-auto flex-row items-center justify-center gap-x-2 ${blockStyles}`}
      >
        <h1 className="text-lg">{title}</h1>
        {subtitle && (
          <h2 className="text-light hidden truncate text-sm sm:block">
            {subtitle}
          </h2>
        )}
      </div>
      <div className="-mx-3">
        <button
          onClick={!saveDisabled ? onSave : undefined}
          className={classNames(
            `text-light min-h-full hover:bg-slate-800 hover:text-white`,
            blockStyles,
            saveDisabled ? "cursor-auto" : "",
          )}
        >
          <div
            className={classNames(
              "-my-3 rounded p-3 font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              saveDisabled
                ? "bg-peated-dark text-peated"
                : "focus-visible:outline-peated",
            )}
          >
            {saveLabel}
          </div>
        </button>
      </div>
    </nav>
  );
}
