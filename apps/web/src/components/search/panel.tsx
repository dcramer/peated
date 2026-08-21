"use client";

import useAuth from "@peated/web/hooks/useAuth";
import { getPendingImageFromParams } from "@peated/web/lib/addBottle";
import { useORPC } from "@peated/web/lib/orpc/context";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import Header from "../header";
import Layout from "../layout";
import SearchHeader from "../searchHeader";
import type { AddBottleRouteIntent } from "./bottleResult";
import type { Result } from "./result";
import SearchResults from "./searchResults";
import { SkeletonItem } from "./skeletonItem";

const maxResults = 50;
const addBottleIntents: AddBottleRouteIntent[] = [
  "addBottle",
  "choose",
  "library",
  "tasting",
  "view",
];

function getAddBottleIntent(
  value: string | null,
): AddBottleRouteIntent | undefined {
  return addBottleIntents.find((intent) => intent === value);
}

function getCreateBottleReturnAction(intent: string | null) {
  if (intent === "choose" || intent === "addBottle") return "addBottle";
  if (intent === "library" || intent === "tasting" || intent === "view") {
    return intent;
  }
  return undefined;
}

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
  const intent = qs.get("intent");
  const searchType = qs.get("type");
  const addBottleIntent = getAddBottleIntent(intent);
  const pendingImage = getPendingImageFromParams(qs);
  // The empty ?tasting flag is the legacy direct shortcut; intent=tasting keeps the Add Bottle resolver.
  const directToTasting = qs.has("tasting");
  const createBottleReturnAction =
    getCreateBottleReturnAction(intent) ??
    (directToTasting ? "tasting" : undefined);

  const router = useRouter();

  const [initialState, setInitialState] = useState<"loading" | "ready">(
    "loading",
  );
  const [query, setQuery] = useState(initialValue ?? value ?? "");
  const [state, setState] = useState<"error" | "loading" | "ready">("loading");
  const [results, setResults] = useState<Result[]>([]);
  const latestRequest = useRef(0);

  const orpc = useORPC();

  const isUserQuery =
    (searchType === "users" || query.indexOf("@") !== -1) && user;

  const unsafe_onQuery = useCallback(
    async (query: string) => {
      const requestId = latestRequest.current + 1;
      latestRequest.current = requestId;
      setState("loading");

      const isUserQuery =
        (searchType === "users" || query.indexOf("@") !== -1) && user;

      const include: ("bottles" | "entities" | "users")[] = [];
      if (directToTasting || addBottleIntent || !isUserQuery)
        include.push("bottles");
      if (
        !directToTasting &&
        !addBottleIntent &&
        user &&
        (isUserQuery || query)
      )
        include.push("users");
      if (!directToTasting && !addBottleIntent) include.push("entities");

      try {
        const { results } = await orpc.search.call({
          query,
          limit: maxResults,
          include,
        });
        if (latestRequest.current !== requestId) return;

        setResults(results);
        setState("ready");
        setInitialState("ready");
      } catch {
        if (latestRequest.current !== requestId) return;

        setResults([]);
        setState("error");
        setInitialState("ready");
      }
    },
    [addBottleIntent, directToTasting, orpc, searchType, user],
  );

  const onQuery = useDebounceCallback(unsafe_onQuery);

  useEffect(() => {
    const curValue = initialValue ?? value ?? "";
    setQuery(curValue);
    void onQuery(curValue);
  }, [initialValue, value, onQuery]);

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
              void onQuery(value);
            }}
            onSubmit={(value) => {
              const params = new URLSearchParams({ q: value });
              if (qs.has("tasting")) params.set("tasting", "");
              if (addBottleIntent) {
                params.set("intent", addBottleIntent);
              }
              if (searchType) params.set("type", searchType);
              if (pendingImage?.id)
                params.set("pendingImageId", pendingImage.id);
              if (pendingImage?.imageUrl) {
                params.set("pendingImageUrl", pendingImage.imageUrl);
              }
              router.replace(`${location.pathname}?${params.toString()}`);
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
          canSuggestAdd={state !== "error" && !isUserQuery}
          failed={state === "error"}
          directToTasting={directToTasting}
          addBottleIntent={addBottleIntent}
          createBottleReturnAction={createBottleReturnAction}
          pendingImage={pendingImage}
        />
      )}
    </Layout>
  );
}
