import { useNavigate } from "react-router-dom";
import { ChevronLeftIcon } from "@heroicons/react/20/solid";

export default function FormHeader({
  onSave,
  title,
  subtitle,
}: {
  onSave: () => void;
  title: string;
  subtitle?: string;
}) {
  const navigate = useNavigate();

  return (
    <header className="bg-peated">
      <nav className="mx-auto flex max-w-4xl items-center py-3 justify-between text-white">
        <div className="flex text-white hover:text-white px-6">
          <button onClick={() => navigate(-1)} className="-m-1.5 p-1.5">
            <span className="sr-only">Back</span>
            <ChevronLeftIcon className="h-8 w-auto" />
          </button>
        </div>
        <div className="flex sm:flex-1 px-6 flex-row gap-x-2 sm:flex-col items-center">
          <h1 className="text-lg">{title}</h1>
          {subtitle && (
            <h2 className="text-sm text-peated-light truncate">{subtitle}</h2>
          )}
        </div>
        <div className="justify-end">
          <button onClick={onSave} className="block px-6 h-12 group">
            <span className="rounded-md bg-peated-dark px-2.5 py-2.5 text-sm font-semibold text-white shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-peated">
              Save
            </span>
          </button>
        </div>
      </nav>
    </header>
  );
}
