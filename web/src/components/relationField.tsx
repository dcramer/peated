import { Fragment, ReactNode, useEffect, useState } from "react";

import FormField from "./formField";
import { Dialog, Transition } from "@headlessui/react";
import Chip from "./chip";
import SearchHeader from "./searchHeader";
import Header from "./header";
import {
  CheckIcon,
  CircleStackIcon,
  PlusIcon,
  XMarkIcon,
} from "@heroicons/react/20/solid";
import api from "../lib/api";
import { toTitleCase } from "../lib/strings";
import Button from "./button";
import config from "../config";
import classNames from "../lib/classNames";

type Item = {
  id?: string | null;
  name: string;
  [key: string]: any;
};

const OverlayTransition = (
  props: React.ComponentProps<typeof Transition.Child>
) => {
  return (
    <Transition.Child
      as={Fragment}
      enter="ease-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="ease-in duration-200"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
      {...props}
    />
  );
};

const PanelTransition = (
  props: React.ComponentProps<typeof Transition.Child>
) => {
  return (
    <Transition.Child
      as={Fragment}
      enter="ease-out duration-300"
      enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
      enterTo="opacity-100 translate-y-0 sm:scale-100"
      leave="ease-in duration-200"
      leaveFrom="opacity-100 translate-y-0 sm:scale-100"
      leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
      {...props}
    />
  );
};

type CreateItemForm = ({
  data,
  onFieldChange,
}: {
  data: Item;
  onFieldChange: (arg0: Partial<Item>) => void;
}) => ReactNode;

// TODO(dcramer): hitting escape doesnt do what you want here (it does nothing)
const CreateItemDialog = ({
  open,
  setOpen,
  onSubmit,
  render,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  onSubmit?: (newItem: Item) => void;
  render: CreateItemForm;
}) => {
  const [newItem, setNewItem] = useState<Item>({
    id: null,
    name: "",
  });

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog
        as="div"
        className="fixed inset-0 z-10 overflow-y-auto min-h-screen"
        onClose={setOpen}
        unmount={true}
      >
        <div className="min-h-screen text-center">
          <OverlayTransition>
            <Dialog.Overlay className="fixed inset-0" />
          </OverlayTransition>

          <PanelTransition>
            <Dialog.Panel className="relative h-screen transform overflow-hidden bg-white px-4 pb-4 pt-5 text-left transition-all min-w-full sm:p-6 justify-center items-center flex">
              <form
                onSubmit={(e) => {
                  e.preventDefault();

                  onSubmit && onSubmit({ ...newItem });

                  setOpen(false);
                }}
                className="max-w-md"
              >
                {render({
                  data: newItem,
                  onFieldChange: (value) => {
                    setNewItem({
                      ...newItem,
                      ...value,
                    });
                  },
                })}
                <div className="mt-5 sm:mt-6 flex gap-x-2 flex-row-reverse flex">
                  <Button color="primary" type="submit">
                    Save Changes
                  </Button>
                  <Button
                    onClick={() => {
                      setOpen(false);
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </Dialog.Panel>
          </PanelTransition>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

const ListItem = ({ children }: { children?: ReactNode }) => {
  return (
    <li className="relative py-5 hover:bg-gray-100">
      <div className="mx-auto flex max-w-7xl justify-between gap-x-6 px-4 sm:px-6 lg:px-8">
        <div className="flex gap-x-4">{children}</div>
      </div>
    </li>
  );
};

const filterDupes = (firstList: Item[], ...moreLists: Item[][]) => {
  const results: Item[] = [...firstList];
  const matches = new Set(firstList.map((i) => `${i.id}-${i.name}`));

  moreLists.forEach((items) => {
    items.forEach((i) => {
      if (!matches.has(`${i.id}-${i.name}`)) {
        results.push(i);
        matches.add(`${i.id}-${i.name}`);
      }
    });
  });
  return results;
};

const SelectDialog = ({
  open,
  setOpen,
  onSelect = (value: any) => {},
  selectedValues = [],
  searchPlaceholder,
  canCreate = false,
  createForm,
  endpoint,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  onSelect?: (value: any) => void;
  selectedValues?: any[];
  searchPlaceholder?: string;
  canCreate?: boolean;
  createForm?: CreateItemForm;
  endpoint: string;
}) => {
  const [query, setQuery] = useState("");
  const [itemList, setItemList] = useState<Item[]>([...selectedValues]);
  const [results, setResults] = useState<Item[]>([]);
  const [previousValues, setPreviousValues] = useState<Item[]>([
    ...selectedValues,
  ]);

  const [createOpen, setCreateOpen] = useState(false);

  const onSearch = async (query: string = "") => {
    const results = await api.get(endpoint, {
      query: { query },
    });
    setResults(results);
  };

  const selectItem = async (item: Item) => {
    setPreviousValues(filterDupes([item], previousValues));
    onSelect(item);
  };

  useEffect(() => {
    setItemList(filterDupes(selectedValues, results, previousValues));
  }, [
    JSON.stringify(selectedValues),
    JSON.stringify(results),
    JSON.stringify(previousValues),
  ]);

  useEffect(() => {
    onSearch(query);
  }, [query]);

  return (
    <>
      <Transition.Root show={open} as={Fragment}>
        <Dialog
          as="div"
          className="fixed inset-0 z-10 overflow-y-auto min-h-screen"
          onClose={setOpen}
        >
          <div className="min-h-screen text-center">
            <OverlayTransition>
              <Dialog.Overlay className="fixed inset-0" />
            </OverlayTransition>

            <PanelTransition>
              <Dialog.Panel className="relative min-h-full h-screen transform overflow-hidden overflow-y-auto bg-white text-left transition-all min-w-full">
                <Header>
                  <SearchHeader
                    onClose={() => setOpen(false)}
                    onChange={(value) => {
                      setQuery(value);
                    }}
                    closeIcon={<XMarkIcon className="h-8 w-8" />}
                    placeholder={searchPlaceholder}
                  />
                </Header>
                <main className={"mx-auto max-w-4xl m-h-screen relative"}>
                  <ul role="list" className="divide-y divide-gray-100">
                    {itemList.map((item) => {
                      return (
                        <ListItem key={`${item.id}-${item.name}`}>
                          <CheckIcon
                            className={classNames(
                              "h-10 w-10 p-2 flex-none rounded-full bg-gray-100 group-hover:bg-peated group-hover:text-white",
                              selectedValues.find(
                                (i) => i.id == item.id && i.name == item.name
                              ) && "bg-peated text-white"
                            )}
                          />

                          <div className="min-w-0 flex-auto">
                            <p className="text-sm font-semibold leading-6 text-gray-900">
                              <button
                                onClick={() => {
                                  selectItem(item);
                                }}
                              >
                                <span className="absolute inset-x-0 -top-px bottom-0" />
                                {item.name}
                              </button>
                            </p>
                            <p className="mt-1 flex text-xs leading-5 text-gray-500 truncate"></p>
                          </div>
                        </ListItem>
                      );
                    })}
                    {(results.length === 0 || query !== "") &&
                      (canCreate && createForm ? (
                        <ListItem>
                          <PlusIcon className="h-10 w-10 p-2 flex-none rounded-full bg-gray-100 group-hover:bg-peated group-hover:text-white" />

                          <div className="min-w-0 flex-auto">
                            <p className="text-sm font-semibold leading-6 text-gray-900">
                              <button onClick={() => setCreateOpen(true)}>
                                <span className="absolute inset-x-0 -top-px bottom-0" />
                                Can't find what you're looking for?
                              </button>
                            </p>
                            <p className="mt-1 flex text-xs leading-5 text-gray-500 gap-x-1">
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
                          <PlusIcon className="h-10 w-10 p-2 flex-none rounded-full bg-gray-100 group-hover:bg-peated group-hover:text-white" />

                          <div className="min-w-0 flex-auto">
                            <p className="text-sm font-semibold leading-6 text-gray-900">
                              <a href={config.GITHUB_REPO} target="_blank">
                                <span className="absolute inset-x-0 -top-px bottom-0" />
                                Can't find a distiller?
                              </a>
                            </p>
                            <p className="mt-1 flex text-xs leading-5 text-gray-500 gap-x-1">
                              Well, that stinks. Maybe a open an issue on
                              GitHub?
                            </p>
                          </div>
                        </ListItem>
                      ))}
                  </ul>
                </main>
                {canCreate && createForm && (
                  <CreateItemDialog
                    open={createOpen}
                    setOpen={setCreateOpen}
                    render={createForm}
                    onSubmit={(newItem) => {
                      selectItem(newItem);
                    }}
                  />
                )}
              </Dialog.Panel>
            </PanelTransition>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );
};

type Props = {
  name?: string;
  label?: string;
  helpText?: string;
  required?: boolean;
  children?: ReactNode;
  className?: string;
  value?: Item[];
  onChange?: (value: Item | Item[]) => void;
  targetItems?: number;
  multiple?: boolean;
  suggestedItems?: Item[];
  canCreate?: boolean;
  createForm?: CreateItemForm;
  placeholder?: string;
  endpoint: string;
};

export default ({
  name,
  helpText,
  label,
  required,
  className,
  multiple = false,
  targetItems = 0,
  suggestedItems = [],
  canCreate = false,
  createForm,
  placeholder,
  endpoint,
  onChange = (value: Item | Item[]) => {},
  ...props
}: Props) => {
  const [value, setValue] = useState<Item[]>(props.value || []);
  const [previousValues, setPreviousValues] = useState<Item[]>(
    props.value || []
  );
  const [dialogOpen, setDialogOpen] = useState(false);

  const toggleItem = (item: Item) => {
    setPreviousValues(filterDupes([item], previousValues));
    if (value.find((i) => i.id == item.id && i.name == item.name)) {
      setValue(value.filter((i) => i.id != item.id || i.name != item.name));
      return false;
    }

    if (multiple) {
      setValue([item, ...value]);
    } else {
      setValue([item]);
    }
    return true;
  };

  useEffect(() => {
    if (multiple) {
      onChange(value);
    } else {
      onChange(value[0]);
    }
  }, [JSON.stringify(value)]);

  const visibleValues = filterDupes(value, previousValues);

  if (targetItems && value.length < targetItems) {
    suggestedItems
      .filter(
        (item) => !value.find((i) => i.id == item.id && i.name == item.name)
      )
      .slice(0, targetItems - value.length)
      .forEach((item) => {
        visibleValues.push(item);
      });
  }

  return (
    <FormField
      label={label}
      htmlFor={`f-${name}`}
      required={required}
      helpText={helpText}
      className={className}
      labelAction={() => {
        setDialogOpen(true);
      }}
    >
      <div className="flex items-center gap-x-2 sm:leading-6">
        {visibleValues.map((item) => (
          <Chip
            key={`${item.id}-${item.name}`}
            active={value.indexOf(item) !== -1}
            onClick={() => toggleItem(item)}
          >
            {item.name}
          </Chip>
        ))}
        {visibleValues.length === 0 && placeholder && (
          <div className="text-gray-400 text-sm sm:leading-6">
            {placeholder}
          </div>
        )}
      </div>
      <SelectDialog
        open={dialogOpen}
        setOpen={setDialogOpen}
        onSelect={(item) => {
          const active = toggleItem(item);
          if (!multiple && active) setDialogOpen(false);
        }}
        canCreate={canCreate}
        createForm={createForm}
        selectedValues={value}
        searchPlaceholder="Search for a distiller"
        endpoint={endpoint}
      />
    </FormField>
  );
};
