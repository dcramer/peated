import { CheckIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { toTitleCase } from "@peated/server/lib/strings";
import config from "@peated/web/config";
import classNames from "@peated/web/lib/classNames";
import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useCallback, useEffect, useState } from "react";
import { useDebounceCallback } from "usehooks-ts";
import LayoutModal from "../layoutModal";
import ListItem from "../listItem";
import { Modal } from "../modal";
import SearchHeader from "../searchHeader";
import CreateOptionDialog from "./createOptionDialog";
import { filterDupes } from "./helpers";
import { SkeletonItem } from "./skeletonItem";
import type {
  CreateForm,
  OnQuery,
  OnRenderOption,
  OnResults,
  Option,
} from "./types";

export default function SelectDialog<T extends Option>({
  open,
  setOpen,
  onSelect,
  selectedValues = [],
  searchPlaceholder,
  emptyListItem,
  canCreate = false,
  createForm,
  multiple = false,
  onQuery,
  onResults,
  options = [],
  onRenderOption,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  onSelect?: (value: T) => void;
  selectedValues?: T[];
  searchPlaceholder?: string;
  emptyListItem?: (query: string) => ReactNode;
  canCreate?: boolean;
  multiple?: boolean;
  createForm?: CreateForm<T>;
  onQuery?: OnQuery<T>;
  onResults?: OnResults<T>;
  options?: T[];
  onRenderOption?: OnRenderOption<T>;
}) {
  const [query, setQuery] = useState("");
  const [optionList, setOptionList] = useState<T[]>([...selectedValues]);
  const [results, setResults] = useState<T[]>([]);
  const [previousValues, setPreviousValues] = useState<T[]>([
    ...selectedValues,
  ]);
  const [isLoading, setLoading] = useState(false);
  const [initialState, setInitialState] = useState<"loading" | "ready">(
    "loading",
  );
  const [createOpen, setCreateOpen] = useState(false);

  const unsafe_onSearch = useCallback(
    async (query = "") => {
      setLoading(true);
      const results = onQuery
        ? await onQuery(query, options)
        : options.filter(
            (o) => o.name.toLowerCase().indexOf(query.toLowerCase()) !== -1,
          );
      if (results === undefined) throw new Error("Invalid results returned");
      setResults(onResults ? onResults(results) : results);
      setQuery(query);
      setLoading(false);
      setInitialState("ready");
    },
    [onQuery, onResults],
  );

  const onSearch = useDebounceCallback(unsafe_onSearch);

  const selectOption = async (option: T) => {
    setPreviousValues(filterDupes([option], previousValues));
    onSelect && onSelect(option);
  };

  useEffect(() => {
    setOptionList(filterDupes(selectedValues, results, previousValues));
  }, [
    JSON.stringify(selectedValues),
    JSON.stringify(results),
    JSON.stringify(previousValues),
  ]);

  const listItemClasses = `px-3 group relative border-b border-slate-800 bg-slate-950 hover:bg-slate-900`;

  return (
    <>
      <Modal open={open} onClose={setOpen}>
        <LayoutModal
          noMargin
          header={
            <SearchHeader
              onClose={() => setOpen(false)}
              onChange={(value) => {
                setLoading(true);
                onSearch(value);
              }}
              onDone={multiple ? () => setOpen(false) : undefined}
              closeIcon={<XMarkIcon className="h-8 w-8" />}
              placeholder={searchPlaceholder}
              loading={isLoading}
            />
          }
        >
          <ul
            role="list"
            className="divide-y divide-slate-800 border-slate-800 lg:border-x lg:border-b"
          >
            {initialState === "loading" ? (
              [...Array(25).keys()].map((i) => <SkeletonItem key={i} />)
            ) : (
              <>
                {optionList.map((option) => {
                  return (
                    <ListItem
                      key={`${option.id}-${option.name}`}
                      as={motion.li}
                      className={listItemClasses}
                    >
                      <CheckIcon
                        className={classNames(
                          "-ml-2 h-10 w-10 flex-none rounded p-2",
                          selectedValues.find(
                            (i) => i.id == option.id && i.name == option.name,
                          )
                            ? "bg-highlight text-black"
                            : "text-muted bg-slate-900 group-hover:bg-slate-700",
                        )}
                      />

                      <div className="flex min-w-0 flex-auto items-center">
                        <div className="font-semibold text-white">
                          <button
                            onClick={() => {
                              selectOption(option);
                            }}
                          >
                            <span className="absolute inset-x-0 -top-px bottom-0" />
                            {onRenderOption
                              ? onRenderOption(option)
                              : option.name}
                          </button>
                        </div>
                      </div>
                    </ListItem>
                  );
                })}
                {(results.length < 10 || query !== "") && !isLoading && (
                  <ListItem as={motion.li} className={listItemClasses}>
                    {emptyListItem ? (
                      emptyListItem(query)
                    ) : canCreate && createForm ? (
                      <>
                        <PlusIcon className="-ml-2 h-10 w-10 flex-none rounded bg-slate-900 p-2 group-hover:bg-slate-800 group-hover:text-white" />

                        <div className="min-w-0 flex-auto">
                          <div className="font-semibold">
                            <button onClick={() => setCreateOpen(true)}>
                              <span className="absolute inset-x-0 -top-px bottom-0" />
                              Can't find what you're looking for?
                            </button>
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
                              <span>
                                Tap here to add a new entry to the database.
                              </span>
                            )}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <PlusIcon className="-ml-2 h-10 w-10 flex-none rounded-full bg-slate-900 p-2 group-hover:bg-slate-800 group-hover:text-white" />

                        <div className="min-w-0 flex-auto">
                          <div className="font-semibold">
                            <a
                              href={config.GITHUB_REPO}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <span className="absolute inset-x-0 -top-px bottom-0" />
                              Can't find what you're looking for?
                            </a>
                          </div>
                          <div className="mt-1 flex gap-x-1 text-sm">
                            Well, that stinks. Maybe open an issue on GitHub?
                          </div>
                        </div>
                      </>
                    )}
                  </ListItem>
                )}
              </>
            )}
          </ul>
        </LayoutModal>
      </Modal>
      {canCreate && createForm && (
        <CreateOptionDialog
          query={query}
          open={createOpen}
          setOpen={setCreateOpen}
          render={createForm}
          onSubmit={(newOption) => {
            selectOption(onResults ? onResults([newOption])[0] : newOption);
          }}
        />
      )}
    </>
  );
}
