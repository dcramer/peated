import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronRightIcon, PlusIcon } from "@heroicons/react/20/solid";

import { Bottle } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import { formatCategoryName, toTitleCase } from "../lib/strings";
import BottleName from "../components/bottleName";
import SearchHeader from "../components/searchHeader";
import ListItem from "../components/listItem";
import { Link } from "react-router-dom";

const SkeletonItem = () => {
  return (
    <ListItem noHover>
      <div className="h-full w-full">
        <div className="hidden sm:visible h-12 w-12 p-2 flex-none" />

        <div className="min-w-0 flex-auto animate-pulse ">
          <p className="bg-gray-200 font-semibold leading-6 text-gray-900 rounded -indent-96 overflow-hidden">
            Title
          </p>
          <p className="bg-gray-200 mt-1 flex text-sm leading-5 text-gray-500 truncate rounded -indent-96 overflow-hidden">
            Subtext
          </p>
        </div>
      </div>
    </ListItem>
  );
};

export default function Search() {
  const location = useLocation();
  const navigate = useNavigate();
  const qs = new URLSearchParams(location.search);

  const directToTasting = qs.has("tasting");

  const [query, setQuery] = useState(qs.get("q") || "");
  const [results, setResults] = useState<readonly Bottle[]>([]);
  const [state, setState] = useState<"loading" | "ready">("loading");

  const fetch = (query: string) => {
    api
      .get("/bottles", {
        query: { query },
      })
      .then(({ results }: { results: readonly Bottle[] }) => {
        setResults(results);
        setState("ready");
      });
  };

  useEffect(() => {
    const qs = new URLSearchParams(location.search);

    setQuery(qs.get("q") || "");
  }, [location.search]);

  // TODO(dcramer): why is this rendering twice
  useEffect(() => {
    fetch(query);
  }, [query]);

  return (
    <Layout
      header={
        <SearchHeader
          name="q"
          placeholder="Search for a bottle"
          value={query}
          onChange={setQuery}
          onSubmit={(value) => {
            navigate(
              `${location.pathname}?q=${encodeURIComponent(value)}&${
                directToTasting ? "tasting" : ""
              }`,
              {
                replace: true,
              }
            );
          }}
        />
      }
    >
      <ul role="list" className="divide-y divide-gray-100">
        {state === "loading" ? (
          <>
            <SkeletonItem />
            <SkeletonItem />
            <SkeletonItem />
          </>
        ) : (
          <>
            {results.map((bottle) => {
              const title = <BottleName bottle={bottle} />;
              return (
                <ListItem key={bottle.id}>
                  <div className="hidden sm:visible h-12 w-12 p-2 flex-none" />

                  <div className="min-w-0 flex-auto">
                    <p className="font-semibold leading-6 text-gray-900">
                      <Link
                        to={
                          directToTasting
                            ? `/bottles/${bottle.id}/addTasting`
                            : `/bottles/${bottle.id}`
                        }
                      >
                        <span className="absolute inset-x-0 -top-px bottom-0" />
                        {title}
                      </Link>
                    </p>
                    <p className="mt-1 flex text-sm leading-5 text-gray-500 truncate">
                      {bottle.brand.name}
                    </p>
                  </div>
                  <div className="flex items-center gap-x-4">
                    <div className="hidden sm:flex sm:flex-col sm:items-end">
                      <p className="leading-6 text-gray-900">
                        {bottle.category && formatCategoryName(bottle.category)}
                      </p>
                      <p className="mt-1 text-sm leading-5 text-gray-500">
                        {bottle.statedAge ? `${bottle.statedAge} years` : null}
                      </p>
                    </div>
                    <ChevronRightIcon
                      className="h-10 w-10 flex-none text-gray-500"
                      aria-hidden="true"
                    />
                  </div>
                </ListItem>
              );
            })}
            {(results.length === 0 || query !== "") && (
              <ListItem>
                <PlusIcon className="h-12 w-12 p-2 flex-none rounded-full bg-gray-100 group-hover:bg-peated group-hover:text-white" />

                <div className="min-w-0 flex-1">
                  <p className="font-semibold leading-6 text-gray-900">
                    <Link to={`/addBottle?name=${encodeURIComponent(query)}`}>
                      <span className="absolute inset-x-0 -top-px bottom-0" />
                      Can't find a bottle?
                    </Link>
                  </p>
                  <p className="mt-1 flex leading-5 text-gray-500 gap-x-1">
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
                  </p>
                </div>
              </ListItem>
            )}
          </>
        )}
      </ul>
    </Layout>
  );
}
