"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import { toTitleCase } from "@peated/server/lib/strings";
import Header from "@peated/web/components/header";
import Layout from "@peated/web/components/layout";
import Link from "@peated/web/components/link";
import ListItem from "@peated/web/components/listItem";
import ResultRow from "@peated/web/components/search/result";
import SearchHeader from "@peated/web/components/searchHeader";
import type { RouterOutputs } from "@peated/web/lib/trpc/client";
import { useRouter } from "next/navigation";

const maxResults = 50;

export type Props = {
  query?: string;
  directToTasting?: boolean;
  results: RouterOutputs["search"]["results"];
};

export default function SearchResults({
  results,
  query,
  directToTasting,
}: Props) {
  const router = useRouter();

  return (
    <Layout
      footer={null}
      header={
        <Header>
          <SearchHeader
            name="q"
            autoFocus
            placeholder="Search for bottles, brands, and people"
            value={query}
            onSubmit={(value) => {
              router.replace(
                `${location.pathname}?q=${encodeURIComponent(value)}&${
                  directToTasting ? "tasting" : ""
                }`,
              );
            }}
          />
        </Header>
      }
    >
      <ul role="list" className="divide-y divide-slate-800">
        {query && directToTasting && (results.length < maxResults || query) && (
          <ListItem color="highlight">
            <PlusIcon className="hidden h-12 w-12 flex-none rounded p-2 sm:block" />

            <div className="min-w-0 flex-auto">
              <div className="font-semibold leading-6">
                <Link
                  href={`/addBottle?name=${encodeURIComponent(toTitleCase(query))}`}
                >
                  <span className="absolute inset-x-0 -top-px bottom-0" />
                  {"Can't find a bottle?"}
                </Link>
              </div>
              <div className="text-highlight-dark mt-1 flex gap-x-1 leading-5">
                {query !== "" ? (
                  <span>
                    Tap here to add{" "}
                    <strong className="truncate">{toTitleCase(query)}</strong>{" "}
                    to the database.
                  </span>
                ) : (
                  <span>Tap here to add a new entry to the database.</span>
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
      </ul>
    </Layout>
  );
}
