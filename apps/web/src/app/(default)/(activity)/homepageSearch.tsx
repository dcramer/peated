import { MagnifyingGlassIcon } from "@heroicons/react/20/solid";
import Link from "@peated/web/components/link";

const categories = [
  ["single_malt", "Single malt"],
  ["bourbon", "Bourbon"],
  ["rye", "Rye"],
  ["blend", "Blends"],
  ["single_pot_still", "Single pot still"],
] as const;

export default function HomepageSearch() {
  return (
    <section
      aria-label="Search bottles"
      className="-mx-3 bg-slate-950/65 px-5 py-4 sm:mx-0 sm:px-10 sm:py-5 lg:px-14"
    >
      <div className="min-w-0">
        <form action="/search" method="get" className="flex">
          <label htmlFor="homepage-search" className="sr-only">
            Search bottles and makers
          </label>
          <div className="relative min-w-0 flex-1">
            <MagnifyingGlassIcon
              className="text-muted pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              id="homepage-search"
              name="q"
              type="search"
              placeholder="Search bottles and makers"
              className="h-11 w-full rounded-none border-0 bg-slate-900/90 pl-12 pr-4 text-sm text-white placeholder:text-slate-500 focus:ring-2 focus:ring-inset focus:ring-amber-400 sm:h-12"
            />
          </div>
          <button
            type="submit"
            className="bg-highlight focus-visible:outline-peated h-11 px-4 text-sm font-semibold text-black hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:h-12 sm:px-5"
          >
            Search
          </button>
        </form>
        <nav
          aria-label="Browse bottles by style"
          className="scrollbar-none -mr-5 mt-3 flex flex-nowrap gap-x-4 overflow-x-auto pr-5 sm:mr-0 sm:mt-4 sm:flex-wrap sm:gap-x-5 sm:gap-y-2 sm:overflow-visible sm:pr-0"
        >
          {categories.map(([category, label]) => (
            <Link
              key={category}
              href={`/bottles?category=${category}`}
              className="text-muted shrink-0 text-xs font-semibold hover:text-white hover:underline"
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </section>
  );
}
