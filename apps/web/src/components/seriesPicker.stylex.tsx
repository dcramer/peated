"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import { SearchSelect, type SearchPickerOption } from "./searchPicker.stylex";

export type SeriesPickerOption = {
  id: string;
  name: string;
  brand?: string;
};

export type SeriesPickerProps = {
  disabled?: boolean;
  error?: ReactNode;
  loading?: boolean;
  onChange: (value: SeriesPickerOption | null) => void;
  onCreate?: (query: string) => void;
  onQueryChange?: (query: string) => void;
  options: readonly SeriesPickerOption[];
  searchError?: ReactNode;
  value: SeriesPickerOption | null;
};

function toPickerOption(option: SeriesPickerOption): SearchPickerOption {
  return {
    id: option.id,
    label: option.name,
    series: { brand: option.brand, name: option.name },
  };
}

/** Selects one Series while the caller owns brand scope and remote search. */
export function SeriesPicker({
  disabled = false,
  error,
  loading = false,
  onChange,
  onCreate,
  onQueryChange,
  options,
  searchError,
  value,
}: SeriesPickerProps) {
  const seriesById = useMemo(
    () =>
      new Map(
        [...options, ...(value ? [value] : [])].map((option) => [
          option.id,
          option,
        ]),
      ),
    [options, value],
  );

  return (
    <SearchSelect
      createHint="Last resort"
      disabled={disabled}
      emptyText="No matching Series."
      error={error}
      getCreateLabel={(query) => `Add “${query}” as a new Series`}
      help="A named range from this Brand."
      label="Series"
      loading={loading}
      onChange={(nextValue) =>
        onChange(
          nextValue ? (seriesById.get(String(nextValue.id)) ?? null) : null,
        )
      }
      onCreate={onCreate}
      onQueryChange={onQueryChange}
      options={options.map(toPickerOption)}
      placeholder={disabled ? "Choose a Brand first" : "Search Series"}
      searchError={searchError}
      value={value ? toPickerOption(value) : null}
    />
  );
}
