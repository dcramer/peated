import { AtSymbolIcon, PlusIcon } from "@heroicons/react/20/solid";
import { Link, useLocation, useNavigate } from "@remix-run/react";
import { useEffect, useState } from "react";

import { toTitleCase } from "@peated/shared/lib/strings";

import useApi from "~/hooks/useApi";
import useAuth from "~/hooks/useAuth";
import type { Bottle, Entity, User } from "~/types";
import { debounce } from "../lib/api";
import { formatCategoryName } from "../lib/strings";
import BottleIcon from "./assets/Bottle";
import EntityIcon from "./assets/Entity";
import Chip from "./chip";
import Header from "./header";
import Layout from "./layout";
import ListItem from "./listItem";
import SearchHeader from "./searchHeader";
import UserAvatar from "./userAvatar";

const SkeletonItem = () => {
  return (
    <ListItem noHover>
      <div className="h-full w-full">
        <div className="hidden h-12 w-12 flex-none p-2 sm:visible" />

        <div className="min-w-0 flex-auto animate-pulse">
          <div className="overflow-hidden rounded bg-slate-800 -indent-96 font-semibold leading-6">
            Title
          </div>
          <div className="mt-2 flex w-32 overflow-hidden truncate rounded bg-slate-800 -indent-96 text-xs leading-5">
            Subtext
          </div>
        </div>
      </div>
    </ListItem>
  );
};

type BottleResult = {
  type: "bottle";
  ref: Bottle;
};

type UserResult = {
  type: "user";
  ref: User;
};

type EntityResult = {
  type: "entity";
  ref: Entity;
};

type Result = BottleResult | UserResult | EntityResult;

const ResultRow = ({
  result,
  directToTasting = false,
}: {
  result: Result;
  directToTasting: boolean;
}) => {
  switch (result.type) {
    case "bottle":
      return (
        <BottleResultRow result={result} directToTasting={directToTasting} />
      );
    case "entity":
      return <EntityResultRow result={result} />;
    case "user":
      return <UserResultRow result={result} />;
    default:
      return null;
  }
};

const BottleResultRow = ({
  result: { ref: bottle },
  directToTasting = false,
}: {
  result: BottleResult;
  directToTasting: boolean;
}) => {
  return (
    <>
      <BottleIcon className="m-2 hidden h-10 w-auto sm:block" />

      <div className="min-w-0 flex-auto">
        <div className="font-semibold leading-6">
          <Link
            to={
              directToTasting
                ? `/bottles/${bottle.id}/addTasting`
                : `/bottles/${bottle.id}`
            }
          >
            <span className="absolute inset-x-0 -top-px bottom-0" />
            {bottle.name}
          </Link>
        </div>
        <div className="text-light mt-1 flex truncate text-sm leading-5">
          {bottle.brand.name}
        </div>
      </div>
      <div className="flex items-center gap-x-4">
        <div className="hidden sm:flex sm:flex-col sm:items-end">
          <div className="leading-6 text-slate-500">
            {bottle.category && formatCategoryName(bottle.category)}
          </div>
          <div className="mt-1 text-sm leading-5 text-slate-500">
            {bottle.statedAge ? `${bottle.statedAge} years` : null}
          </div>
        </div>
      </div>
    </>
  );
};

const EntityResultRow = ({
  result: { ref: entity },
}: {
  result: EntityResult;
}) => {
  return (
    <>
      <EntityIcon className="m-2 hidden h-10 w-auto sm:block" />

      <div className="flex min-w-0 flex-auto">
        <div className="flex-1 font-semibold leading-6">
          <Link to={`/entities/${entity.id}`}>
            <span className="absolute inset-x-0 -top-px bottom-0" />
            {entity.name}
          </Link>
        </div>
        <div className="flex gap-x-2">
          {entity.type.map((t) => (
            <Chip key={t} size="small" color="highlight">
              {t}
            </Chip>
          ))}
        </div>
      </div>
    </>
  );
};

const UserResultRow = ({ result: { ref: user } }: { result: UserResult }) => {
  return (
    <>
      <div className="hidden h-12 w-12 flex-none p-2 sm:block">
        <UserAvatar user={user} />
      </div>

      <div className="flex min-w-0 flex-auto">
        <div className="flex-1">
          <Link
            to={`/users/${user.username}`}
            className="font-semibold leading-6"
          >
            <span className="absolute inset-x-0 -top-px bottom-0" />
            {user.displayName}
          </Link>
          <div className="text-light flex items-center text-sm">
            <AtSymbolIcon className="inline h-3 w-3" />
            {user.username}
          </div>
        </div>
        <div className="flex gap-x-2">
          {user.admin ? (
            <Chip size="small" color="highlight">
              Admin
            </Chip>
          ) : user.mod ? (
            <Chip size="small" color="highlight">
              Moderator
            </Chip>
          ) : null}
        </div>
      </div>
    </>
  );
};

export type Props = {
  onClose?: () => void;
  onQueryChange?: (value: string) => void;
};

export default function SearchPanel({ onClose, onQueryChange }: Props) {
  const { user } = useAuth();
  const api = useApi();
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

  // TODO: handle errors
  const fetch = debounce(async (query: string) => {
    // union results from various apis
    // priority is:
    // - users
    // - bottles
    // - entities
    // (but prioritize exact matches)
    if (directToTasting) {
      setUserResults([]);
      setEntityResults([]);
      await api
        .get("/bottles", {
          query: { query, limit: maxResults },
        })
        .then(({ results }: { results: readonly Bottle[] }) => {
          setBottleResults(results);
          if (state !== "ready") setState("ready");
        });
    } else if (isUserQuery) {
      setBottleResults([]);
      setEntityResults([]);
      if (user) {
        await api
          .get("/users", {
            query: { query, limit: maxResults },
          })
          .then(({ results }: { results: readonly User[] }) => {
            setUserResults(results);
            if (state !== "ready") setState("ready");
          });
      } else {
        setUserResults([]);
        setState("ready");
      }
    } else {
      setUserResults([]);
      if (user && query) {
        await api
          .get("/users", {
            query: { query, limit: maxResults },
          })
          .then(({ results }: { results: readonly User[] }) => {
            setUserResults(results);
            if (state !== "ready") setState("ready");
          });
      }
      await api
        .get("/bottles", {
          query: { query, limit: maxResults },
        })
        .then(({ results }: { results: readonly Bottle[] }) => {
          setBottleResults(results);
          if (state !== "ready") setState("ready");
        });
      await api
        .get("/entities", {
          query: { query, limit: maxResults },
        })
        .then(({ results }: { results: readonly Entity[] }) => {
          setEntityResults(results);
          if (state !== "ready") setState("ready");
        });
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
        if (value.ref.displayName.toLowerCase() === lowerQuery) {
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

                  <div className="min-w-0 flex-1">
                    <div className="font-semibold leading-6">
                      <Link to={`/addBottle`}>
                        <span className="absolute inset-x-0 -top-px bottom-0" />
                        Can't find a bottle?
                      </Link>
                    </div>
                    <div className="text-peated-light mt-1 flex gap-x-1 leading-5">
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
