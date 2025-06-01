"use client";

import useAuth from "@peated/web/hooks/useAuth";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import Header from "../header";
import Layout from "../layout";
import SearchHeader from "../searchHeader";
import type { Result } from "./result";
import SearchResults from "./searchResults";
import { SkeletonItem } from "./skeletonItem";

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

  const [initialState, setInitialState] = useState<"loading" | "ready">(
    "loading"
  );
  const [query, setQuery] = useState(initialValue ?? value ?? "");
  const [state, setState] = useState<"loading" | "ready">("loading");
  const [results, setResults] = useState<Result[]>([]);

  const orpc = useORPC();

  const isUserQuery = query.indexOf("@") !== -1 && user;

  const unsafe_onQuery = useCallback(
    async (query: string) => {
      setState("loading");

      const isUserQuery = query.indexOf("@") !== -1 && user;

      const include: ("bottles" | "entities" | "users")[] = [];
      if (directToTasting || !isUserQuery) include.push("bottles");
      if (!directToTasting && user && (isUserQuery || query))
        include.push("users");
      if (!directToTasting) include.push("entities");

      const { results } = await orpc.search.call({
        query,
        limit: maxResults,
        include,
      });

      setResults(results);
      setState("ready");
      setInitialState("ready");
    },
    [directToTasting, user]
  );

  // TODO: handle errors
  const onQuery = useDebounceCallback(unsafe_onQuery);

  useEffect(() => {
    const curValue = initialValue ?? value ?? "";
    setQuery(curValue);
    if (onQueryChange) onQueryChange(curValue);
    onQuery(curValue);
  }, [initialValue, value, onQuery, onQueryChange]);

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
                }`
              );
            }}
            loading={state === "loading"}
            onClose={onClose}
          />
        </Header>
      }
    >
      {initialState === "loading" ? (
        [...Array(maxResults).keys()].map((i) => <SkeletonItem key={i} />)
      ) : (
        <SearchResults
          query={query}
          results={results}
          canSuggestAdd={!isUserQuery}
          directToTasting={directToTasting}
        />
      )}
    </Layout>
  );
}
