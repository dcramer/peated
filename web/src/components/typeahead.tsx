import { Combobox, Dialog, Transition } from "@headlessui/react";
import { CheckIcon, ChevronDownIcon } from "@heroicons/react/24/outline";
import { Fragment, useEffect, useState } from "react";
import Button from "./button";
import { toTitleCase } from "../lib/strings";
import api from "../lib/api";

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

type Item = {
  id: string;
  name: string;
  [key: string]: any;
};

type Props = React.ComponentPropsWithoutRef<"select"> & {
  endpoint: string;
  createForm?: any;
  canCreate?: boolean;
  onChange: (value: Item | undefined) => void;
};

export default ({
  endpoint,
  canCreate,
  createForm,
  onChange,
  ...props
}: Props) => {
  const [value, setValue] = useState<Item>();
  const [query, setQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogValue, setDialogValue] = useState({});
  const [results, setResults] = useState<Item[]>([]);

  useEffect(() => {
    api
      .get(endpoint, {
        query: { query: query || "" },
        limit: 10,
      })
      .then((results) => {
        setResults(results);
      });
  }, [query]);

  useEffect(() => {
    onChange(value);
  }, [value]);

  return (
    <div className="mt-2">
      <Combobox
        value={value}
        onChange={(value) => {
          // prompt for creation
          if (value.id === null) {
            setDialogValue(value);
            setDialogOpen(true);
          } else {
            setValue(value);
          }
        }}
      >
        <div className="relative mt-2">
          <Combobox.Input
            className="w-full rounded-md border-0 bg-white py-1.5 pl-3 pr-10 text-gray-900 shadow-sm ring-1 ring-inset ring-gray-300 focus:ring-2 focus:ring-inset focus:ring-peated sm:text-sm sm:leading-6"
            onChange={(event) => setQuery(event.target.value)}
            displayValue={(item) => item?.name}
          />
          <Combobox.Button className="absolute inset-y-0 right-0 flex items-center rounded-r-md px-2 focus:outline-none">
            <ChevronDownIcon
              className="h-4 w-4 text-gray-600"
              aria-hidden="true"
            />
          </Combobox.Button>

          {(results.length > 0 || query.length > 0) && (
            <Combobox.Options className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white p-1 text-base shadow-lg ring-1 ring-black ring-opacity-20 focus:outline-none sm:text-sm">
              {results.map((item) => (
                <Combobox.Option
                  key={item.id}
                  value={item}
                  className={({ active }) =>
                    classNames(
                      "relative cursor-default select-none py-2 pl-3 pr-9 rounded-md",
                      active ? "bg-gray-100 text-peated" : "text-gray-900"
                    )
                  }
                >
                  {({ active, selected }) => (
                    <>
                      <span
                        className={classNames(
                          "block truncate",
                          selected && "font-semibold"
                        )}
                      >
                        {item.name}
                      </span>

                      {selected && (
                        <span
                          className={classNames(
                            "absolute inset-y-0 right-0 flex items-center pr-4",
                            active ? "text-white" : "text-peated"
                          )}
                        >
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      )}
                    </>
                  )}
                </Combobox.Option>
              ))}
              {canCreate && createForm && query.length > 0 && (
                <Combobox.Option
                  value={{ id: null, name: toTitleCase(query) }}
                  className={({ active }) =>
                    classNames(
                      "relative cursor-default select-none py-2 pl-3 pr-9 rounded-md",
                      active ? "bg-gray-100 text-peated" : "text-gray-900"
                    )
                  }
                >
                  Add <strong>{toTitleCase(query)}</strong>
                </Combobox.Option>
              )}
            </Combobox.Options>
          )}
        </div>
      </Combobox>
      {canCreate && createForm && (
        <Transition.Root show={dialogOpen} as={Fragment}>
          <Dialog
            as="div"
            className="fixed inset-0 z-10 overflow-y-auto min-h-screen"
            onClose={setDialogOpen}
          >
            <div className="min-h-screen text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0"
                enterTo="opacity-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100"
                leaveTo="opacity-0"
              >
                <Dialog.Overlay className="fixed inset-0" />
              </Transition.Child>

              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                enterTo="opacity-100 translate-y-0 sm:scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              >
                <Dialog.Panel className="relative h-screen transform overflow-hidden bg-white px-4 pb-4 pt-5 text-left transition-all w-full sm:p-6 justify-center items-center flex">
                  <div className="max-w-md">
                    {createForm({
                      data: dialogValue || {},
                      onFieldChange: (value: any) => {
                        setDialogValue({
                          ...dialogValue,
                          ...value,
                        });
                      },
                    })}
                    <div className="mt-5 sm:mt-6 flex gap-x-2">
                      <Button
                        onClick={() => {
                          setDialogOpen(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button
                        color="primary"
                        onClick={() => {
                          setValue(dialogValue);
                          setDialogOpen(false);
                        }}
                      >
                        Add Brand
                      </Button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </Dialog>
        </Transition.Root>
      )}
    </div>
  );
  //   return (
  //       <input
  //         className={`block w-full py-1.5 ${baseStyles} ${inputStyles}`}
  //         {...props}
  //       />

  //   );
};
