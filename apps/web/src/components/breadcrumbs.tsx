import { ChevronRightIcon, HomeIcon } from "@heroicons/react/20/solid";
import { Link } from "@tanstack/react-router";
import classNames from "@peated/web/lib/classNames";

type Page = {
  name: string;
  to: string;
  current?: boolean;
};

export function Breadcrumbs({ pages }: { pages: Page[] }) {
  return (
    <nav className="mb-4 flex font-medium text-sm" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        <li className="flex">
          <div className="flex items-center">
            <Link to="/" className="text-muted hover:text-slate-400">
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
                to={page.href}
                className={classNames("ml-2 text-slate-600 hover:text-muted")}
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
