import { PlusIcon } from "@heroicons/react/20/solid";
import { toTitleCase } from "@peated/server/lib/strings";
import type { Bottle, Entity, User } from "@peated/server/types";
import { Link, useLocation, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";
import useAuth from "~/hooks/useAuth";
import { debounce } from "~/lib/api";
import { trpc } from "~/lib/trpc";
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
  const navigate = useNavigate();
  const location = useLocation();
  const qs = new URLSearchParams(location.search);

  const maxResults = 50;

  const directToTasting = qs.has("tasting");

  const [query, setQuery] = useState(qs.get("q") || "");
  const [state, setState] = useState<"loading" | "ready">("loading");

  const [bottleResults, setBottleResults] = useState<readonly Bottle[]>([]);
  const [userResults, setUserResults] = useState<readonly User[]>([]);
  const [entityResults, setEntityResults] = useState<readonly Entity[]>([]);
  const isUserQuery = query.indexOf("@") !== -1;

  const trpcUtils = trpc.useUtils();

  // TODO: handle errors
  const fetch = debounce(async (query: string) => {
    // union results from various apis
    // priority is:
    // - users
    // - bottles
    // - entities
    // (but prioritize exact matches)
    // trpc.useQueries(t => {

    // })
    const promises = [];
    if (directToTasting) {
      setUserResults([]);
      setEntityResults([]);
      promises.push(
        trpcUtils.bottleList
          .fetch({
            query,
            limit: maxResults,
          })
          .then(({ results }) => {
            setBottleResults(results);
            if (state !== "ready") setState("ready");
          }),
      );
    } else if (isUserQuery) {
      setBottleResults([]);
      setEntityResults([]);
      if (user) {
        promises.push(
          trpcUtils.userList
            .fetch({
              query,
              limit: maxResults,
            })
            .then(({ results }) => {
              setUserResults(results);
              if (state !== "ready") setState("ready");
            }),
        );
      } else {
        setUserResults([]);
        setState("ready");
      }
    } else {
      setUserResults([]);
      if (user && query) {
        promises.push(
          trpcUtils.userList
            .fetch({ query, limit: maxResults })
            .then(({ results }) => {
              setUserResults(results);
              if (state !== "ready") setState("ready");
            }),
        );
      }
      promises.push(
        trpcUtils.bottleList
          .fetch({ query, limit: maxResults })
          .then(({ results }) => {
            setBottleResults(results);
            if (state !== "ready") setState("ready");
          }),
      );
      promises.push(
        trpcUtils.entityList
          .fetch({ query, limit: maxResults })
          .then(({ results }) => {
            setEntityResults(results);
            if (state !== "ready") setState("ready");
          }),
      );
      await Promise.all(promises);
    }
  }, 300);

  useEffect(() => {
    const qs = new URLSearchParams(location.search);
    const query = qs.get("q") || "";
    setQuery(query);
    if (onQueryChange) onQueryChange(query);
  }, [location.search]);

  // TODO(dcramer): why is this rendering twice
  useEffect(() => {
    fetch(query);
  }, [query]);

  const sortResults = () => {
    const results: Result[] = [
      ...bottleResults.map<Result>((b) => ({ type: "bottle", ref: b })),
      ...entityResults.map<Result>((b) => ({ type: "entity", ref: b })),
      ...userResults.map<Result>((b) => ({ type: "user", ref: b })),
    ];

    const exactMatches: number[] = [];
    const lowerQuery = query.toLowerCase();
    results.forEach((value, index) => {
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

    exactMatches.forEach((resultIndex, index) => {
      const item = results.splice(resultIndex, 1);
      results.unshift(...item);
    });
    return results;
  };

  const results: Result[] = sortResults();

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
              navigate(
                `${location.pathname}?q=${encodeURIComponent(value)}&${
                  directToTasting ? "tasting" : ""
                }`,
                {
                  replace: true,
                },
              );
            }}
            onClose={onClose}
          />
        </Header>
      }
    >
      <ul className="divide-y divide-slate-800 sm:rounded">
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
            {!isUserQuery &&
              (bottleResults.length < maxResults || query !== "") && (
                <ListItem color="highlight">
                  <PlusIcon className="hidden h-12 w-12 flex-none rounded-full p-2 sm:block" />

                  <div className="min-w-0 flex-auto">
                    <div className="font-semibold leading-6">
                      <Link to={`/addBottle`}>
                        <span className="absolute inset-x-0 -top-px bottom-0" />
                        Can't find a bottle?
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
                        <span>
                          Tap here to add a new entry to the database.
                        </span>
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
