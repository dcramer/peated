import { PlusIcon } from "@heroicons/react/20/solid";
import { toTitleCase } from "@peated/server/lib/strings";
import type { Outputs } from "@peated/server/orpc/router";
import { Link } from "@tanstack/react-router";
import ListItem from "../listItem";
import ResultRow from "./result";

export default function SearchResults({
  query,
  results,
  canSuggestAdd = false,
  directToTasting = false,
}: {
  query: string;
  results: Outputs["search"]["results"];
  canSuggestAdd?: boolean;
  directToTasting?: boolean;
}) {
  return (
    <ul className="divide-y divide-slate-800 border-slate-800 lg:border-r lg:border-b">
      {query && canSuggestAdd && (
        <ListItem color="highlight">
          <PlusIcon className="hidden h-12 w-12 flex-none rounded p-2 sm:block" />

          <div className="min-w-0 flex-auto">
            <div className="font-semibold leading-6">
              <Link to="/addBottle" search={{ name: toTitleCase(query) }}>
                <span className="-top-px absolute inset-x-0 bottom-0" />
                {results.length === 0
                  ? "We couldn't find anything matching your search query."
                  : "Can't find a bottle?"}
              </Link>
            </div>
            <div className="mt-1 flex gap-x-1 text-highlight-dark leading-5">
              {query !== "" ? (
                <span>
                  Tap here to add{" "}
                  <strong className="truncate">{toTitleCase(query)}</strong> to
                  the database.
                </span>
              ) : (
                <span>Tap here to add a new bottle to the database.</span>
              )}
            </div>
          </div>
        </ListItem>
      )}
      {results.map((result) => {
        return (
          <ListItem key={`${result.type}-${result.ref.id}`}>
            <ResultRow result={result} directToTasting={directToTasting} />
          </ListItem>
        );
      })}
      {!canSuggestAdd && results.length === 0 && query !== "" && (
        <ListItem noHover>
          <p className="p-5 text-muted">
            We couldn't find anything matching your search query.
          </p>
        </ListItem>
      )}
    </ul>
  );
}
