import { Dialog } from "@headlessui/react";
import { CheckIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid";
import { useEffect, useState } from "react";

import { toTitleCase } from "@peated/server/lib/strings";

import config from "../../config";
import { debounce } from "../../lib/api";
import classNames from "../../lib/classNames";
import Header from "../header";
import ListItem from "../listItem";
import SearchHeader from "../searchHeader";
import CreateOptionDialog from "./createOptionDialog";
import { filterDupes } from "./helpers";
import type {
  CreateOptionForm,
  EndpointOptions,
  OnQuery,
  OnResults,
} from "./types";

export type Option = {
  id?: string | number | null;
  name: string;
  [key: string]: any;
};

export default ({
  open,
  setOpen,
  onSelect,
  selectedValues = [],
  searchPlaceholder,
  canCreate = false,
  createForm,
  multiple = false,
  endpoint,
  onQuery,
  onResults,
  options,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  onSelect?: (value: Option) => void;
  selectedValues?: Option[];
  searchPlaceholder?: string;
  canCreate?: boolean;
  multiple?: boolean;
  createForm?: CreateOptionForm;
  onQuery?: OnQuery;
  endpoint?: EndpointOptions;
  onResults?: OnResults;
  options?: Option[];
}) => {
  const [query, setQuery] = useState("");
  const [optionList, setOptionList] = useState<Option[]>([...selectedValues]);
  const [results, setResults] = useState<Option[]>([]);
  const [previousValues, setPreviousValues] = useState<Option[]>([
    ...selectedValues,
  ]);

  const [createOpen, setCreateOpen] = useState(false);

  const fetch = debounce(async (query = "") => {
    const results = onQuery
      ? await onQuery(query)
      : options?.filter(
          (o) => o.name.toLowerCase().indexOf(query.toLowerCase()) !== -1,
        );
    if (results === undefined) throw new Error("Invalid results returned");
    setResults(onResults ? onResults(results) : results);
  }, 300);

  const onSearch = fetch;

  const selectOption = async (option: Option) => {
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
        <Header>
          <SearchHeader
            onClose={() => setOpen(false)}
            onChange={(value) => {
              setQuery(value);
            }}
            onDone={multiple ? () => setOpen(false) : undefined}
            closeIcon={<XMarkIcon className="h-8 w-8" />}
            placeholder={searchPlaceholder}
          />
        </Header>
        <main className={"m-h-screen relative mx-auto max-w-4xl"}>
          <ul role="list" className="space-y">
            {optionList.map((option) => {
              return (
                <ListItem key={`${option.id}-${option.name}`}>
                  <CheckIcon
                    className={classNames(
                      "h-12 w-12 flex-none rounded-full p-2",
                      selectedValues.find(
                        (i) => i.id == option.id && i.name == option.name,
                      )
                        ? "bg-highlight text-black"
                        : "bg-slate-900 text-slate-500 group-hover:bg-slate-800",
                    )}
                  />

                  <div className="flex min-w-0 flex-auto items-center">
                    <div className="font-semibold leading-6 text-white">
                      <button
                        onClick={() => {
                          selectOption(option);
                        }}
                      >
                        <span className="absolute inset-x-0 -top-px bottom-0" />
                        {option.name}
                      </button>
                    </div>
                  </div>
                </ListItem>
              );
            })}
            {(results.length === 0 || query !== "") &&
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
};
