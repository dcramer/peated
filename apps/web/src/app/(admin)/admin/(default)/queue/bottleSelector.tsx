"use client";

import { PlusIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { toTitleCase } from "@peated/server/lib/strings";
import { type Bottle } from "@peated/server/types";
import BottleIcon from "@peated/web/assets/bottle.svg";
import LayoutModal from "@peated/web/components/layoutModal";
import Link from "@peated/web/components/link";
import ListItem from "@peated/web/components/listItem";
import { Modal } from "@peated/web/components/modal";
import SearchHeader from "@peated/web/components/searchHeader";
import Spinner from "@peated/web/components/spinner";
import { trpc } from "@peated/web/lib/trpc/client";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
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

  const trpcUtils = trpc.useUtils();

  const onSearch = useDebounceCallback(async (query = "") => {
    setLoading(true);
    const { results } = await trpcUtils.bottleList.fetch({ query });
    setResults(results);
    setLoading(false);
  });

  useEffect(() => {
    if (!open) return;
    onSearch(name);
    setQuery(name ?? "");
  }, [name, open]);

  const selectOption = async (option: Bottle) => {
    onSelect && onSelect(option);
  };

  if (!name) return null;

  const listItemClasses = `px-3 group relative border-b border-slate-800 bg-slate-950 hover:bg-slate-900`;

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
            <div className="prose prose-invert text-muted max-w-none bg-slate-800 p-6">
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
          <ul role="list" className="divide-y divide-slate-800">
            {results.map((bottle) => {
              return (
                <ListItem
                  key={bottle.id}
                  as={motion.li}
                  className={listItemClasses}
                >
                  <BottleIcon className="-ml-2 h-10 w-10 flex-none p-2 group-hover:text-white" />

                  <button
                    onClick={() => {
                      selectOption(bottle);
                    }}
                    className="flex min-w-0 flex-auto flex-col justify-center text-left font-semibold text-white"
                  >
                    <div className="font-bold">
                      {bottle.fullName}
                      {bottle.releaseYear ? (
                        <span className="text-muted">
                          ({bottle.releaseYear} Release)
                        </span>
                      ) : bottle.vintageYear ? (
                        <span className="text-muted">
                          ({bottle.vintageYear} Vintage)
                        </span>
                      ) : null}
                    </div>
                    <div className="text-muted flex space-x-2">
                      {bottle.distillers.map((distiller) => distiller.name)}
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
                      <span className="absolute inset-x-0 -top-px bottom-0" />
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
