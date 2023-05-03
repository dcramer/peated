import { Listbox } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import classNames from "../lib/classNames";
import { ReactNode, useState } from "react";

type Option = { id: string; value: string | ReactNode };

type Props = React.ComponentPropsWithoutRef<typeof Listbox> & {
  options: Option[];
  placeholder?: string;
  required?: boolean;
  value?: string | undefined;
};

export default ({ options, placeholder, onChange, ...props }: Props) => {
  const [value, setValue] = useState<Option | undefined>(
    options.find((o) => o.id === props.value)
  );

  const baseStyles = "bg-white rounded-md border-0 text-gray-900 focus:ring-0";
  const inputStyles =
    "text-gray-900 placeholder:text-gray-400 focus:ring-0 text-sm sm:leading-6";
  return (
    <Listbox
      onChange={(value: Option) => {
        setValue(value);
        if (onChange) onChange(value.id);
      }}
    >
      <div className="relative">
        <Listbox.Button
          placeholder={placeholder}
          className={`flex min-w-full flex-col ${baseStyles} ${inputStyles}`}
        >
          <div className="truncate flex-1">
            {value?.value || (
              <span className="text-gray-400">{placeholder}</span>
            )}
          </div>
          <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronDownIcon
              className="h-4 w-4 text-gray-600"
              aria-hidden="true"
            />
          </div>
        </Listbox.Button>
        <Listbox.Options className="absolute z-10 mt-1 max-h-60 min-w-full overflow-auto rounded-md bg-white p-1 text-base shadow-lg ring-1 ring-black ring-opacity-20 focus:outline-none sm:text-sm">
          {options.map((item) => (
            <Listbox.Option
              key={item.id}
              value={item}
              className={({ active }) =>
                classNames(
                  "relative cursor-default select-none py-2 pl-3 pr-9 rounded-md text-sm",
                  active ? "bg-gray-100 text-peated" : "text-gray-900"
                )
              }
            >
              {item.value}
            </Listbox.Option>
          ))}
        </Listbox.Options>
      </div>
    </Listbox>
  );
};
