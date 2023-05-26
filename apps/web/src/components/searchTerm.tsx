import { XMarkIcon } from "@heroicons/react/20/solid";
import { Link, useLocation } from "react-router-dom";

export function SearchTerm({ name, value }: { name: string; value?: string }) {
  const location = useLocation();

  if (!value) return null;

  const qs = new URLSearchParams(location.search);
  const query = Array.from(qs.entries())
    .filter(([k]) => k !== name)
    .map(([k, v]) => `${k}=${v}`)
    .join("&");
  return (
    <Link
      to={`${location.pathname}?${query}`}
      className="inline-flex items-center rounded border border-slate-600 px-2 text-sm hover:text-white"
    >
      {name} = {value}
      <XMarkIcon className="-mr-1 ml-1 h-4 w-4" />
    </Link>
  );
}
