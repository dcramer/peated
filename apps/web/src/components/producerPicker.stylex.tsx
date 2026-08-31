"use client";

import { useMemo, type ReactNode } from "react";

import { SearchSelect, type SearchPickerOption } from "./searchPicker.stylex";

export type ProducerPickerKind = "brand" | "bottler" | "distiller" | "producer";

export type ProducerPickerOption = {
  detail: string;
  id: string;
  meta: string;
  name: string;
};

export type ProducerPickerProps = {
  error?: ReactNode;
  help?: string;
  kind: ProducerPickerKind;
  label?: string;
  loading?: boolean;
  onChange: (value: ProducerPickerOption | null) => void;
  onCreate?: (query: string) => void;
  onQueryChange?: (query: string) => void;
  options: readonly ProducerPickerOption[];
  placeholder?: string;
  required?: boolean;
  value: ProducerPickerOption | null;
};

const kindCopy = {
  brand: { label: "Brand", plural: "brands", singular: "brand" },
  bottler: { label: "Bottler", plural: "bottlers", singular: "bottler" },
  distiller: {
    label: "Distiller",
    plural: "distillers",
    singular: "distiller",
  },
  producer: {
    label: "Brand or producer",
    plural: "brands and producers",
    singular: "brand or producer",
  },
} satisfies Record<
  ProducerPickerKind,
  { label: string; plural: string; singular: string }
>;

/** Supplies brand and producer choices to the shared single-choice picker. */
export function ProducerPicker({
  error,
  help,
  kind,
  label,
  loading = false,
  onChange,
  onCreate,
  onQueryChange,
  options,
  placeholder,
  required = false,
  value,
}: ProducerPickerProps) {
  const copy = kindCopy[kind];
  const entitiesById = useMemo(
    () =>
      new Map(
        [...options, ...(value ? [value] : [])].map((option) => [
          option.id,
          option,
        ]),
      ),
    [options, value],
  );

  function toPickerOption(option: ProducerPickerOption): SearchPickerOption {
    return {
      detail: `${option.id} · ${option.meta}`,
      id: option.id,
      label: option.name,
      selectedDetail: option.detail,
    };
  }

  return (
    <SearchSelect
      createHint="Last resort"
      emptyText={`No matching ${copy.plural}.`}
      error={error}
      getCreateLabel={(query) => `Add “${query}” as a new ${copy.singular}`}
      help={help ?? "↑↓ move · Enter picks · Esc closes"}
      label={label ?? copy.label}
      loading={loading}
      onChange={(nextValue) =>
        onChange(
          nextValue ? (entitiesById.get(String(nextValue.id)) ?? null) : null,
        )
      }
      onCreate={onCreate}
      onQueryChange={onQueryChange}
      options={options.map(toPickerOption)}
      placeholder={placeholder ?? `Search ${copy.plural}`}
      required={required}
      value={value ? toPickerOption(value) : null}
    />
  );
}
