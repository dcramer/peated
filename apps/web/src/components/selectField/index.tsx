import { PlusIcon } from "@heroicons/react/20/solid";
import { ReactNode, useEffect, useState } from "react";

import Chip from "../chip";
import FormField from "../formField";
import SelectDialog from "./selectDialog";
import { CreateOptionForm, Option } from "./types";

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

type BaseProps = {
  name?: string;
  label?: string;
  helpText?: string;
  required?: boolean;
  error?: {
    message?: string;
  };
  placeholder?: string;
  children?: ReactNode;
  className?: string;
};

type MultiProps =
  | {
      multiple?: never;
      value?: Option | null | undefined;
      onChange?: (value: Option) => void;
    }
  | {
      multiple: true;
      value?: Option[] | null | undefined;
      onChange?: (value: Option[]) => void;
    };

type OptionProps = {
  // options are gathered either via dynamic query
  endpoint?: string;
  // or fixed value
  options?: Option[];
  // static suggestions can also be provided
  suggestedOptions?: Option[];
  // maximum number of options to backfill with suggestions
  // available for quick selection
  targetOptions?: number;
};

type CreateProps = {
  canCreate?: boolean;
  createForm?: CreateOptionForm;
};

type Props = BaseProps & MultiProps & OptionProps & CreateProps;

export type { Option };

export default ({
  name,
  helpText,
  label,
  required,
  className,
  multiple,
  targetOptions = 5,
  suggestedOptions,
  canCreate,
  createForm,
  placeholder,
  endpoint,
  options = [],
  onChange,
  error,
  ...props
}: Props) => {
  const initialValue = Array.isArray(props.value)
    ? props.value
    : props.value
    ? [props.value]
    : [];

  useEffect(() => {
    const newValue = Array.isArray(props.value)
      ? props.value
      : props.value
      ? [props.value]
      : [];
    setValue(newValue);
  }, [JSON.stringify(props.value)]);

  const [value, setValue] = useState<Option[]>(initialValue);
  const [previousValues, setPreviousValues] = useState<Option[]>(value);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (!suggestedOptions) suggestedOptions = options.slice(0, targetOptions);

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
    if (!onChange) return;
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
      error={error}
      labelAction={() => {
        setDialogOpen(true);
      }}
      onClick={() => setDialogOpen(true)}
    >
      <div className="mt-1 flex flex-wrap gap-2 overflow-x-auto sm:leading-6">
        {visibleValues.map((option) => (
          <Chip
            key={`${option.id}-${option.name}`}
            active={value.indexOf(option) !== -1}
            onClick={(e) => {
              e.stopPropagation();
              toggleOption(option);
            }}
          >
            {option.name}
          </Chip>
        ))}
        {visibleValues.length === 0 && placeholder && (
          <div className="text-slate-500 sm:leading-6">{placeholder}</div>
        )}
        {visibleValues.length > 0 &&
          value.length < targetOptions &&
          (!options.length || visibleValues.length != options.length) &&
          multiple && (
            <Chip
              onClick={(e) => {
                e.stopPropagation();
                setDialogOpen(true);
              }}
            >
              <PlusIcon className="text-peated h-6 w-6" />
            </Chip>
          )}
      </div>
      <SelectDialog
        open={dialogOpen}
        setOpen={setDialogOpen}
        onSelect={(option) => {
          const active = toggleOption(option);
          if (!multiple && active) setDialogOpen(false);
        }}
        multiple={multiple}
        canCreate={canCreate}
        createForm={createForm}
        selectedValues={value}
        searchPlaceholder="Search"
        endpoint={endpoint}
        options={options}
      />
    </FormField>
  );
};
