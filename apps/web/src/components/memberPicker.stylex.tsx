"use client";

import { useMemo } from "react";

import { SearchPicker, type SearchPickerOption } from "./searchPicker.stylex";

export type MemberPickerOption = {
  detail?: string;
  id: number;
  username: string;
};

export type MemberPickerProps = {
  label?: string;
  loading?: boolean;
  onChange: (value: readonly MemberPickerOption[]) => void;
  onQueryChange?: (query: string) => void;
  options: readonly MemberPickerOption[];
  value: readonly MemberPickerOption[];
};

/** Selects only the friends supplied by the owning tasting workflow. */
export function MemberPicker({
  label = "Friends",
  loading = false,
  onChange,
  onQueryChange,
  options,
  value,
}: MemberPickerProps) {
  const lookup = useMemo(
    () => new Map([...options, ...value].map((member) => [member.id, member])),
    [options, value],
  );

  function toPickerOption(member: MemberPickerOption): SearchPickerOption {
    return {
      detail: member.detail,
      id: member.id,
      label: member.username,
    };
  }

  return (
    <SearchPicker
      emptyText="No matching friends."
      help="The people sharing this pour with you."
      label={label}
      loading={loading}
      onChange={(nextValue) =>
        onChange(
          nextValue
            .map((item) => lookup.get(Number(item.id)))
            .filter((item): item is MemberPickerOption => Boolean(item)),
        )
      }
      onQueryChange={onQueryChange}
      options={options.map(toPickerOption)}
      placeholder="Search friends"
      value={value.map(toPickerOption)}
    />
  );
}
