"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import { toTitleCase } from "@peated/server/lib/strings";
import Link from "@peated/web/components/link";
import useAuth from "@peated/web/hooks/useAuth";
import { trpc } from "@peated/web/lib/trpc";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Header from "../header";
import Layout from "../layout";
import ListItem from "../listItem";
import SearchHeader from "../searchHeader";
import type { Result } from "./result";
import ResultRow from "./result";

import { useDebounceCallback } from "usehooks-ts";
import Spinner from "../spinner";
export type Props = {
  value?: string;
  onClose?: () => void;
  onQueryChange?: (value: string) => void;
};

export default function SearchPanel({
  value = "",
  onClose,
  onQueryChange,
}: Props) {
  const { user } = useAuth();
  const qs = useSearchParams();

  const maxResults = 50;

  const directToTasting = qs.has("tasting");

  const router = useRouter();

  const [query, setQuery] = useState(qs.get("q") ?? value ?? "");
  const [state, setState] = useState<"loading" | "ready">("loading");

  const [results, setResults] = useState<readonly Result[]>([]);
  const isUserQuery = query.indexOf("@") !== -1 && user;

  const trpcUtils = trpc.useUtils();

  useEffect(() => {
    const query = qs.get("q") ?? "";
    setQuery(query);
    if (onQueryChange) onQueryChange(query);
  }, [onQueryChange, qs]);

  useEffect(() => {
    setQuery(value ?? "");
    if (onQueryChange) onQueryChange(value ?? "");
  }, [onQueryChange, value]);

  // TODO: handle errors
  const onQuery = useDebounceCallback(async (query: string) => {
    // union results from various apis
    // priority is:
    // - users
    // - bottles
    // - entities
    // (but prioritize exact matches)
    // trpc.useQueries(t => {

    // })
    // user, bottles, entities
    setState("loading");

    const promises = [];
    if (directToTasting || !isUserQuery) {
      promises.push(
        trpcUtils.bottleList
          .fetch({
            query,
            limit: maxResults,
          })
          .then((data) =>
            data.results.map<Result>((b) => ({ type: "bottle", ref: b })),
          )
          .catch(() => []),
      );
    }

    if (!directToTasting && user && (isUserQuery || query)) {
      promises.push(
        trpcUtils.userList
          .fetch({
            query,
            limit: maxResults,
          })
          .then((data) =>
            data.results.map<Result>((b) => ({ type: "user", ref: b })),
          )
          .catch(() => []),
      );
    }

    if (!directToTasting) {
      promises.push(
        trpcUtils.entityList
          .fetch({ query, limit: maxResults })
          .then((data) =>
            data.results.map<Result>((b) => ({ type: "entity", ref: b })),
          )
          .catch(() => []),
      );
    }
    const results = await Promise.all(promises);

    setResults(
      sortResults(
        query,
        results.reduce((prev, cur) => [...prev, ...cur], []),
      ),
    );

    setQuery(query);
    setState("ready");
  });

  const sortResults = (query: string, unsortedResults: Result[]) => {
    const exactMatches: number[] = [];
    const lowerQuery = query.toLowerCase();
    unsortedResults.forEach((value, index) => {
      if (value.type !== "user") {
        if (value.ref.name.toLowerCase() === lowerQuery) {
          exactMatches.push(index);
        }
      } else {
        if (
          value.ref.displayName?.toLowerCase() === lowerQuery ||
          value.ref.username.toLowerCase() === lowerQuery
        ) {
          exactMatches.push(index);
        }
      }
    });

    const results = [...unsortedResults];
    exactMatches.forEach((resultIndex, index) => {
      const item = results.splice(resultIndex, 1);
      results.unshift(...item);
    });
    return results;
  };

  useEffect(() => {
    onQuery(query);
  }, [query]);

  return (
    <Layout
      footer={null}
      header={
        <Header>
          <SearchHeader
            name="q"
            placeholder="Search for bottles, brands, and people"
            value={query}
            onChange={(value) => {
              onQuery(value);
              if (onQueryChange) onQueryChange(query);
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
        <div className="fixed inset-0 z-10">
          <div className="absolute inset-0 bg-slate-800 opacity-50" />
          <Spinner />
        </div>
      )}
      <ul role="list" className="divide-y divide-slate-800">
        {query && !isUserQuery && (results.length < maxResults || query) && (
          <ListItem color="highlight">
            <PlusIcon className="hidden h-12 w-12 flex-none rounded p-2 sm:block" />

            <div className="min-w-0 flex-auto">
              <div className="font-semibold leading-6">
                <Link href="/addBottle">
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
