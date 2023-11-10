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

  const blockStyles = `px-0 py-1 sm:py-3`;

  return (
    <nav className="flex min-w-full items-center justify-between text-white">
      <div className="flex text-white hover:text-white">
        <button
          onClick={() => (onClose ? onClose() : navigate(-1))}
          className={`-m-1.5 p-1.5 ${blockStyles} pr-3 sm:pr-6`}
        >
          <span className="sr-only">Back</span>
          <div className="h-10 w-10">
            {icon || <ChevronLeftIcon className="h-10 w-10" />}
          </div>
        </button>
      </div>
      <div
        className={`flex flex-auto flex-row justify-center gap-x-2 ${blockStyles}`}
      >
        <h1 className="text-lg">{title}</h1>
        {subtitle && (
          <h2 className="text-light hidden truncate text-sm sm:block">
            {subtitle}
          </h2>
        )}
      </div>
      <div className="flex">
        <button
          onClick={!saveDisabled ? onSave : undefined}
          className={classNames(
            `group min-h-full pl-3 sm:pl-6`,
            blockStyles,
            saveDisabled ? "cursor-auto" : "",
          )}
        >
          <span
            className={classNames(
              "rounded p-2.5 font-semibold shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
              saveDisabled
                ? "bg-peated-dark text-peated"
                : "group-hover:text-highlight focus-visible:outline-peatedt bg-slate-950 text-white",
            )}
          >
            {saveLabel}
          </span>
        </button>
      </div>
    </nav>
  );
}
