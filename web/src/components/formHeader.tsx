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
  subtitle?: string;
}) {
  const navigate = useNavigate();

  return (
    <nav className="flex min-w-full items-center py-1 sm:py-3 justify-between text-white">
      <div className="flex text-white hover:text-white px-2 sm:px-6">
        <button onClick={() => navigate(-1)} className="-m-1.5 p-1.5">
          <span className="sr-only">Back</span>
          <ChevronLeftIcon className="h-8 w-auto" />
        </button>
      </div>
      <div className="flex flex-1 px-2 sm:px-6 flex-row gap-x-2 justify-center">
        <h1 className="text-lg">{title}</h1>
        {subtitle && (
          <h2 className="text-sm text-peated-light truncate">{subtitle}</h2>
        )}
      </div>
      <div className="justify-end">
        <button
          onClick={onSave}
          className="block px-2 sm:px-6 min-h-full group"
        >
          <span className="rounded bg-peated-dark group-hover:bg-peated-darker px-2.5 py-1.5 sm:px-2.5 sm:py-2.5 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated">
            Save
          </span>
        </button>
      </div>
    </nav>
  );
}
