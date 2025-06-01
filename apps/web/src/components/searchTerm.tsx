import { XMarkIcon } from "@heroicons/react/20/solid";
import { Link } from "@tanstack/react-router";

export function SearchTerm({ name, value }: { name: string; value?: string }) {
  if (!value) return null;

  return (
    <Link
      to="."
      search={(prev: Record<string, any>) => {
        return Object.fromEntries(
          Object.entries(prev).filter(([k]) => k !== name)
        );
      }}
      className="inline-flex items-center rounded border border-slate-600 px-2 text-sm hover:text-white"
    >
      {name} = {value}
      <XMarkIcon className="-mr-1 ml-1 h-4 w-4" />
    </Link>
  );
}
