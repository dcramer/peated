import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import classNames from "../lib/classNames";

export default function FormHeader({
  onSave,
  title,
  subtitle,
  saveDisabled = false,
}: {
  onSave: (e: FormEvent<HTMLFormElement | HTMLButtonElement>) => void;
  title: string;
  subtitle?: string | undefined | null;
  saveDisabled?: boolean;
}) {
  const navigate = useNavigate();

  const blockStyles = `px-0 py-1 sm:py-3`;

  return (
    <nav className="flex min-w-full items-center justify-between text-white">
      <div className="flex text-white hover:text-white">
        <button
          onClick={() => navigate(-1)}
          className={`-m-1.5 p-1.5 ${blockStyles} pr-3 sm:pr-6`}
        >
          <span className="sr-only">Back</span>
          <ChevronLeftIcon className="h-10 w-10" />
        </button>
      </div>
      <div
        className={`flex flex-1 flex-row justify-center gap-x-2 ${blockStyles}`}
      >
        <h1 className="text-lg">{title}</h1>
        {subtitle && (
          <h2 className="text-peated-light hidden truncate text-sm sm:block">
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
            Save
          </span>
        </button>
      </div>
    </nav>
  );
}
