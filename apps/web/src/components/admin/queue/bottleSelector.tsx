"use client";

import { PlusIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { toTitleCase } from "@peated/server/lib/strings";
import type { Bottle } from "@peated/server/types";
import BottleIcon from "@peated/web/assets/bottle.svg";
import Join from "@peated/web/components/join";
import LayoutModal from "@peated/web/components/layoutModal";
import Link from "@peated/web/components/link";
import ListItem from "@peated/web/components/listItem";
import { Modal } from "@peated/web/components/modal";
import SearchHeader from "@peated/web/components/searchHeader";
import Spinner from "@peated/web/components/spinner";
import { useORPC } from "@peated/web/lib/orpc/context";
import { motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";

export default function BottleSelector({
  open,
  name,
  returnTo,
  onClose,
  onSelect,
  source,
}: {
  open: boolean;
  name?: string | null;
  returnTo?: string;
  onClose: () => void;
  onSelect?: (value: Bottle) => void;
  source?: string;
}) {
  const [query, setQuery] = useState(name ?? "");
  const [results, setResults] = useState<Bottle[]>([]);
  const [isLoading, setLoading] = useState(false);

  const orpc = useORPC();

  const unsafe_onSearch = useCallback(
    async (query = "") => {
      setLoading(true);
      const { results } = await orpc.bottles.list.call({
        query,
      });
      setResults(results);
      setLoading(false);
    },
    [orpc]
  );

  const onSearch = useDebounceCallback(unsafe_onSearch);

  useEffect(() => {
    if (!open) return;
    onSearch(name ?? "");
    setQuery(name ?? "");
  }, [name, open]);

  const selectOption = async (option: Bottle) => {
    onSelect?.(option);
  };

  if (!name) return null;

  const listItemClasses =
    "px-3 group relative border-b border-slate-800 bg-slate-950 hover:bg-slate-900";

  return (
    <Modal open={open} onClose={onClose}>
      <LayoutModal
        header={
          <SearchHeader
            onClose={onClose}
            value={query}
            onChange={(value) => {
              setQuery(query);
              onSearch(value);
            }}
            closeIcon={<XMarkIcon className="h-8 w-8" />}
            placeholder="Search for a bottle"
          />
        }
      >
        <div className="relative mx-auto lg:px-8">
          {(name || source) && (
            <div className="prose prose-invert max-w-none bg-slate-800 p-6 text-muted">
              {name && (
                <p>
                  Select the bottle that is identified as{" "}
                  <strong className="text-white underline">{name}</strong>.
                </p>
              )}
              {source ? (
                <p>
                  Source:{" "}
                  <Link href={source} target="_blank">
                    {source}
                  </Link>
                </p>
              ) : null}
            </div>
          )}

          {isLoading && (
            <div className="fixed inset-0 z-10">
              <div className="absolute inset-0 bg-slate-800 opacity-50" />
              <Spinner />
            </div>
          )}
          <ul className="divide-y divide-slate-800">
            {results.map((bottle) => {
              return (
                <ListItem
                  key={bottle.id}
                  as={motion.li}
                  className={listItemClasses}
                >
                  <div className="-ml-2 h-10 w-10 flex-none p-2 group-hover:text-white">
                    <BottleIcon />
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      selectOption(bottle);
                    }}
                    className="flex min-w-0 flex-auto flex-col justify-center text-left font-semibold text-white"
                  >
                    <div className="flex items-center gap-x-1 font-bold">
                      {bottle.fullName}
                    </div>
                    <div className="flex space-x-2 text-muted">
                      {bottle.distillers.length ? (
                        <Join divider=", ">
                          {bottle.distillers.map((distiller) => distiller.name)}
                        </Join>
                      ) : null}
                    </div>
                  </button>
                </ListItem>
              );
            })}
            {(results.length < 10 || query !== "") && (
              <ListItem as={motion.li} className={listItemClasses}>
                <PlusIcon className="-ml-2 h-10 w-10 flex-none rounded-full bg-slate-900 p-2 group-hover:bg-slate-800 group-hover:text-white" />

                <div className="min-w-0 flex-auto">
                  <div className="font-semibold">
                    <a
                      href={`/addBottle?name=${encodeURIComponent(toTitleCase(query))}&${returnTo ? `returnTo=${encodeURIComponent(returnTo)}` : ""}`}
                    >
                      <span className="-top-px absolute inset-x-0 bottom-0" />
                      Can't find what you're looking for?
                    </a>
                  </div>
                  <div className="mt-1 flex gap-x-1 text-sm">
                    {query !== "" ? (
                      <span>
                        Tap here to add{" "}
                        <strong className="truncate font-bold">
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
          </ul>
        </div>
      </LayoutModal>
    </Modal>
  );
}
