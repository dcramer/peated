import { Form, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronRightIcon, PlusIcon } from "@heroicons/react/20/solid";

import { Bottle } from "../types";
import api from "../lib/api";
import Layout from "../components/layout";
import { formatCategoryName, toTitleCase } from "../lib/strings";
import BottleName from "../components/bottleName";

export default function Search() {
  const location = useLocation();
  const qs = new URLSearchParams(location.search);

  const [query, setQuery] = useState(qs.get("q") || "");
  const [results, setResults] = useState<readonly Bottle[]>([]);

  const fetch = (query: string) => {
    api
      .get("/bottles", {
        query: { query },
      })
      .then((r: readonly Bottle[]) => setResults(r));
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
    <Layout noMobileHeader>
      <Form method="GET" className="space-y-6">
        <div className="mt-2">
          <input
            id="query"
            name="q"
            required
            className="block w-full rounded-md border-0 p-1.5 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 placeholder:text-gray-400 focus:ring-2 focus:ring-inset focus:ring-peated sm:text-sm sm:leading-6"
            defaultValue={query}
            placeholder="Search for a bottle"
            onChange={(e) => {
              // TODO: navigate/replace url
              setQuery(e.target.value);
            }}
          />
        </div>
      </Form>
      <ul role="list" className="divide-y divide-gray-100">
        {results.map((bottle) => {
          const title = <BottleName bottle={bottle} />;
          return (
            <li key={bottle.id} className="relative py-5 hover:bg-gray-50">
              <div className="mx-auto flex max-w-7xl justify-between gap-x-6 px-4 sm:px-6 lg:px-8">
                <div className="flex gap-x-4">
                  <div className="min-w-0 flex-auto">
                    <p className="text-sm font-semibold leading-6 text-gray-900">
                      <a href={`/bottles/${bottle.id}/checkin`}>
                        <span className="absolute inset-x-0 -top-px bottom-0" />
                        {title}
                      </a>
                    </p>
                    <p className="mt-1 flex text-xs leading-5 text-gray-500 truncate">
                      {bottle.brand.name}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-x-4">
                  <div className="hidden sm:flex sm:flex-col sm:items-end">
                    <p className="text-sm leading-6 text-gray-900">
                      {bottle.category && formatCategoryName(bottle.category)}
                    </p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                      {bottle.statedAge ? `${bottle.statedAge} years` : null}
                    </p>
                  </div>
                  <ChevronRightIcon
                    className="h-5 w-5 flex-none text-gray-400"
                    aria-hidden="true"
                  />
                </div>
              </div>
            </li>
          );
        })}
        {query && query.length >= 3 && (
          <li className="relative py-5 hover:bg-gray-50">
            <div className="mx-auto flex max-w-7xl justify-between gap-x-6 px-4 sm:px-6 lg:px-8">
              <div className="flex gap-x-4">
                <PlusIcon className="h-12 w-12 flex-none rounded-full bg-gray-50" />

                <div className="min-w-0 flex-auto">
                  <p className="text-sm font-semibold leading-6 text-gray-900">
                    <a href={`/addBottle?name=${encodeURIComponent(query)}`}>
                      <span className="absolute inset-x-0 -top-px bottom-0" />
                      Can't find a bottle?
                    </a>
                  </p>
                  <p className="mt-1 flex text-xs leading-5 text-gray-500 gap-x-1">
                    <span>Tap here to add </span>
                    <strong className="truncate">{toTitleCase(query)}</strong>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-x-4">
                {/* <div className="hidden sm:flex sm:flex-col sm:items-end">
                  <p className="text-sm leading-6 text-gray-900">
                    {bottle.category}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    {bottle.statedAge}
                  </p>
                </div> */}
                <ChevronRightIcon
                  className="h-5 w-5 flex-none text-gray-400"
                  aria-hidden="true"
                />
              </div>
            </div>
          </li>
        )}
      </ul>
    </Layout>
  );
}
