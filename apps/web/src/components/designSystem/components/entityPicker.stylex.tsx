"use client";

import { useMemo } from "react";

import { SearchSelect, type SearchPickerOption } from "./searchPicker.stylex";

export type EntityPickerKind =
  | "brand"
  | "bottler"
  | "distiller"
  | "entity"
  | "note";

export type EntityPickerOption = {
  detail: string;
  id: string;
  meta: string;
  name: string;
};

export type EntityPickerProps = {
  help?: string;
  kind: EntityPickerKind;
  label?: string;
  loading?: boolean;
  onChange: (value: EntityPickerOption | null) => void;
  onCreate?: (query: string) => void;
  onQueryChange?: (query: string) => void;
  options: readonly EntityPickerOption[];
  placeholder?: string;
  value: EntityPickerOption | null;
};

const kindCopy = {
  brand: { label: "Brand", plural: "brands", singular: "brand" },
  bottler: { label: "Bottler", plural: "bottlers", singular: "bottler" },
  distiller: {
    label: "Distiller",
    plural: "distillers",
    singular: "distiller",
  },
  entity: { label: "Entity", plural: "entities", singular: "entity" },
  note: { label: "Note", plural: "notes", singular: "note" },
} satisfies Record<
  EntityPickerKind,
  { label: string; plural: string; singular: string }
>;

/** Supplies entity data and copy to the shared single-record picker. */
export function EntityPicker({
  help,
  kind,
  label,
  loading = false,
  onChange,
  onCreate,
  onQueryChange,
  options,
  placeholder,
  value,
}: EntityPickerProps) {
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

  function toPickerOption(option: EntityPickerOption): SearchPickerOption {
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
      value={value ? toPickerOption(value) : null}
    />
  );
}
