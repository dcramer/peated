"use client";

import { PlusIcon } from "@heroicons/react/20/solid";
import type { MouseEvent, ReactNode } from "react";
import { useEffect, useState } from "react";

import Chip from "../chip";
import FormField from "../formField";
import { filterDupes } from "./helpers";
import SelectDialog from "./selectDialog";
import type {
  CreateForm,
  OnQuery,
  OnRenderChip,
  OnRenderOption,
  OnResults,
  Option,
} from "./types";

type BaseProps = {
  name?: string;
  label?: string;
  helpText?: string;
  required?: boolean;
  error?: {
    message?: string;
  };
  noSort?: boolean;
  noDialog?: boolean;
  placeholder?: string;
  children?: ReactNode;
  className?: string;
  simple?: boolean;
  readOnly?: boolean;
  disabled?: boolean;
};

type MultiProps<T extends Option> =
  | {
      multiple?: never;
      value?: T | null | undefined;
      onChange?: (value: T) => void;
    }
  | {
      multiple: true;
      value?: T[] | null | undefined;
      onChange?: (value: T[]) => void;
    };

type OptionProps<T extends Option> = {
  // options are gathered either via dynamic query
  onQuery?: OnQuery<T>;
  // coerce results to Options
  onResults?: OnResults<T>;
  // or fixed value
  options?: T[];
  onRenderOption?: OnRenderOption<T>;
  onRenderChip?: OnRenderChip<T>;
  // static suggestions can also be provided
  suggestedOptions?: T[];
  // maximum number of options to backfill with suggestions
  // available for quick selection
  targetOptions?: number;
  rememberValues?: boolean;
};

type CreateProps<T extends Option> = {
  emptyListItem?: (query: string) => ReactNode;
  canCreate?: boolean;
  createForm?: CreateForm<T>;
};

type Props<T extends Option> = BaseProps &
  MultiProps<T> &
  OptionProps<T> &
  CreateProps<T>;

export type { Option };

export default function SelectField<T extends Option>({
  name,
  helpText,
  label,
  required,
  className,
  multiple,
  targetOptions = 5,
  suggestedOptions,
  simple = false,
  emptyListItem,
  canCreate,
  createForm,
  placeholder,
  onQuery,
  onResults,
  options = [],
  onRenderOption,
  onRenderChip,
  onChange,
  noDialog = false,
  noSort = false,
  error,
  disabled = false,
  readOnly = false,
  rememberValues = true,
  ...props
}: Props<T>) {
  const initialValue = Array.isArray(props.value)
    ? props.value
    : props.value
      ? [props.value]
      : [];

  if (simple) {
    targetOptions = options.length;
  }

  useEffect(() => {
    const newValue = Array.isArray(props.value)
      ? props.value
      : props.value
        ? [props.value]
        : [];
    setValue(newValue);
  }, [JSON.stringify(props.value)]);

  const [value, setValue] = useState<T[]>(initialValue);
  const [previousValues, setPreviousValues] = useState<T[]>(value);
  const [dialogOpen, setDialogOpen] = useState(false);

  if (readOnly) suggestedOptions = [];
  else if (!suggestedOptions)
    suggestedOptions = options.slice(0, targetOptions);

  const toggleOption = (option: T) => {
    setPreviousValues(filterDupes([option], previousValues));
    if (value.find((i) => i.id === option.id && i.name === option.name)) {
      setValue(
        value.filter((i) => i.id !== option.id || i.name !== option.name)
      );
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
      (onChange as (value: T[]) => void)(value);
    } else {
      (onChange as (value: T) => void)(value[0]);
    }
  }, [JSON.stringify(value)]);

  const visibleValues = rememberValues
    ? filterDupes(value, previousValues)
    : value;

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
      labelAction={
        !noDialog && !readOnly && !disabled
          ? () => {
              setDialogOpen(true);
            }
          : undefined
      }
      onClick={
        !noDialog && !readOnly && !disabled
          ? () => setDialogOpen(true)
          : undefined
      }
    >
      <div className="mt-1 flex flex-wrap gap-2 overflow-x-auto sm:leading-6">
        {visibleValues.map((option) => (
          <Chip
            as="button"
            key={`${option.id}-${option.name}`}
            active={value.includes(option)}
            onClick={
              readOnly || disabled
                ? undefined
                : (e: MouseEvent<HTMLElement>) => {
                    e.preventDefault();
                    e.stopPropagation();
                    !readOnly && toggleOption(option);
                  }
            }
          >
            {onRenderChip ? onRenderChip(option) : option.name}
          </Chip>
        ))}
        {visibleValues.length === 0 && placeholder && (
          <div className="text-muted sm:leading-6">{placeholder}</div>
        )}
        {visibleValues.length > 0 &&
          value.length < targetOptions &&
          (!options.length || visibleValues.length !== options.length) &&
          multiple && (
            <Chip
              as="button"
              onClick={
                readOnly || disabled
                  ? undefined
                  : (e: MouseEvent<HTMLElement>) => {
                      e.preventDefault();
                      e.stopPropagation();
                      !noDialog && setDialogOpen(true);
                    }
              }
            >
              <PlusIcon className="h-6 w-6 text-peated" />
            </Chip>
          )}
      </div>
      {!noDialog && !readOnly && !disabled && (
        <SelectDialog<T>
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
          onQuery={onQuery}
          onResults={onResults}
          options={options}
          onRenderOption={onRenderOption}
          emptyListItem={emptyListItem}
        />
      )}
    </FormField>
  );
}
