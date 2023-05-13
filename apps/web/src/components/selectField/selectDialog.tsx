import { useEffect, useState } from "react";

import { Dialog } from "@headlessui/react";
import { CheckIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid";

import config from "../../config";
import api from "../../lib/api";
import classNames from "../../lib/classNames";
import { toTitleCase } from "../../lib/strings";
import Header from "../header";
import ListItem from "../listItem";
import SearchHeader from "../searchHeader";
import CreateOptionDialog from "./createOptionDialog";
import { CreateOptionForm } from "./types";

export type Option = {
  id?: string | null;
  name: string;
  [key: string]: any;
};

const filterDupes = (firstList: Option[], ...moreLists: Option[][]) => {
  const results: Option[] = [...firstList];
  const matches = new Set(firstList.map((i) => `${i.id}-${i.name}`));

  moreLists.forEach((options) => {
    options.forEach((i) => {
      if (!matches.has(`${i.id}-${i.name}`)) {
        results.push(i);
        matches.add(`${i.id}-${i.name}`);
      }
    });
  });
  return results;
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
  endpoint?: string;
  options?: Option[];
}) => {
  const [query, setQuery] = useState("");
  const [optionList, setOptionList] = useState<Option[]>([...selectedValues]);
  const [results, setResults] = useState<Option[]>([]);
  const [previousValues, setPreviousValues] = useState<Option[]>([
    ...selectedValues,
  ]);

  const [createOpen, setCreateOpen] = useState(false);

  const onSearch = async (query = "") => {
    const results = endpoint
      ? (
          await api.get(endpoint, {
            query: { query },
          })
        ).results
      : options?.filter(
          (o) => o.name.toLowerCase().indexOf(query.toLowerCase()) !== -1,
        );
    setResults(results);
  };

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
    <Dialog
      as="div"
      open={open}
      className="fixed inset-0 z-10 min-h-screen overflow-y-auto text-center"
      onClose={setOpen}
    >
      <Dialog.Overlay className="fixed inset-0" />

      <Dialog.Panel className="relative h-screen min-h-full min-w-full transform overflow-hidden overflow-y-auto bg-white text-left transition-all">
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
          <ul role="list" className="divide-y divide-gray-100">
            {optionList.map((option) => {
              return (
                <ListItem key={`${option.id}-${option.name}`}>
                  <CheckIcon
                    className={classNames(
                      "h-12 w-12 flex-none rounded-full bg-gray-100 p-2 text-gray-100",
                      selectedValues.find(
                        (i) => i.id == option.id && i.name == option.name,
                      )
                        ? "bg-peated  text-white"
                        : "group-hover:bg-gray-200",
                    )}
                  />

                  <div className="flex min-w-0 flex-auto items-center">
                    <p className="font-semibold leading-6 text-gray-900">
                      <button
                        onClick={() => {
                          selectOption(option);
                        }}
                      >
                        <span className="absolute inset-x-0 -top-px bottom-0" />
                        {option.name}
                      </button>
                    </p>
                    <p className="mt-1 flex truncate text-xs leading-5 text-gray-500"></p>
                  </div>
                </ListItem>
              );
            })}
            {(results.length === 0 || query !== "") &&
              (canCreate && createForm ? (
                <ListItem>
                  <PlusIcon className="group-hover:bg-peated h-12 w-12 flex-none rounded-full bg-gray-100 p-2 group-hover:text-white" />

                  <div className="min-w-0 flex-auto">
                    <p className="font-semibold leading-6 text-gray-900">
                      <button onClick={() => setCreateOpen(true)}>
                        <span className="absolute inset-x-0 -top-px bottom-0" />
                        Can't find what you're looking for?
                      </button>
                    </p>
                    <p className="mt-1 flex gap-x-1 text-sm leading-5 text-gray-500">
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
                    </p>
                  </div>
                </ListItem>
              ) : (
                <ListItem>
                  <PlusIcon className="group-hover:bg-peated h-12 w-12 flex-none rounded-full bg-gray-100 p-2 group-hover:text-white" />

                  <div className="min-w-0 flex-auto">
                    <p className="font-semibold leading-6 text-gray-900">
                      <a
                        href={config.GITHUB_REPO}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <span className="absolute inset-x-0 -top-px bottom-0" />
                        Can't find what you're looking for?
                      </a>
                    </p>
                    <p className="mt-1 flex gap-x-1 text-sm leading-5 text-gray-500">
                      Well, that stinks. Maybe a open an issue on GitHub?
                    </p>
                  </div>
                </ListItem>
              ))}
          </ul>
        </main>
        {canCreate && createForm && (
          <CreateOptionDialog
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
