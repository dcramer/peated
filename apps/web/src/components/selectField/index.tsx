"use client";

import {
  SearchPicker,
  type SearchPickerOption,
} from "@peated/web/components/designSystem/components";
import { useEffect, useMemo, useState } from "react";

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
  const [query, setQuery] = useState("");
  const [queryOptions, setQueryOptions] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const selected = useMemo(
    () => (Array.isArray(value) ? value : value ? [value] : []),
    [value],
  );

  useEffect(() => {
    if (!onQuery) return;
    let active = true;
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      try {
        const results = await onQuery(query, options);
        if (active) setQueryOptions(results);
      } finally {
        if (active) setLoading(false);
      }
    }, 150);
    return () => {
      active = false;
      window.clearTimeout(timeout);
    };
  }, [onQuery, options, query]);

  const available = useMemo(() => {
    const values = [
      ...selected,
      ...queryOptions,
      ...suggestedOptions,
      ...options,
    ];
    return values.filter(
      (option, index) =>
        values.findIndex((candidate) => candidate.id === option.id) === index,
    );
  }, [options, queryOptions, selected, suggestedOptions]);
  const byId = new Map(available.map((option) => [String(option.id), option]));
  const toPickerOption = (option: T): SearchPickerOption => ({
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
