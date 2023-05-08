import { Fragment, ReactNode, useEffect, useState } from "react";

import FormField from "./formField";
import { Dialog, Transition } from "@headlessui/react";
import Chip from "./chip";
import SearchHeader from "./searchHeader";
import Header from "./header";
import { CheckIcon, PlusIcon, XMarkIcon } from "@heroicons/react/20/solid";
import api from "../lib/api";
import { toTitleCase } from "../lib/strings";
import Button from "./button";
import config from "../config";
import classNames from "../lib/classNames";
import ListItem from "./listItem";

export type Option = {
  id?: string | null;
  name: string;
  [key: string]: any;
};

const OverlayTransition = ({ children }: { children: ReactNode }) => {
  return (
    <Transition.Child
      as={Fragment}
      enter="ease-out duration-300"
      enterFrom="opacity-0"
      enterTo="opacity-100"
      leave="ease-in duration-200"
      leaveFrom="opacity-100"
      leaveTo="opacity-0"
    >
      {children}
    </Transition.Child>
  );
};

const PanelTransition = ({ children }: { children: ReactNode }) => {
  return (
    <Transition.Child
      as={Fragment}
      enter="ease-out duration-300"
      enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
      enterTo="opacity-100 translate-y-0 sm:scale-100"
      leave="ease-in duration-200"
      leaveFrom="opacity-100 translate-y-0 sm:scale-100"
      leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
    >
      {children}
    </Transition.Child>
  );
};

type CreateOptionForm = ({
  data,
  onFieldChange,
}: {
  data: Option;
  onFieldChange: (arg0: Partial<Option>) => void;
}) => ReactNode;

// TODO(dcramer): hitting escape doesnt do what you want here (it does nothing)
const CreateOptionDialog = ({
  open,
  setOpen,
  onSubmit,
  render,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  onSubmit?: (newOption: Option) => void;
  render: CreateOptionForm;
}) => {
  const [newOption, setNewOption] = useState<Option>({
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

                  onSubmit && onSubmit({ ...newOption });

                  setOpen(false);
                }}
                className="max-w-md"
              >
                {render({
                  data: newOption,
                  onFieldChange: (value) => {
                    setNewOption({
                      ...newOption,
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

const SelectDialog = ({
  open,
  setOpen,
  onSelect = () => {},
  selectedValues = [],
  searchPlaceholder,
  canCreate = false,
  createForm,
  endpoint,
  options,
}: {
  open: boolean;
  setOpen: (value: boolean) => void;
  onSelect?: (value: any) => void;
  selectedValues?: any[];
  searchPlaceholder?: string;
  canCreate?: boolean;
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

  const onSearch = async (query: string = "") => {
    const results = endpoint
      ? await api.get(endpoint, {
          query: { query },
        })
      : options?.filter(
          (o) => o.name.toLowerCase().indexOf(query.toLowerCase()) !== -1
        );
    setResults(results);
  };

  const selectOption = async (option: Option) => {
    setPreviousValues(filterDupes([option], previousValues));
    onSelect(option);
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
                    {optionList.map((option) => {
                      return (
                        <ListItem key={`${option.id}-${option.name}`}>
                          <CheckIcon
                            className={classNames(
                              "h-12 w-12 p-2 flex-none rounded-full bg-gray-100 group-hover:bg-peated group-hover:text-white",
                              selectedValues.find(
                                (i) =>
                                  i.id == option.id && i.name == option.name
                              ) && "bg-peated text-white"
                            )}
                          />

                          <div className="min-w-0 flex-auto flex items-center">
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
                            <p className="mt-1 flex text-xs leading-5 text-gray-500 truncate"></p>
                          </div>
                        </ListItem>
                      );
                    })}
                    {(results.length === 0 || query !== "") &&
                      (canCreate && createForm ? (
                        <ListItem>
                          <PlusIcon className="h-12 w-12 p-2 flex-none rounded-full bg-gray-100 group-hover:bg-peated group-hover:text-white" />

                          <div className="min-w-0 flex-auto">
                            <p className="font-semibold leading-6 text-gray-900">
                              <button onClick={() => setCreateOpen(true)}>
                                <span className="absolute inset-x-0 -top-px bottom-0" />
                                Can't find what you're looking for?
                              </button>
                            </p>
                            <p className="mt-1 flex text-sm leading-5 text-gray-500 gap-x-1">
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
                          <PlusIcon className="h-12 w-12 p-2 flex-none rounded-full bg-gray-100 group-hover:bg-peated group-hover:text-white" />

                          <div className="min-w-0 flex-auto">
                            <p className="font-semibold leading-6 text-gray-900">
                              <a href={config.GITHUB_REPO} target="_blank">
                                <span className="absolute inset-x-0 -top-px bottom-0" />
                                Can't find what you're looking for?
                              </a>
                            </p>
                            <p className="mt-1 flex text-sm leading-5 text-gray-500 gap-x-1">
                              Well, that stinks. Maybe a open an issue on
                              GitHub?
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
            </PanelTransition>
          </div>
        </Dialog>
      </Transition.Root>
    </>
  );
};

type Props = {
  name?: string;
  value?: Option | Option[] | null;
  label?: string;
  helpText?: string;
  required?: boolean;
  multiple?: boolean;
  placeholder?: string;

  onChange?: (value: Option | Option[]) => void;

  // maximum number of options to backfill with suggestions
  // available for quick selection
  targetOptions?: number;

  canCreate?: boolean;
  createForm?: CreateOptionForm;

  // options are gathered either via dynamic query
  endpoint?: string;
  // or fixed value
  options?: Option[];
  // static suggestions can also be provided
  suggestedOptions?: Option[];

  children?: ReactNode;
  className?: string;
};

export default ({
  name,
  helpText,
  label,
  required,
  className,
  multiple = false,
  targetOptions = 5,
  suggestedOptions = [],
  canCreate = false,
  createForm,
  placeholder,
  endpoint,
  options = [],
  onChange = () => {},
  ...props
}: Props) => {
  const initialValue = Array.isArray(props.value)
    ? props.value
    : props.value
    ? [props.value]
    : [];

  const [value, setValue] = useState<Option[]>(initialValue);
  const [previousValues, setPreviousValues] = useState<Option[]>(value);
  const [dialogOpen, setDialogOpen] = useState(false);

  const toggleOption = (option: Option) => {
    setPreviousValues(filterDupes([option], previousValues));
    if (value.find((i) => i.id == option.id && i.name == option.name)) {
      setValue(value.filter((i) => i.id != option.id || i.name != option.name));
      return false;
    }

    if (multiple) {
      setValue([option, ...value]);
    } else {
      setValue([option]);
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

  if (visibleValues.length < targetOptions) {
    filterDupes(visibleValues, suggestedOptions)
      .slice(visibleValues.length, targetOptions)
      .forEach((i) => {
        visibleValues.push(i);
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
      <div className="flex items-center gap-x-2 sm:leading-6 mt-1">
        {visibleValues.map((option) => (
          <Chip
            key={`${option.id}-${option.name}`}
            active={value.indexOf(option) !== -1}
            onClick={() => toggleOption(option)}
          >
            {option.name}
          </Chip>
        ))}
        {visibleValues.length === 0 && placeholder && (
          <div className="text-gray-400 sm:leading-6">{placeholder}</div>
        )}
      </div>
      <SelectDialog
        open={dialogOpen}
        setOpen={setDialogOpen}
        onSelect={(option) => {
          const active = toggleOption(option);
          if (!multiple && active) setDialogOpen(false);
        }}
        canCreate={canCreate}
        createForm={createForm}
        selectedValues={value}
        searchPlaceholder="Search for a distiller"
        endpoint={endpoint}
        options={options}
      />
    </FormField>
  );
};
