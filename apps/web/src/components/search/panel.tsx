"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import { toTitleCase } from "@peated/server/lib/strings";
import Link from "@peated/web/components/link";
import useAuth from "@peated/web/hooks/useAuth";
import { trpc } from "@peated/web/lib/trpc/client";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useDebounceCallback, useDebounceValue } from "usehooks-ts";
import Header from "../header";
import Layout from "../layout";
import ListItem from "../listItem";
import SearchHeader from "../searchHeader";
import Spinner from "../spinner";
import type { Result } from "./result";
import ResultRow from "./result";

const maxResults = 50;

export type Props = {
  value?: string;
  initialValue?: string;
  onClose?: () => void;
  onQueryChange?: (value: string) => void;
};

export default function SearchPanel({
  value,
  initialValue,
  onClose,
  onQueryChange,
}: Props) {
  const { user } = useAuth();
  const qs = useSearchParams();
  const directToTasting = qs.has("tasting");

  const router = useRouter();

  const [query, setQuery] = useState(initialValue ?? value ?? "");
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [results, setResults] = useState<readonly Result[]>([]);

  const trpcUtils = trpc.useUtils();
  const isUserQuery = query.indexOf("@") !== -1 && user;

  // TODO: handle errors
  const onQuery = useDebounceCallback(async (query: string) => {
    setState("loading");

    const isUserQuery = query.indexOf("@") !== -1 && user;

    const include: ("bottles" | "entities" | "users")[] = [];
    if (directToTasting || !isUserQuery) include.push("bottles");
    if (!directToTasting && user && (isUserQuery || query))
      include.push("users");
    if (!directToTasting) include.push("entities");

    const { results } = await trpcUtils.search.fetch({
      query,
      limit: maxResults,
      include,
    });

    setResults(results);
    setState("ready");
  });

  useEffect(() => {
    const curValue = initialValue ?? value ?? "";
    setQuery(curValue);
    if (onQueryChange) onQueryChange(curValue);
    onQuery(curValue);
  }, [initialValue, value]);

  return (
    <Layout
      noMargin
      footer={null}
      header={
        <Header>
          <SearchHeader
            name="q"
            autoFocus
            placeholder="Search for bottles, brands, and people"
            value={query}
            onChange={(value) => {
              setQuery(value);
              if (onQueryChange) onQueryChange(value);
              onQuery(value);
            }}
            onSubmit={(value) => {
              router.replace(
                `${location.pathname}?q=${encodeURIComponent(value)}&${
                  directToTasting ? "tasting" : ""
                }`,
              );
            }}
            onClose={onClose}
          />
        </Header>
      }
    >
      {state === "loading" && (
        <div className="z-1 fixed inset-0">
          <div className="absolute inset-0 flex items-center justify-center bg-slate-800 opacity-50" />
          <Spinner />
        </div>
      )}
      <ul
        role="list"
        className="divide-y divide-slate-800 border-slate-800 lg:border-b lg:border-r"
      >
        {query && !isUserQuery && (results.length < maxResults || query) && (
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
