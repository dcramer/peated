"use client";

import {
  SearchPicker,
  type SearchPickerOption,
} from "@peated/web/components/searchPicker.stylex";
import {
  keepPreviousData,
  queryOptions,
  skipToken,
  useQuery,
} from "@tanstack/react-query";
import { useId, useMemo, useState } from "react";
import { useDebounceValue } from "usehooks-ts";

import type { OnQuery, Option } from "./types";

type BaseProps<T extends Option> = {
  disabled?: boolean;
  error?: { message?: string };
  helpText?: string;
  label?: string;
  name?: string;
  onQuery?: OnQuery<T>;
  options?: T[];
  placeholder?: string;
  readOnly?: boolean;
  suggestedOptions?: T[];
};

type Props<T extends Option> = BaseProps<T> &
  (
    | {
        multiple?: false;
        onChange?: (value: T | undefined) => void;
        value?: T | null;
      }
    | { multiple: true; onChange?: (value: T[]) => void; value?: T[] | null }
  );

export type { Option };

/** Connects API-backed admin fields to the shared picker. */
export default function SelectField<T extends Option>(props: Props<T>) {
  const {
    disabled = false,
    error,
    helpText,
    label = "Selection",
    multiple = false,
    onChange,
    onQuery,
    options = [],
    placeholder = "Search",
    readOnly = false,
    suggestedOptions = [],
    value,
  } = props;
  const fieldId = useId();
  const [query, setQuery] = useState("");
  const [debouncedQuery] = useDebounceValue(query, 150);
  // Query keys compare by value, so the new default `options` array made on
  // each render does not start another search.
  const { data: searchResults = [], isFetching: loading } = useQuery(
    queryOptions({
      queryKey: ["select-field", fieldId, debouncedQuery, options],
      queryFn: onQuery ? () => onQuery(debouncedQuery, options) : skipToken,
      // Keep the last results visible while the next query loads, as before.
      placeholderData: keepPreviousData,
    }),
  );
  const selected = useMemo(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value],
  );

  const available = useMemo(() => {
    const values = [
      ...selected,
      ...searchResults,
      ...suggestedOptions,
      ...options,
    ];
    return values.filter(
      (option, index) =>
        values.findIndex((candidate) => candidate.id === option.id) === index,
    );
  }, [options, searchResults, selected, suggestedOptions]);
  const byId = new Map(available.map((option) => [String(option.id), option]));
  const toPickerOption = (option: T): SearchPickerOption => ({
    bottle: option.bottle,
    entity: option.entity,
    id: option.id ?? option.name,
    label: option.name,
  });

  return (
    <SearchPicker
      disabled={disabled || readOnly}
      help={error?.message ?? helpText}
      label={label}
      loading={loading}
      onChange={(next) => {
        const nextValue = next
          .map((option) => byId.get(String(option.id)))
          .filter((option): option is T => Boolean(option));
        if (props.multiple) {
          props.onChange?.(nextValue);
        } else {
          props.onChange?.(nextValue.at(-1));
        }
      }}
      onQueryChange={setQuery}
      options={available.map(toPickerOption)}
      placeholder={placeholder}
      value={selected.map(toPickerOption)}
    />
  );
}
