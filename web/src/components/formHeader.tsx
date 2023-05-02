import { useNavigate } from "react-router-dom";
import { ChevronLeftIcon } from "@heroicons/react/20/solid";
import { FormEvent } from "react";

export default function FormHeader({
  onSave,
  title,
  subtitle,
}: {
  onSave: (e: FormEvent<HTMLFormElement | HTMLButtonElement>) => void;
  title: string;
  subtitle?: string | undefined | null;
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
          <ChevronLeftIcon className="h-8 w-8" />
        </button>
      </div>
      <div
        className={`flex flex-1 flex-row gap-x-2 justify-center ${blockStyles}`}
      >
        <h1 className="text-md sm:text-lg">{title}</h1>
        {subtitle && (
          <h2 className="hidden sm:block text-sm text-peated-light truncate">
            {subtitle}
          </h2>
        )}
      </div>
      <div className="flex">
        <button
          onClick={onSave}
          className={`min-h-full group ${blockStyles} pl-3 sm:pl-6`}
        >
          <span className="rounded bg-peated-dark group-hover:bg-peated-darker px-2.5 p-1 sm:px-2.5 sm:py-2.5 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated">
            Save
          </span>
        </button>
      </div>
    </nav>
  );
}
