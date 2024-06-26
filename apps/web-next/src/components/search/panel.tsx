"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import { toTitleCase } from "@peated/server/lib/strings";
import useAuth from "@peated/web/hooks/useAuth";
import { trpc } from "@peated/web/lib/trpc";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { debounce } from "ts-debounce";
import Header from "../header";
import Layout from "../layout";
import ListItem from "../listItem";
import SearchHeader from "../searchHeader";
import type { Result } from "./result";
import ResultRow from "./result";
import { SkeletonItem } from "./skeletonItem";

export type Props = {
  onClose?: () => void;
  onQueryChange?: (value: string) => void;
};

export default function SearchPanel({ onClose, onQueryChange }: Props) {
  const { user } = useAuth();
  const qs = useSearchParams();

  const maxResults = 50;

  const directToTasting = qs.has("tasting");

  const router = useRouter();

  const [query, setQuery] = useState(qs.get("q") || "");
  const [state, setState] = useState<"loading" | "ready">("loading");

  const [results, setResults] = useState<readonly Result[]>([]);
  const isUserQuery = query.indexOf("@") !== -1;

  const trpcUtils = trpc.useUtils();

  // TODO: handle errors
  const fetch = debounce(async (query: string): Promise<Result[]> => {
    // union results from various apis
    // priority is:
    // - users
    // - bottles
    // - entities
    // (but prioritize exact matches)
    // trpc.useQueries(t => {

    // })
    // user, bottles, entities
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
          ),
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
          ),
      );
    }

    if (!directToTasting) {
      promises.push(
        trpcUtils.entityList
          .fetch({ query, limit: maxResults })
          .then((data) =>
            data.results.map<Result>((b) => ({ type: "entity", ref: b })),
          ),
      );
    }
    const results = await Promise.all(promises);
    return results.reduce((prev, cur) => [...prev, ...cur], []);
  }, 300);

  const sortResults = useCallback(
    (unsortedResults: Result[]) => {
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
    },
    [query],
  );

  useEffect(() => {
    const query = qs.get("q") || "";
    setQuery(query);
    if (onQueryChange) onQueryChange(query);
  }, [onQueryChange, qs]);

  useEffect(() => {
    setState("loading");
    fetch.cancel();
    const currentQuery = query;
    const currentFetch = fetch(query);
    setTimeout(async () => {
      const results = await currentFetch;
      if (currentQuery !== query) return;
      setResults(sortResults(results));
      setState("ready");
    });
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
              setQuery(value);
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
      <ul role="list" className="divide-y divide-slate-800">
        {state === "loading" ? (
          <>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </>
        ) : (
          <>
            {!isUserQuery && (results.length < maxResults || query !== "") && (
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
                        <strong className="truncate">
                          {toTitleCase(query)}
                        </strong>{" "}
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
                  <ResultRow
                    result={result}
                    directToTasting={directToTasting}
                  />
                </ListItem>
              );
            })}
          </>
        )}
      </ul>
    </Layout>
  );
}
