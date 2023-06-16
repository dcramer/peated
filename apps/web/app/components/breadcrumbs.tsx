import { ChevronRightIcon, HomeIcon } from "@heroicons/react/20/solid";
import { Link } from "@remix-run/react";
import classNames from "~/lib/classNames";

type Page = {
  name: string;
  to: string;
  current?: boolean;
};

export function Breadcrumbs({ pages }: { pages: Page[] }) {
  return (
    <nav className="mb-4 flex text-sm font-medium" aria-label="Breadcrumb">
      <ol role="list" className="flex items-center space-x-2">
        <li className="flex">
          <div className="flex items-center">
            <Link to="/" className="text-slate-500 hover:text-slate-400">
              <HomeIcon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              <span className="sr-only">Home</span>
            </Link>
          </div>
        </li>
        {pages.map((page) => (
          <li key={page.name}>
            <div className="flex items-center">
              <ChevronRightIcon
                className="h-5 w-5 flex-shrink-0 text-slate-800"
                aria-hidden="true"
              />
              <Link
                to={page.to}
                className={classNames(
                  "ml-2 text-slate-600 hover:text-slate-500",
                )}
                aria-current={page.current ? "page" : undefined}
              >
                {page.name}
              </Link>
            </div>
          </li>
        ))}
      </ol>
    </nav>
  );
}
