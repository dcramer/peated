"use client";

import type { EntityKind } from "@peated/server/types";
import { useMemo, type ReactNode } from "react";
import type { EntityIdentity } from "./entityIdentityRow.stylex";

import { SearchSelect, type SearchPickerOption } from "./searchPicker.stylex";

export type EntityPickerOption = Pick<
  EntityIdentity,
  "name" | "kind" | "location"
> & { id: string };

export type EntityPickerProps = {
  error?: ReactNode;
  help?: string;
  /** Stored entity kind for creation copy; omit when choosing across kinds. */
  kind?: EntityKind;
  label?: string;
  loading?: boolean;
  onChange: (value: EntityPickerOption | null) => void;
  onCreate?: (query: string) => void;
  onQueryChange?: (query: string) => void;
  options: readonly EntityPickerOption[];
  placeholder?: string;
  required?: boolean;
  value: EntityPickerOption | null;
};

const kindCopy = {
  brand: { label: "Brand", plural: "brands", singular: "brand" },
  bottler: { label: "Bottler", plural: "bottlers", singular: "bottler" },
  distillery: {
    label: "Distiller",
    plural: "distillers",
    singular: "distiller",
  },
  company: { label: "Company", plural: "companies", singular: "company" },
} satisfies Record<
  EntityKind,
  { label: string; plural: string; singular: string }
>;

/**
 * Selects one supplied brand, distillery, bottler, or company. Uses stored kinds;
 * the caller owns queries, filtering, and creation. EntityField is the API-backed
 * field adapter; EntityIdentityRow owns the identity displayed by this picker.
 */
export function EntityPicker({
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
}: EntityPickerProps) {
  const copy = kind
    ? kindCopy[kind]
    : {
        label: "Brand or producer",
        plural: "brands and producers",
        singular: "brand or producer",
      };
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
      entity: {
        name: option.name,
        kind: option.kind,
        location: option.location,
      },
      id: option.id,
      label: option.name,
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
