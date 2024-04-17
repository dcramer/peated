import { Dialog } from "@headlessui/react";
import { CheckIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { toTitleCase } from "@peated/server/lib/strings";
import config from "@peated/web/config";
import classNames from "@peated/web/lib/classNames";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { debounce } from "ts-debounce";
import ListItem from "../listItem";
import SearchHeader from "../searchHeader";
import CreateOptionDialog from "./createOptionDialog";
import { filterDupes } from "./helpers";
import type {
  CreateOptionForm,
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
  canCreate?: boolean;
  multiple?: boolean;
  createForm?: CreateOptionForm<T>;
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

  const [createOpen, setCreateOpen] = useState(false);

  const fetch = debounce(async (query = "") => {
    const results = onQuery
      ? await onQuery(query, options)
      : options.filter(
          (o) => o.name.toLowerCase().indexOf(query.toLowerCase()) !== -1,
        );
    if (results === undefined) throw new Error("Invalid results returned");
    setResults(onResults ? onResults(results) : results);
  }, 300);

  const onSearch = fetch;

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

  useEffect(() => {
    onSearch(query);
  }, [query]);

  return (
    <Dialog as="div" open={open} className="dialog" onClose={setOpen}>
      <Dialog.Overlay className="fixed inset-0" />

      <Dialog.Panel className="dialog-panel">
        <header className="h-14 flex-shrink-0 overflow-hidden lg:h-16">
          <div className="fixed left-0 right-0 z-10 border-b border-b-slate-700 bg-slate-950">
            <div className="mx-auto flex h-14 max-w-4xl lg:h-16">
              <div className="flex flex-1 items-center justify-between px-4">
                <SearchHeader
                  onClose={() => setOpen(false)}
                  onChange={(value) => {
                    setQuery(value);
                  }}
                  onDone={multiple ? () => setOpen(false) : undefined}
                  closeIcon={<XMarkIcon className="h-8 w-8" />}
                  placeholder={searchPlaceholder}
                />
              </div>
            </div>
          </div>
        </header>
        <main className={"m-h-screen relative mx-auto max-w-4xl"}>
          <ul role="list" className="sm:my-2 sm:space-y-2">
            {optionList.map((option) => {
              return (
                <ListItem
                  key={`${option.id}-${option.name}`}
                  as={motion.li}
                  className="card group group relative rounded border-b border-slate-700 bg-slate-950 hover:bg-slate-900 sm:border-0"
                >
                  {multiple && (
                    <CheckIcon
                      className={classNames(
                        "h-12 w-12 flex-none rounded p-2",
                        selectedValues.find(
                          (i) => i.id == option.id && i.name == option.name,
                        )
                          ? "bg-highlight text-black"
                          : "text-light bg-slate-900 group-hover:bg-slate-800",
                      )}
                    />
                  )}

                  <div className="flex min-w-0 flex-auto items-center">
                    <div className="font-semibold leading-6 text-white">
                      <button
                        onClick={() => {
                          selectOption(option);
                        }}
                      >
                        <span className="absolute inset-x-0 -top-px bottom-0" />
                        {onRenderOption ? onRenderOption(option) : option.name}
                      </button>
                    </div>
                  </div>
                </ListItem>
              );
            })}
            {(results.length < 10 || query !== "") &&
              (canCreate && createForm ? (
                <ListItem>
                  <PlusIcon className="h-12 w-12 flex-none rounded-full bg-slate-900 p-2 group-hover:bg-slate-800 group-hover:text-white" />

                  <div className="min-w-0 flex-auto">
                    <div className="font-semibold leading-6">
                      <button onClick={() => setCreateOpen(true)}>
                        <span className="absolute inset-x-0 -top-px bottom-0" />
                        Can't find what you're looking for?
                      </button>
                    </div>
                    <div className="mt-1 flex gap-x-1 text-sm leading-5">
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
              ) : (
                <ListItem>
                  <PlusIcon className="h-12 w-12 flex-none rounded-full bg-slate-900 p-2 group-hover:bg-slate-800 group-hover:text-white" />

                  <div className="min-w-0 flex-auto">
                    <div className="font-semibold leading-6">
                      <a
                        href={config.GITHUB_REPO}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="absolute inset-x-0 -top-px bottom-0" />
                        Can't find what you're looking for?
                      </a>
                    </div>
                    <div className="mt-1 flex gap-x-1 text-sm leading-5">
                      Well, that stinks. Maybe open an issue on GitHub?
                    </div>
                  </div>
                </ListItem>
              ))}
          </ul>
        </main>
        {canCreate && createForm && (
          <CreateOptionDialog
            query={query}
            open={createOpen}
            setOpen={setCreateOpen}
            render={createForm}
            onSubmit={(newOption) => {
              selectOption(newOption);
            }}
          />
        )}
      </Dialog.Panel>
    </Dialog>
  );
}
